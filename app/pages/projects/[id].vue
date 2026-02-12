<template>
  <div class="project-detail-page">
    <header class="page-header">
      <button class="back-btn" @click="goBack">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 v-if="project">{{ project.title }}</h1>
      <h1 v-else>{{ $t('projects.title') }}</h1>
      <div class="header-spacer"></div>
    </header>

    <div v-if="loading" class="loading-state">
      <div class="spinner-lg"></div>
    </div>

    <div v-else-if="loadError" class="error-state">
      <p>{{ loadError }}</p>
      <button class="btn btn-secondary" @click="goBack">{{ $t('common.close') }}</button>
    </div>

    <div v-else-if="project" class="detail-content">
      <!-- Project info -->
      <div class="info-section glass-card">
        <div class="project-info-row">
          <span class="project-icon">📁</span>
          <div class="project-info-text">
            <h2 class="project-name">{{ project.title }}</h2>
          </div>
        </div>

        <!-- Budget info -->
        <div v-if="project.budget && project.budget > 0" class="budget-section">
          <div class="budget-header">
            <span class="budget-label">{{ $t('projects.budget') }}</span>
            <span class="budget-amount">€ {{ formatProjectAmount(project.budget) }}</span>
          </div>
          <div class="budget-progress">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: spentPercent + '%' }" :class="progressClass"></div>
            </div>
            <div class="progress-info">
              <span>{{ $t('projects.spent') }}: € {{ formatProjectAmount(totalSpent) }}</span>
              <span>{{ $t('projects.remaining') }}: € {{ formatProjectAmount(remaining) }}</span>
            </div>
          </div>
        </div>
        <div v-else class="budget-section">
          <div class="budget-header">
            <span class="budget-label">{{ $t('projects.spent') }}</span>
            <span class="budget-amount">€ {{ formatProjectAmount(totalSpent) }}</span>
          </div>
        </div>
      </div>

      <!-- Transactions section -->
      <div class="section-header">
        <h3>{{ $t('projects.transactions') }}</h3>
        <span class="tx-count">{{ transactions.length }}</span>
      </div>

      <div v-if="transactions.length === 0" class="empty-state-sm">
        <p>{{ $t('projects.noTransactions') }}</p>
      </div>
      <div v-else class="transactions-list">
        <TransactionCard v-for="tx in transactions" :key="tx.id" :transaction="tx"
          @click="openDetail(tx.id)" />
      </div>
    </div>

    <!-- Transaction Detail Modal -->
    <div v-if="showDetail" class="modal-overlay" @click.self="closeDetail">
      <div class="modal glass-card detail-modal">
        <div class="modal-header">
          <div class="modal-actions">
            <button class="action-btn edit-btn" @click.stop="editTransaction" :title="$t('common.edit')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button class="action-btn delete-btn" @click.stop="deleteTransaction" :title="$t('common.delete')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
          <h2>{{ $t('transactions.details') }}</h2>
          <button class="close-btn" @click="closeDetail">×</button>
        </div>

        <div v-if="loadingDetail" class="loading-detail">
          <div class="spinner"></div>
        </div>

        <div v-else-if="detailError" class="detail-error">
          <div class="error-icon">⚠️</div>
          <p>{{ detailError }}</p>
          <button class="btn btn-secondary" @click="closeDetail">{{ $t('common.close') }}</button>
        </div>

        <div v-else-if="detailTransaction" class="detail-content-modal">
          <!-- Transaction Type Badge -->
          <div class="type-badge" :class="detailTransaction.transactionType">
            <span v-if="detailTransaction.transactionType === 'income'">📈 {{ $t('transactions.income') }}</span>
            <span v-else-if="detailTransaction.transactionType === 'expense'">📉 {{ $t('transactions.expense') }}</span>
            <span v-else-if="detailTransaction.transactionType === 'transfer'">🔄 {{ $t('transactions.transfer') }}</span>
            <span v-else-if="detailTransaction.transactionType === 'split'">📊 {{ $t('transactions.split') }}</span>
          </div>

          <!-- Main Amount -->
          <div class="main-amount" :class="detailTransaction.transactionType">
            {{ formatAmount(detailTransaction.amountFrom, detailTransaction.currencySymbol) }}
          </div>

          <!-- Title -->
          <h3 class="detail-title">{{ detailTransaction.title }}</h3>

          <!-- Date -->
          <div class="detail-date">
            {{ formatFullDate(detailTransaction.transactionDate) }}
          </div>

          <!-- Details Grid -->
          <div class="details-grid">
            <div class="detail-row">
              <span class="label">{{ $t('transactions.fromAccount') }}</span>
              <span class="value">{{ detailTransaction.fromAccountTitle }}</span>
            </div>

            <div v-if="detailTransaction.toAccountId" class="detail-row">
              <span class="label">{{ $t('transactions.toAccount') }}</span>
              <span class="value">{{ detailTransaction.toAccountTitle }}</span>
            </div>

            <div v-if="detailTransaction.amountTo && detailTransaction.amountTo !== detailTransaction.amountFrom"
              class="detail-row">
              <span class="label">{{ $t('transactions.amountReceived') }}</span>
              <span class="value success">{{ formatAmount(detailTransaction.amountTo, detailTransaction.currencySymbol) }}</span>
            </div>

            <div v-if="detailTransaction.categoryTitle && !detailTransaction.isSplit" class="detail-row">
              <span class="label">{{ $t('transactions.category') }}</span>
              <span class="value">{{ detailTransaction.categoryTitle }}</span>
            </div>

            <div v-if="detailTransaction.payeeTitle" class="detail-row">
              <span class="label">{{ $t('transactions.payee') }}</span>
              <span class="value">{{ detailTransaction.payeeTitle }}</span>
            </div>

            <div v-if="detailTransaction.projectTitle" class="detail-row">
              <span class="label">{{ $t('transactions.project') }}</span>
              <span class="value">{{ detailTransaction.projectTitle }}</span>
            </div>

            <div v-if="detailTransaction.isAutomotive" class="detail-row">
              <span class="label">{{ $t('transactions.type') }}</span>
              <span class="value automotive">🚗 {{ $t('transactions.automotive') }}</span>
            </div>
          </div>

          <!-- Automotive Fuel Details -->
          <div v-if="detailTransaction.fuelLog" class="automotive-section">
            <h4>⛽ {{ $t('automotive.fuelDetails') }}</h4>
            <div class="automotive-grid">
              <div class="auto-row">
                <span class="label">{{ $t('automotive.vehicle') }}</span>
                <span class="value">{{ detailTransaction.fuelLog.vehicleName }} ({{ detailTransaction.fuelLog.licensePlate }})</span>
              </div>
              <div class="auto-row">
                <span class="label">{{ $t('automotive.mileage') }}</span>
                <span class="value">{{ detailTransaction.fuelLog.odometer?.toLocaleString() }} km</span>
              </div>
              <div class="auto-row">
                <span class="label">{{ $t('automotive.fuel') }}</span>
                <span class="value">{{ detailTransaction.fuelLog.fuelTypeName }}</span>
              </div>
              <div class="auto-row">
                <span class="label">{{ $t('automotive.liters') }}</span>
                <span class="value">{{ detailTransaction.fuelLog.fuelVolume }} L</span>
              </div>
              <div class="auto-row">
                <span class="label">{{ $t('automotive.pricePerLiter') }}</span>
                <span class="value">€ {{ detailTransaction.fuelLog.fuelPricePerUnit?.toFixed(3) }}</span>
              </div>
              <div v-if="detailTransaction.fuelLog.distanceSinceLastRefuel" class="auto-row">
                <span class="label">{{ $t('automotive.distanceTraveled') }}</span>
                <span class="value">{{ detailTransaction.fuelLog.distanceSinceLastRefuel?.toLocaleString() }} km</span>
              </div>
              <div v-if="detailTransaction.fuelLog.averageConsumption" class="auto-row highlight">
                <span class="label">{{ $t('automotive.averageConsumption') }}</span>
                <span class="value">{{ detailTransaction.fuelLog.averageConsumption?.toFixed(2) }} km/L</span>
              </div>
              <div class="auto-row">
                <span class="label">{{ $t('automotive.fullTank') }}</span>
                <span class="value">{{ detailTransaction.fuelLog.isFullTank ? $t('common.yes') + ' ✓' : $t('common.no') }}</span>
              </div>
            </div>
          </div>

          <!-- Automotive Maintenance Details -->
          <div v-if="detailTransaction.maintenanceLogs && detailTransaction.maintenanceLogs.length > 0"
            class="automotive-section">
            <h4>🔧 {{ $t('automotive.maintenanceDetails') }}</h4>
            <div class="automotive-grid">
              <div class="auto-row">
                <span class="label">{{ $t('automotive.vehicle') }}</span>
                <span class="value">{{ detailTransaction.maintenanceLogs?.[0]?.vehicleName }} ({{ detailTransaction.maintenanceLogs?.[0]?.licensePlate }})</span>
              </div>
              <div class="auto-row">
                <span class="label">{{ $t('automotive.mileage') }}</span>
                <span class="value">{{ detailTransaction.maintenanceLogs?.[0]?.odometer?.toLocaleString() }} km</span>
              </div>
            </div>

            <div class="maintenance-items-list">
              <div v-for="item in detailTransaction.maintenanceLogs" :key="item.id" class="maint-item">
                <div class="maint-info">
                  <span class="maint-type" v-if="item.maintenanceTypeName">{{ item.maintenanceTypeName }}</span>
                  <span class="maint-type generic" v-else>{{ $t('automotive.genericMaintenance') }}</span>
                  <span class="maint-desc" v-if="item.description">{{ item.description }}</span>
                </div>
                <span class="maint-amount">€ {{ item.amount?.toFixed(2) }}</span>
              </div>
            </div>

            <div class="maint-total">
              <span class="label">{{ $t('common.total') }}</span>
              <span class="value">€ {{ detailTransaction.maintenanceLogs.reduce((sum, it) => sum + (it.amount || 0), 0).toFixed(2) }}</span>
            </div>
          </div>

          <!-- Split transactions -->
          <div v-if="detailTransaction.isSplit && detailTransaction.children.length > 0" class="split-section">
            <h4>{{ $t('transactions.subdivision') }}</h4>
            <div class="split-list">
              <div v-for="child in detailTransaction.children" :key="child.id" class="split-item">
                <div class="split-info">
                  <span class="split-category">
                    {{ child.isTransfer ? '🔄 ' + $t('transactions.transfer') : (child.categoryTitle || $t('transactions.noCategory')) }}
                  </span>
                  <span v-if="child.isTransfer && child.toAccountTitle" class="split-destination">
                    → {{ child.toAccountTitle }}
                  </span>
                </div>
                <span class="split-amount" :class="child.amountFrom < 0 ? 'expense' : 'income'">
                  {{ formatAmount(child.amountFrom, detailTransaction.currencySymbol) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Notes -->
          <div v-if="detailTransaction.notes" class="notes-section">
            <h4>{{ $t('common.notes') }}</h4>
            <p>{{ detailTransaction.notes }}</p>
          </div>

          <!-- Attachments -->
          <div v-if="detailTransaction.attachments.length > 0" class="attachments-section">
            <h4>📎 {{ $t('transactions.attachments') }} ({{ detailTransaction.attachments.length }})</h4>
            <div class="attachments-list">
              <a v-for="att in detailTransaction.attachments" :key="att.id" :href="att.filePath" target="_blank"
                class="attachment-item">
                {{ getFileName(att.filePath) }}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()

interface Transaction {
  id: number
  title: string
  amountFrom: number
  amountTo?: number | null
  transactionDate: string
  toAccountId?: number
  categoryTitle?: string
  accountTitle: string
}

interface TransactionChild {
  id: number
  title: string
  amountFrom: number
  amountTo: number | null
  categoryId: number | null
  categoryTitle: string | null
  toAccountId: number | null
  toAccountTitle: string | null
  isTransfer: boolean
}

interface TransactionAttachment {
  id: number
  filePath: string
}

interface TransactionDetail {
  id: number
  title: string
  amountFrom: number
  amountTo: number | null
  transactionDate: string
  fromAccountId: number
  fromAccountTitle: string
  toAccountId: number | null
  toAccountTitle: string | null
  categoryId: number | null
  categoryTitle: string | null
  projectId: number | null
  projectTitle: string | null
  payeeId: number | null
  payeeTitle: string | null
  currencyCode: string
  currencySymbol: string
  notes: string | null
  isTransfer: boolean
  isAutomotive: boolean
  parentId: number | null
  transactionType: 'income' | 'expense' | 'transfer' | 'split'
  isSplit: boolean
  children: TransactionChild[]
  attachments: TransactionAttachment[]
  fuelLog?: {
    id: number
    vehicleId: number
    vehicleName: string
    licensePlate: string
    date: string
    odometer: number
    fuelVolume: number
    fuelPricePerUnit: number
    totalCost: number
    isFullTank: boolean
    fuelTypeId: number
    fuelTypeName: string
    averageConsumption: number | null
    distanceSinceLastRefuel: number | null
    notes: string | null
  }
  maintenanceLogs?: {
    id: number
    vehicleId?: number
    vehicleName?: string
    licensePlate?: string
    date?: string
    odometer?: number
    maintenanceTypeId: number | null
    maintenanceTypeName: string | null
    description: string
    amount: number
    notes?: string | null
  }[]
}

const project = ref<{ id: number; title: string; budget: number | null } | null>(null)
const transactions = ref<Transaction[]>([])
const loading = ref(true)
const loadError = ref('')

// Detail modal
const showDetail = ref(false)
const loadingDetail = ref(false)
const detailError = ref('')
const detailTransaction = ref<TransactionDetail | null>(null)

const totalSpent = computed(() => {
  return transactions.value.reduce((sum, tx) => sum + Math.abs(tx.amountFrom), 0)
})

const spentPercent = computed(() => {
  if (!project.value?.budget || project.value.budget <= 0) return 0
  return Math.min(100, (totalSpent.value / project.value.budget) * 100)
})

const remaining = computed(() => {
  if (!project.value?.budget) return 0
  return Math.max(0, project.value.budget - totalSpent.value)
})

const progressClass = computed(() => {
  const percent = spentPercent.value
  if (percent >= 100) return 'over'
  if (percent >= 80) return 'warning'
  return 'safe'
})

function formatProjectAmount(amount: number): string {
  return amount.toLocaleString(locale.value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatAmount(amount: number, symbol: string = '€') {
  const sign = amount < 0 ? '-' : '+'
  return `${sign}${symbol}${Math.abs(amount).toFixed(2)}`
}

function formatFullDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString(locale.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getFileName(path: string) {
  return path.split('/').pop() || path
}

function goBack() {
  router.push('/projects')
}

async function loadProjectData() {
  loading.value = true
  loadError.value = ''

  try {
    const projectId = route.params.id
    const data = await $fetch<{
      project: { id: number; title: string; budget: number | null }
      transactions: Transaction[]
    }>(`/api/projects/${projectId}/transactions`)

    project.value = data.project
    transactions.value = data.transactions
  } catch (error: any) {
    console.error('Failed to load project:', error)
    loadError.value = error?.data?.message || t('projects.loadError')
  } finally {
    loading.value = false
  }
}

// Detail modal functions
async function openDetail(txId: number) {
  showDetail.value = true
  loadingDetail.value = true
  detailError.value = ''
  detailTransaction.value = null

  try {
    const result = await $fetch<{ transaction: TransactionDetail }>(`/api/transactions/${txId}`)
    detailTransaction.value = result.transaction
  } catch (error: any) {
    console.error('Failed to fetch transaction details:', error)
    detailError.value = error?.data?.message || t('transactions.loadError')
  } finally {
    loadingDetail.value = false
  }
}

function closeDetail() {
  showDetail.value = false
  detailTransaction.value = null
}

function editTransaction() {
  if (detailTransaction.value) {
    const txId = detailTransaction.value.id
    const isAutomotive = detailTransaction.value.isAutomotive
    const hasFuelLog = !!detailTransaction.value.fuelLog
    const hasMaintenanceLogs = detailTransaction.value.maintenanceLogs && detailTransaction.value.maintenanceLogs.length > 0

    closeDetail()

    if (isAutomotive) {
      if (hasFuelLog) {
        router.push(`/transactions/${txId}/edit-fuel`)
        return
      }
      if (hasMaintenanceLogs) {
        router.push(`/transactions/${txId}/edit-maintenance`)
        return
      }
    }

    router.push(`/transactions/${txId}/edit`)
  }
}

async function deleteTransaction() {
  const tx = detailTransaction.value
  if (!tx) return

  if (!confirm(t('transactions.deleteConfirm'))) return

  try {
    await $fetch(`/api/transactions/${tx.id}`, {
      method: 'DELETE'
    })
    closeDetail()
    await loadProjectData()
  } catch (error) {
    console.error('Failed to delete transaction:', error)
    alert(t('transactions.deleteError'))
  }
}

onMounted(() => {
  loadProjectData()
})
</script>

<style scoped>
.project-detail-page {
  padding: var(--space-lg);
}

.page-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
}

.page-header h1 {
  flex: 1;
  font-size: 1.3rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-spacer {
  width: 40px;
}

.back-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;
}

.back-btn:hover {
  background: var(--color-bg-glass);
  border-color: var(--color-border-focus);
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: var(--space-xl);
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-xl);
  text-align: center;
  color: var(--color-error);
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.info-section {
  padding: var(--space-lg);
}

.project-info-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.project-icon {
  font-size: 2rem;
}

.project-name {
  font-size: 1.1rem;
  font-weight: 600;
}

.budget-section {
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.budget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-sm);
}

.budget-label {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.budget-amount {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-accent);
}

.budget-progress {
  margin-top: var(--space-sm);
}

.progress-bar {
  height: 8px;
  background: var(--color-bg-glass);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: var(--space-xs);
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}

.progress-fill.safe {
  background: linear-gradient(90deg, var(--color-success), var(--color-success-light));
}

.progress-fill.warning {
  background: linear-gradient(90deg, var(--color-warning), var(--color-warning-light));
}

.progress-fill.over {
  background: linear-gradient(90deg, var(--color-error), var(--color-error-light));
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.section-header h3 {
  font-size: 1.1rem;
  font-weight: 600;
}

.tx-count {
  background: var(--color-bg-glass);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.transactions-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.empty-state-sm {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.spinner-lg {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.btn {
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
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

.detail-modal {
  width: 100%;
  max-width: 500px;
  max-height: 85vh;
  overflow-y: auto;
  padding: var(--space-xl);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.modal-actions {
  display: flex;
  gap: var(--space-xs);
}

.action-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--color-bg-glass);
  color: var(--color-text-primary);
}

.delete-btn:hover {
  background: var(--color-error-bg);
  color: var(--color-error);
}

.modal-header h2 {
  font-size: 1.1rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--color-text-muted);
  cursor: pointer;
}

.loading-detail {
  display: flex;
  justify-content: center;
  padding: var(--space-xl);
}

.detail-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-xl);
  text-align: center;
}

.detail-error .error-icon {
  font-size: 3rem;
}

.detail-error p {
  color: var(--color-error);
}

.detail-content-modal {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.type-badge {
  align-self: flex-start;
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-lg);
  font-size: 0.8rem;
  font-weight: 500;
}

.type-badge.income {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.type-badge.expense {
  background: var(--color-error-bg);
  color: var(--color-error);
}

.type-badge.transfer {
  background: var(--color-bg-glass);
  color: var(--color-text-secondary);
}

.type-badge.split {
  background: var(--color-accent-bg);
  color: var(--color-accent);
}

.main-amount {
  font-size: 2rem;
  font-weight: 700;
  text-align: center;
}

.main-amount.income {
  color: var(--color-success);
}

.main-amount.expense {
  color: var(--color-error);
}

.main-amount.transfer,
.main-amount.split {
  color: var(--color-text-primary);
}

.detail-title {
  text-align: center;
  font-size: 1.1rem;
  font-weight: 600;
}

.detail-date {
  text-align: center;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  text-transform: capitalize;
}

.details-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-row .label {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.detail-row .value {
  font-weight: 500;
}

.detail-row .value.success {
  color: var(--color-success);
}

.detail-row .value.automotive {
  padding: 2px 8px;
  background: var(--color-accent-bg);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
}

.split-section,
.notes-section,
.attachments-section {
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.split-section h4,
.notes-section h4,
.attachments-section h4 {
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: var(--space-sm);
  color: var(--color-text-secondary);
}

.split-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.split-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-sm);
}

.split-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.split-category {
  font-size: 0.85rem;
  font-weight: 500;
}

.split-destination {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.split-amount {
  font-weight: 600;
  font-size: 0.9rem;
}

.split-amount.income {
  color: var(--color-success);
}

.split-amount.expense {
  color: var(--color-error);
}

.notes-section p {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  white-space: pre-wrap;
}

.attachments-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.attachment-item {
  display: flex;
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-sm);
  color: var(--color-accent);
  text-decoration: none;
  font-size: 0.85rem;
  transition: background 0.15s;
}

.attachment-item:hover {
  background: var(--color-bg-glass);
}

/* Automotive section */
.automotive-section {
  margin-top: var(--space-lg);
  padding: var(--space-md);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-accent);
}

.automotive-section h4 {
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: var(--space-md);
}

.automotive-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.auto-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-xs) 0;
  border-bottom: 1px solid var(--color-border);
}

.auto-row:last-child {
  border-bottom: none;
}

.auto-row .label {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.auto-row .value {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-primary);
  text-align: right;
}

.auto-row.highlight {
  background: var(--color-accent-bg);
  padding: var(--space-sm);
  border-radius: var(--radius-sm);
  margin: var(--space-xs) 0;
  border-bottom: none;
}

.auto-row.highlight .value {
  color: var(--color-accent);
  font-weight: 600;
}

/* Maintenance Items List */
.maintenance-items-list {
  margin-top: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.maint-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm);
  background: var(--color-bg-glass);
  border-radius: var(--radius-sm);
}

.maint-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.maint-type {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-text-primary);
}

.maint-type.generic {
  color: var(--color-text-muted);
  font-style: italic;
}

.maint-desc {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.maint-amount {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-expense);
}

.maint-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-sm);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--color-border);
  font-weight: 600;
}

.maint-total .value {
  font-size: 1rem;
  color: var(--color-expense);
}
</style>
