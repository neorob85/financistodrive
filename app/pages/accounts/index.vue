<template>
  <div class="accounts-page">
    <div class="page-header-row">
      <h1 class="page-title">{{ $t('accounts.title') }}</h1>
      <button class="filter-chip" :class="{ active: showActiveOnly }" @click="showActiveOnly = !showActiveOnly">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        {{ $t('common.activeOnly') }}
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="loading-state">
      <div class="spinner-lg"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="filteredAccounts.length === 0" class="empty-state">
      <div class="empty-icon">🏦</div>
      <h2>{{ $t('accounts.noAccounts') }}</h2>
      <p>{{ $t('accounts.addFirst') }}</p>
    </div>

    <!-- Accounts list -->
    <div v-else class="accounts-grid">
      <div v-for="account in filteredAccounts" :key="account.id" class="account-card glass-card"
        :class="{ inactive: !account.isActive }" @click="viewTransactions(account)">
        <div class="account-header">
          <div class="account-icon">{{ getAccountIcon(account.accountType) }}</div>
          <div class="account-type">{{ account.accountType }}</div>
          <div v-if="!account.isActive" class="inactive-badge">{{ $t('common.inactive') }}</div>
          <button class="edit-btn" @click.stop="editAccount(account)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        </div>

        <div class="account-title">{{ account.title }}</div>
        <div v-if="account.issuer" class="account-issuer">{{ account.issuer }}</div>

        <div class="account-balance">
          <span class="currency">{{ account.currencySymbol }}</span>
          <span v-if="account.isCreditCard" class="amount" :class="{ negative: account.currentCycleTotal < 0 }">
            {{ formatAmount(account.currentCycleTotal) }}
          </span>
          <span v-else class="amount" :class="{ negative: account.actualAmount < 0 }">
            {{ formatAmount(account.actualAmount) }}
          </span>
        </div>

        <div v-if="account.isCreditCard && account.creditCardAccountTitle" class="credit-card-link">
          {{ $t('accounts.linkedTo') }} {{ account.creditCardAccountTitle }}
        </div>

        <!-- Current billing period -->
        <div v-if="account.isCreditCard && account.currentPeriodStart && account.currentPeriodEnd"
          class="billing-period">
          {{ $t('accounts.billingPeriod', {
            start: formatShortDate(account.currentPeriodStart), end:
              formatShortDate(account.currentPeriodEnd)
          }) }}
        </div>

        <!-- Previous billing cycle balance -->
        <div v-if="account.isCreditCard && account.previousCycleTotal !== 0" class="previous-cycle">
          <div class="previous-cycle-row">
            <span>{{ $t('accounts.previousBalance') }}</span>
            <span class="previous-cycle-amount">
              {{ account.currencySymbol }} {{ formatAmount(account.previousCycleTotal) }}
            </span>
          </div>
          <div v-if="account.paymentDate" class="payment-date">
            {{ $t('accounts.payment') }} {{ formatShortDate(account.paymentDate) }}
          </div>
        </div>

        <div v-if="account.isCreditCard && account.cardLimit" class="card-info">
          <div class="card-limit">
            <span>{{ $t('common.limit') }}:</span>
            <span>{{ account.currencySymbol }} {{ formatAmount(account.cardLimit) }}</span>
          </div>
          <div class="card-usage">
            <div class="usage-bar">
              <div class="usage-fill" :style="{ width: getCycleUsagePercent(account) + '%' }"
                :class="getCycleUsageClass(account)"></div>
            </div>
            <span class="usage-text">
              {{ account.currencySymbol }} {{ formatAmount(Math.abs(account.currentCycleTotal)) }} / {{
                formatAmount(account.cardLimit) }}
              ({{ getCycleUsagePercent(account).toFixed(0) }}%)
            </span>
          </div>
        </div>

        <div v-else-if="!account.isCreditCard && account.cardLimit" class="card-info">
          <div class="card-limit">
            <span>{{ $t('common.limit') }}:</span>
            <span>{{ account.currencySymbol }} {{ formatAmount(account.cardLimit) }}</span>
          </div>
          <div class="card-usage">
            <div class="usage-bar">
              <div class="usage-fill" :style="{ width: getUsagePercent(account) + '%' }"
                :class="getUsageClass(account)"></div>
            </div>
            <span class="usage-text">{{ getUsagePercent(account).toFixed(0) }}% {{ $t('common.used') }}</span>
          </div>
        </div>

        <div v-if="account.accountNumber" class="account-number">
          •••• {{ account.accountNumber.slice(-4) }}
        </div>
      </div>
    </div>

    <!-- Total -->
    <div v-if="filteredAccounts.length > 0" class="total-section glass-card">
      <span class="total-label">{{ $t('accounts.totalAccounts') }}</span>
      <span class="total-amount" :class="{ negative: totalAmount < 0 }">
        € {{ formatAmount(totalAmount) }}
      </span>
    </div>

    <!-- Recalculate button -->
    <div v-if="filteredAccounts.length > 0" class="recalculate-section">
      <button class="btn btn-outline" @click="recalculateBalances" :disabled="recalculating">
        <span v-if="recalculating" class="spinner-sm"></span>
        <span v-else>🔄</span>
        Ricalcola saldi
      </button>
    </div>

    <!-- FAB Button -->
    <button class="fab" @click="openModal">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>

    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal glass-card">
        <div class="modal-header">
          <h2>{{ editingId ? $t('accounts.editAccount') : $t('accounts.newAccount') }}</h2>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <form @submit.prevent="saveAccount" class="modal-form">
          <div class="input-group">
            <label for="title">{{ $t('accounts.accountName') }} *</label>
            <input id="title" v-model="form.title" type="text" class="input-field" required>
          </div>

          <div class="form-row">
            <div class="input-group">
              <label for="accountType">{{ $t('accounts.accountType') }} *</label>
              <select id="accountType" v-model="form.accountTypeId" class="input-field" required>
                <option value="">{{ $t('common.select') }}</option>
                <option v-for="type in accountTypes" :key="type.id" :value="type.id">
                  {{ type.title }}
                </option>
              </select>
            </div>
            <div class="input-group">
              <label for="currency">{{ $t('accounts.currency') }} *</label>
              <select id="currency" v-model="form.currencyId" class="input-field" required>
                <option value="">{{ $t('common.select') }}</option>
                <option v-for="curr in currencies" :key="curr.id" :value="curr.id">
                  {{ curr.title }} ({{ curr.symbol }})
                </option>
              </select>
            </div>
          </div>

          <div class="input-group">
            <label for="initialAmount">{{ $t('accounts.initialBalance') }}</label>
            <input id="initialAmount" v-model.number="form.initialAmount" type="number" step="0.01" class="input-field">
          </div>

          <div class="form-row">
            <div class="input-group">
              <label for="issuer">{{ $t('accounts.issuer') }}</label>
              <input id="issuer" v-model="form.issuer" type="text" class="input-field"
                :placeholder="$t('accounts.issuerPlaceholder')">
            </div>
            <div class="input-group">
              <label for="accountNumber">{{ $t('accounts.accountNumber') }}</label>
              <input id="accountNumber" v-model="form.accountNumber" type="text" class="input-field">
            </div>
          </div>

          <div class="input-group">
            <label for="notes">{{ $t('common.notes') }}</label>
            <textarea id="notes" v-model="form.notes" class="input-field" rows="2"></textarea>
          </div>

          <div class="checkbox-row">
            <label class="checkbox-label">
              <input type="checkbox" v-model="form.isActive">
              <span>{{ $t('common.active') }}</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="form.isIncludedIntoTotals">
              <span>{{ $t('accounts.includeInTotals') }}</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="form.isCreditCard">
              <span>{{ $t('accounts.isCreditCard') }}</span>
            </label>
          </div>

          <!-- Credit card fields -->
          <template v-if="form.isCreditCard">
            <div class="input-group">
              <label for="accountCreditCard">{{ $t('accounts.linkedAccount') }}</label>
              <select id="accountCreditCard" v-model="form.accountCreditCard" class="input-field">
                <option :value="null">{{ $t('common.none') }}</option>
                <option v-for="acc in availableAccountsForCreditCard" :key="acc.id" :value="acc.id">
                  {{ acc.title }}
                </option>
              </select>
            </div>
            <div class="form-row">
              <div class="input-group">
                <label for="cardLimit">{{ $t('accounts.cardLimit') }}</label>
                <input id="cardLimit" v-model.number="form.cardLimit" type="number" step="0.01" class="input-field">
              </div>
            </div>
            <div class="form-row">
              <div class="input-group">
                <label for="cardClosingDay">{{ $t('accounts.closingDay') }}</label>
                <input id="cardClosingDay" v-model.number="form.cardClosingDay" type="number" min="1" max="31"
                  class="input-field" placeholder="1-31">
              </div>
              <div class="input-group">
                <label for="cardPaymentDay">{{ $t('accounts.paymentDay') }}</label>
                <input id="cardPaymentDay" v-model.number="form.cardPaymentDay" type="number" min="1" max="31"
                  class="input-field" placeholder="1-31">
              </div>
            </div>
          </template>

          <div v-if="formError" class="form-error">{{ formError }}</div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="closeModal">{{ $t('common.cancel') }}</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <span v-if="saving" class="spinner"></span>
              {{ editingId ? $t('common.saveChanges') : $t('accounts.createAccount') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const router = useRouter()
const { t } = useI18n()

interface Account {
  id: number
  title: string
  initialAmount: number
  actualAmount: number
  issuer: string | null
  accountNumber: string | null
  isActive: boolean
  sortOrder: number
  isIncludedIntoTotals: boolean
  cardLimit: number | null
  cardClosingDay: number | null
  cardPaymentDay: number | null
  isCreditCard: boolean
  accountCreditCard: number | null
  creditCardAccountTitle: string | null
  previousCycleTotal: number
  currentCycleTotal: number
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  paymentDate: string | null
  notes: string | null
  currencySymbol: string
  currencyAbbr: string
  accountType: string
}

const accounts = ref<Account[]>([])
const loading = ref(true)
const showActiveOnly = ref(true)

const filteredAccounts = computed(() => {
  if (showActiveOnly.value) return accounts.value.filter(a => a.isActive)
  return accounts.value
})
const showModal = ref(false)
const saving = ref(false)
const recalculating = ref(false)
const formError = ref('')
const editingId = ref<number | null>(null)
const currencies = ref<{ id: number; title: string; symbol: string }[]>([])
const accountTypes = ref<{ id: number; title: string }[]>([])

const form = ref({
  title: '',
  accountTypeId: '' as number | '',
  currencyId: '' as number | '',
  initialAmount: 0,
  cardLimit: null as number | null,
  issuer: '',
  accountNumber: '',
  notes: '',
  isActive: true,
  isIncludedIntoTotals: true,
  isCreditCard: false,
  accountCreditCard: null as number | null,
  cardClosingDay: null as number | null,
  cardPaymentDay: null as number | null
})

const totalAmount = computed(() => {
  return accounts.value
    .filter(a => a.isActive && a.isIncludedIntoTotals)
    .reduce((sum, a) => sum + a.actualAmount, 0)
})

const availableAccountsForCreditCard = computed(() => {
  return accounts.value.filter(a => a.id !== editingId.value && !a.isCreditCard)
})

onMounted(async () => {
  await loadAccounts()
  // Preload form data
  const [currData, typeData] = await Promise.all([
    $fetch<{ currencies: typeof currencies.value }>('/api/currencies'),
    $fetch<{ accountTypes: typeof accountTypes.value }>('/api/account-types')
  ])
  currencies.value = currData.currencies
  accountTypes.value = typeData.accountTypes

  // Set default currency
  const defaultCurr = currData.currencies.find(c => (c as any).isDefault)
  if (defaultCurr) form.value.currencyId = defaultCurr.id
})

async function loadAccounts() {
  loading.value = true
  try {
    const data = await $fetch<{ accounts: Account[] }>('/api/accounts')
    accounts.value = data.accounts
  } catch (error) {
    console.error('Failed to load accounts:', error)
  } finally {
    loading.value = false
  }
}

function openModal() {
  editingId.value = null
  resetForm()
  showModal.value = true
  formError.value = ''
}

function viewTransactions(account: Account) {
  router.push(`/accounts/${account.id}`)
}

function editAccount(account: Account) {
  editingId.value = account.id
  // Find the account type and currency IDs
  const typeMatch = accountTypes.value.find(t => t.title === account.accountType)
  const currMatch = currencies.value.find(c => c.symbol === account.currencySymbol)

  form.value = {
    title: account.title,
    accountTypeId: typeMatch?.id || '',
    currencyId: currMatch?.id || '',
    initialAmount: account.initialAmount,
    cardLimit: account.cardLimit,
    issuer: account.issuer || '',
    accountNumber: account.accountNumber || '',
    notes: account.notes || '',
    isActive: account.isActive,
    isIncludedIntoTotals: account.isIncludedIntoTotals,
    isCreditCard: account.isCreditCard,
    accountCreditCard: account.accountCreditCard,
    cardClosingDay: account.cardClosingDay,
    cardPaymentDay: account.cardPaymentDay
  }
  showModal.value = true
  formError.value = ''
}

function closeModal() {
  showModal.value = false
  editingId.value = null
  resetForm()
}

function resetForm() {
  form.value = {
    title: '',
    accountTypeId: '',
    currencyId: currencies.value.find(c => (c as any).isDefault)?.id || '',
    initialAmount: 0,
    cardLimit: null,
    issuer: '',
    accountNumber: '',
    notes: '',
    isActive: true,
    isIncludedIntoTotals: true,
    isCreditCard: false,
    accountCreditCard: null,
    cardClosingDay: null,
    cardPaymentDay: null
  }
}

async function saveAccount() {
  if (!form.value.title || !form.value.currencyId || !form.value.accountTypeId) {
    formError.value = t('common.required')
    return
  }

  saving.value = true
  formError.value = ''

  try {
    const isCc = form.value.isCreditCard
    const body = {
      title: form.value.title,
      currencyId: form.value.currencyId,
      accountTypeId: form.value.accountTypeId,
      cardLimit: isCc ? form.value.cardLimit : null,
      issuer: form.value.issuer || null,
      accountNumber: form.value.accountNumber || null,
      notes: form.value.notes || null,
      isActive: form.value.isActive,
      isIncludedIntoTotals: form.value.isIncludedIntoTotals,
      isCreditCard: isCc,
      accountCreditCard: isCc ? form.value.accountCreditCard : null,
      cardClosingDay: isCc ? form.value.cardClosingDay : null,
      cardPaymentDay: isCc ? form.value.cardPaymentDay : null
    }

    if (editingId.value) {
      // Update
      await $fetch(`/api/accounts/${editingId.value}`, {
        method: 'PUT',
        body
      })
    } else {
      // Create with initialAmount
      await $fetch('/api/accounts', {
        method: 'POST',
        body: {
          ...body,
          initialAmount: form.value.initialAmount || 0
        }
      })
    }
    closeModal()
    await loadAccounts()
  } catch (error: any) {
    formError.value = error.data?.message || t('common.saveError')
  } finally {
    saving.value = false
  }
}

function formatAmount(amount: number): string {
  return Math.abs(amount).toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function getAccountIcon(type: string): string {
  const icons: Record<string, string> = {
    'Cash': '💵',
    'Bank Account': '🏦',
    'Credit Card': '💳',
    'Prepaid Card': '💳',
    'Electronic Wallet': '📱',
    'Savings Account': '🐷',
    'Investment Account': '📈',
    'Loan Account': '🏠',
    'Other': '💰'
  }
  return icons[type] || '💰'
}

function getUsagePercent(account: Account): number {
  if (!account.cardLimit || account.cardLimit === 0) return 0
  const used = Math.abs(account.actualAmount)
  return Math.min(100, (used / account.cardLimit) * 100)
}

function getUsageClass(account: Account): string {
  const percent = getUsagePercent(account)
  if (percent >= 90) return 'danger'
  if (percent >= 70) return 'warning'
  return 'safe'
}

function formatShortDate(isoStr: string): string {
  const d = new Date(isoStr)
  const day = d.getDate()
  const month = d.toLocaleString('it-IT', { month: 'short' }).toUpperCase()
  return `${day}-${month}`
}

function getCycleUsagePercent(account: Account): number {
  if (!account.cardLimit || account.cardLimit === 0) return 0
  const used = Math.abs(account.currentCycleTotal)
  return Math.min(100, (used / account.cardLimit) * 100)
}

function getCycleUsageClass(account: Account): string {
  const percent = getCycleUsagePercent(account)
  if (percent >= 90) return 'danger'
  if (percent >= 70) return 'warning'
  return 'safe'
}

async function recalculateBalances() {
  recalculating.value = true
  try {
    await $fetch('/api/accounts/recalculate', { method: 'POST' })
    await loadAccounts()
  } catch (error) {
    console.error('Failed to recalculate balances:', error)
  } finally {
    recalculating.value = false
  }
}
</script>

<style scoped>
.accounts-page {
  padding: var(--space-lg);
}

.page-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-text-muted);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  font-family: inherit;
}

.filter-chip:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.filter-chip.active {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-bg);
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: var(--space-xl);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  text-align: center;
  color: var(--color-text-secondary);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: var(--space-lg);
}

.empty-state h2 {
  font-size: 1.25rem;
  margin-bottom: var(--space-sm);
  color: var(--color-text-primary);
}

.accounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.account-card {
  padding: var(--space-lg);
  transition: transform 0.2s, box-shadow 0.2s;
}

.account-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.account-card.inactive {
  opacity: 0.6;
}

.account-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.account-icon {
  font-size: 1.5rem;
}

.account-type {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.inactive-badge {
  background: var(--color-error-bg);
  color: var(--color-error);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  font-weight: 500;
}

.edit-btn {
  margin-left: auto;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edit-btn:hover {
  background: var(--color-bg-elevated);
  color: var(--color-accent);
}

.account-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 4px;
}

.account-issuer {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-bottom: var(--space-md);
}

.account-balance {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  margin-top: var(--space-md);
}

.account-balance .currency {
  font-size: 1rem;
  color: var(--color-text-secondary);
}

.account-balance .amount {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-success);
}

.account-balance .amount.negative {
  color: var(--color-error);
}

.card-info {
  margin-top: var(--space-md);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.card-limit {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
}

.card-usage {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.usage-bar {
  height: 6px;
  background: var(--color-bg-glass);
  border-radius: 3px;
  overflow: hidden;
}

.usage-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}

.usage-fill.safe {
  background: linear-gradient(90deg, #10b981, #34d399);
}

.usage-fill.warning {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}

.usage-fill.danger {
  background: linear-gradient(90deg, #ef4444, #f87171);
}

.usage-text {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.credit-card-link {
  margin-top: var(--space-sm);
  font-size: 0.8rem;
  color: var(--color-accent);
  opacity: 0.8;
}

.billing-period {
  margin-top: var(--space-sm);
  font-size: 0.75rem;
  color: var(--color-text-muted);
  letter-spacing: 0.3px;
}

.previous-cycle {
  margin-top: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.previous-cycle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.previous-cycle-amount {
  font-weight: 600;
  color: var(--color-error);
}

.payment-date {
  margin-top: 4px;
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

.account-number {
  margin-top: var(--space-md);
  font-size: 0.85rem;
  color: var(--color-text-muted);
  font-family: monospace;
}

.total-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-lg);
}

.total-label {
  font-size: 1rem;
  color: var(--color-text-secondary);
}

.total-amount {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-success);
}

.total-amount.negative {
  color: var(--color-error);
}

.recalculate-section {
  display: flex;
  justify-content: center;
  margin-top: var(--space-md);
  margin-bottom: var(--space-lg);
}

.btn-outline {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-lg);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-outline:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.btn-outline:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner-sm {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner-lg {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* FAB Button */
.fab {
  position: fixed;
  bottom: calc(70px + var(--space-lg));
  right: var(--space-lg);
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary));
  border: none;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--shadow-glow);
  transition: transform 0.2s, box-shadow 0.2s;
  z-index: 100;
}

.fab:hover {
  transform: scale(1.1);
  box-shadow: var(--shadow-glow);
}

.fab:active {
  transform: scale(0.95);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-modal-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-lg);
  backdrop-filter: blur(4px);
}

.modal {
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  padding: var(--space-xl);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: var(--color-text-primary);
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

@media (max-width: 500px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}

.checkbox-row {
  display: flex;
  gap: var(--space-lg);
  flex-wrap: wrap;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
  color: var(--color-text-secondary);
}

.checkbox-label input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-accent);
}

.form-error {
  background: var(--color-error-bg);
  color: var(--color-error);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
}

.modal-actions {
  display: flex;
  gap: var(--space-md);
  justify-content: flex-end;
  margin-top: var(--space-md);
}

.btn {
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.btn-primary {
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary));
  border: none;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  box-shadow: var(--shadow-glow);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.btn-secondary:hover {
  background: var(--color-bg-glass);
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-spinner-border);
  border-top-color: var(--color-spinner-active);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
</style>
