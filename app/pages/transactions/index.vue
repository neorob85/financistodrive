<template>
  <div class="transactions-page">
    <!-- Filter bar -->
    <div v-if="!loading || transactions.length > 0" class="filter-bar">
      <button class="filter-toggle" @click="showFilters = !showFilters" :class="{ active: activeFilterCount > 0 }">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <span>{{ $t('transactions.filters.title') }}</span>
        <span v-if="activeFilterCount > 0" class="filter-count">{{ activeFilterCount }}</span>
      </button>
      <button v-if="activeFilterCount > 0" class="filter-clear" @click="clearFilters">
        {{ $t('transactions.filters.clearAll') }}
      </button>
    </div>

    <div v-if="showFilters" class="filter-panel">
      <div class="filter-grid">
        <div class="input-group">
          <label>{{ $t('transactions.category') }}</label>
          <select v-model="filterCategoryId" class="input-field">
            <option :value="null">{{ $t('transactions.filters.allCategories') }}</option>
            <option v-for="cat in filterCategories" :key="cat.id" :value="cat.id">{{ cat.indent }}{{ cat.title }}
            </option>
          </select>
        </div>
        <div class="input-group">
          <label>{{ $t('transactions.account') }}</label>
          <select v-model="filterAccountId" class="input-field">
            <option :value="null">{{ $t('transactions.filters.allAccounts') }}</option>
            <option v-for="acc in filterAccounts" :key="acc.id" :value="acc.id">{{ acc.title }}</option>
          </select>
        </div>
        <div class="input-group">
          <label>{{ $t('transactions.project') }}</label>
          <select v-model="filterProjectId" class="input-field">
            <option :value="null">{{ $t('transactions.filters.allProjects') }}</option>
            <option v-for="proj in filterProjects" :key="proj.id" :value="proj.id">{{ proj.title }}</option>
          </select>
        </div>
        <div class="input-group">
          <label>{{ $t('automotive.vehicle') }}</label>
          <select v-model="filterVehicleId" class="input-field">
            <option :value="null">{{ $t('transactions.filters.allVehicles') }}</option>
            <option v-for="v in filterVehicles" :key="v.id" :value="v.id">{{ v.brand }} {{ v.model }}</option>
          </select>
        </div>
        <div class="input-group">
          <label>{{ $t('transactions.filters.dateFrom') }}</label>
          <input v-model="filterDateFrom" :type="dateFromFocused || filterDateFrom ? 'date' : 'text'"
            @focus="dateFromFocused = true" @blur="dateFromFocused = false"
            :placeholder="$t('transactions.filters.dateFrom')" class="input-field">
        </div>
        <div class="input-group">
          <label>{{ $t('transactions.filters.dateTo') }}</label>
          <input v-model="filterDateTo" :type="dateToFocused || filterDateTo ? 'date' : 'text'"
            @focus="dateToFocused = true" @blur="dateToFocused = false" :placeholder="$t('transactions.filters.dateTo')"
            class="input-field">
        </div>
        <div class="input-group checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="filterDeductibleOnly">
            <span>{{ $t('transactions.filters.deductibleOnly') }}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading && transactions.length === 0" class="loading-state">
      <div class="spinner-lg"></div>
      <p>{{ $t('transactions.loadingTransactions') }}</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="!loading && transactions.length === 0" class="empty-state">
      <div class="empty-icon">💳</div>
      <h2>{{ $t('transactions.noTransactions') }}</h2>
      <p>{{ $t('transactions.addFirst') }}</p>
    </div>

    <!-- No filter results -->
    <div v-else-if="filteredTransactions.length === 0 && activeFilterCount > 0" class="empty-state">
      <div class="empty-icon">🔍</div>
      <h2>{{ $t('transactions.filters.noResults') }}</h2>
    </div>

    <!-- Transactions list -->
    <div v-else class="transactions-list" ref="listRef">
      <template v-for="(group, periodKey) in groupedTransactions" :key="periodKey">
        <PeriodSeparator :label="group.label" :count="group.transactions.length" :balance="group.balance" />
        <TransactionCard v-for="tx in group.transactions" :key="tx.id" :transaction="tx" @click="openDetail(tx.id)" />
      </template>

      <!-- Load more indicator -->
      <div v-if="hasMore" class="load-more" ref="loadMoreRef">
        <div v-if="loadingMore" class="spinner"></div>
        <span v-else>{{ $t('transactions.scrollToLoadMore') }}</span>
      </div>
    </div>

    <!-- Transaction Detail Modal -->
    <TransactionDetailModal :show="showDetail" :loading="loadingDetail" :error="detailError"
      :transaction="detailTransaction" :attribute-values="detailAttributeValues"
      @close="closeDetail" @edit="editTransaction" @delete="deleteTransaction" />


    <!-- FAB Buttons -->
    <div class="fab-container">
      <NuxtLink to="/transactions/automotive" class="fab fab-automotive" :title="$t('transactions.newAutomotive')">
        🚗
      </NuxtLink>
      <NuxtLink to="/transactions/new" class="fab fab-primary">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const { t, locale } = useI18n()

interface Transaction {
  id: number
  title: string
  amountFrom: number
  amountTo?: number | null
  transactionDate: string
  toAccountId?: number
  categoryId?: number | null
  categoryTitle?: string
  fromAccountId?: number | null
  accountTitle: string
  projectId?: number | null
  projectTitle?: string | null
  vehicleId?: number | null
  balanceAmount: number
  vehicleName?: string | null
  odometer?: number | null
  hasDeductible?: boolean
}

interface FilterAccount {
  id: number
  title: string
}

interface FilterCategory {
  id: number
  title: string
  parentId: number | null
  isActive: boolean
  sortOrder?: number
}

interface FlatFilterCategory {
  id: number
  title: string
  indent: string
}

interface FilterProject {
  id: number
  title: string
}

interface FilterVehicle {
  id: number
  brand: string
  model: string
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
  deductibleAmount: number | null
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

interface TransactionGroup {
  transactions: Transaction[]
  balance: number
  label: string
}

const transactions = ref<Transaction[]>([])
const loading = ref(true)
const loadingMore = ref(false)
const hasMore = ref(true)
const page = ref(1)
const limit = 20
const periodBalances = ref<Record<string, number>>({})

const listRef = ref<HTMLElement | null>(null)
const loadMoreRef = ref<HTMLElement | null>(null)

// Filters
const showFilters = ref(false)
const filterCategoryId = ref<number | null>(null)
const filterAccountId = ref<number | null>(null)
const filterProjectId = ref<number | null>(null)
const filterVehicleId = ref<number | null>(null)
const filterDateFrom = ref('')
const filterDateTo = ref('')
const filterDeductibleOnly = ref(false)
const dateFromFocused = ref(false)
const dateToFocused = ref(false)

// Master data for filter dropdowns
const filterAccounts = ref<FilterAccount[]>([])
const filterCategories = ref<FlatFilterCategory[]>([])
const filterProjects = ref<FilterProject[]>([])
const filterVehicles = ref<FilterVehicle[]>([])

const activeFilterCount = computed(() => {
  let count = 0
  if (filterCategoryId.value !== null) count++
  if (filterAccountId.value !== null) count++
  if (filterProjectId.value !== null) count++
  if (filterVehicleId.value !== null) count++
  if (filterDateFrom.value) count++
  if (filterDateTo.value) count++
  if (filterDeductibleOnly.value) count++
  return count
})

function clearFilters() {
  filterCategoryId.value = null
  filterAccountId.value = null
  filterProjectId.value = null
  filterVehicleId.value = null
  filterDateFrom.value = ''
  filterDateTo.value = ''
  filterDeductibleOnly.value = false
}

function flattenCategories(cats: FilterCategory[]): FlatFilterCategory[] {
  const result: FlatFilterCategory[] = []

  // Build tree from flat list using parentId
  const categoryMap = new Map<number, FilterCategory & { children: (FilterCategory & { children: any[] })[] }>()
  const rootCategories: (FilterCategory & { children: any[] })[] = []

  for (const cat of cats) {
    categoryMap.set(cat.id, { ...cat, children: [] })
  }
  for (const cat of cats) {
    const catWithChildren = categoryMap.get(cat.id)!
    if (cat.parentId && categoryMap.has(cat.parentId)) {
      categoryMap.get(cat.parentId)!.children.push(catWithChildren)
    } else {
      rootCategories.push(catWithChildren)
    }
  }

  // Flatten with visual indentation
  function flatten(items: (FilterCategory & { children?: any[] })[], level = 0) {
    for (const cat of items) {
      if (cat.isActive !== false) {
        const prefix = level > 0 ? '\u2514' + '\u2500'.repeat(level) + ' ' : ''
        result.push({ id: cat.id, title: cat.title, indent: prefix })
      }
      if (cat.children && cat.children.length > 0) {
        flatten(cat.children, level + 1)
      }
    }
  }

  flatten(rootCategories)
  return result
}

// Parse date string as local time (shared helper)
function parseLocalDate(dateStr: string): Date {
  const normalized = dateStr.replace('T', ' ').replace('Z', '')
  const parts = normalized.split(' ')
  const datePart = parts[0] || ''
  const timePart = parts[1] || '00:00:00'
  const dateParts = datePart.split('-')
  const timeParts = timePart.split(':')
  return new Date(
    parseInt(dateParts[0] || '0', 10),
    parseInt(dateParts[1] || '1', 10) - 1,
    parseInt(dateParts[2] || '1', 10),
    parseInt(timeParts[0] || '0', 10),
    parseInt(timeParts[1] || '0', 10),
    parseInt(timeParts[2] || '0', 10)
  )
}

const filteredTransactions = computed(() => {
  if (activeFilterCount.value === 0) return transactions.value

  return transactions.value.filter(tx => {
    if (filterCategoryId.value !== null && tx.categoryId !== filterCategoryId.value) return false
    if (filterAccountId.value !== null && tx.fromAccountId !== filterAccountId.value) return false
    if (filterProjectId.value !== null && tx.projectId !== filterProjectId.value) return false
    if (filterVehicleId.value !== null && tx.vehicleId !== filterVehicleId.value) return false
    if (filterDateFrom.value) {
      const txDate = parseLocalDate(tx.transactionDate)
      const from = new Date(filterDateFrom.value + 'T00:00:00')
      if (txDate < from) return false
    }
    if (filterDateTo.value) {
      const txDate = parseLocalDate(tx.transactionDate)
      const to = new Date(filterDateTo.value + 'T23:59:59')
      if (txDate > to) return false
    }
    if (filterDeductibleOnly.value && !tx.hasDeductible) {
      return false
    }
    return true
  })
})

async function fetchFilterData() {
  try {
    const [accountsData, categoriesData, projectsData, vehiclesData] = await Promise.all([
      $fetch<{ accounts: FilterAccount[] }>('/api/accounts'),
      $fetch<{ categories: FilterCategory[] }>('/api/categories'),
      $fetch<{ projects: FilterProject[] }>('/api/projects'),
      $fetch<{ vehicles: FilterVehicle[] }>('/api/vehicles')
    ])
    filterAccounts.value = accountsData.accounts || []
    filterCategories.value = flattenCategories(categoriesData.categories || [])
    filterProjects.value = (projectsData.projects || []).filter((p: any) => p.isActive)
    filterVehicles.value = (vehiclesData.vehicles || []).filter((v: any) => v.isActive)
  } catch (error) {
    console.error('Failed to fetch filter data:', error)
  }
}

// Auto-load more when filters are active and not enough results
const autoLoadingMore = ref(false)

watch([filteredTransactions, hasMore], async () => {
  if (activeFilterCount.value === 0) return
  if (!hasMore.value || autoLoadingMore.value || loadingMore.value || loading.value) return
  if (filteredTransactions.value.length < limit) {
    autoLoadingMore.value = true
    page.value++
    await fetchTransactions(page.value, true)
    autoLoadingMore.value = false
  }
})

// Detail modal
const showDetail = ref(false)
const loadingDetail = ref(false)
const detailError = ref('')
const detailTransaction = ref<TransactionDetail | null>(null)
const detailAttributeValues = ref<{ title: string; value: string; unit?: string; type: string }[]>([])

// Period label mapping
const periodLabels: Record<string, () => string> = {
  future: () => t('transactions.periods.future'),
  today: () => t('transactions.periods.today'),
  yesterday: () => t('transactions.periods.yesterday'),
  thisMonth: () => t('transactions.periods.thisMonth'),
  lastMonth: () => t('transactions.periods.lastMonth'),
  previous: () => t('transactions.periods.previous'),
}

function getPeriodKey(txDate: Date, now: Date, today: Date, yesterday: Date, thisMonthStart: Date, lastMonthStart: Date): string {
  if (txDate > now) return 'future'
  if (txDate >= today) return 'today'
  if (txDate >= yesterday) return 'yesterday'
  if (txDate >= thisMonthStart) return 'thisMonth'
  if (txDate >= lastMonthStart) return 'lastMonth'
  return 'previous'
}

// Group transactions by period
const groupedTransactions = computed(() => {
  const groups: Record<string, TransactionGroup> = {}
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  for (const tx of filteredTransactions.value) {
    const txDate = new Date(tx.transactionDate)
    const periodKey = getPeriodKey(txDate, now, today, yesterday, thisMonthStart, lastMonthStart)

    if (!groups[periodKey]) {
      groups[periodKey] = {
        transactions: [],
        balance: periodBalances.value[periodKey] ?? 0,
        label: periodLabels[periodKey]?.() ?? periodKey,
      }
    }
    groups[periodKey]!.transactions.push(tx)
  }

  return groups
})

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

// Fetch period balances (server-calculated totals for all transactions, not just loaded ones)
async function fetchPeriodBalances() {
  try {
    const result = await $fetch<{ periodBalances: Record<string, number> }>('/api/transactions/period-balances')
    periodBalances.value = result.periodBalances
  } catch (error) {
    console.error('Failed to fetch period balances:', error)
  }
}

// Fetch transactions
async function fetchTransactions(pageNum: number, append = false) {
  if (append) {
    loadingMore.value = true
  } else {
    loading.value = true
  }

  try {
    const result = await $fetch<{
      transactions: Transaction[]
      pagination: { hasMore: boolean }
    }>('/api/transactions/list', {
      query: { page: pageNum, limit }
    })

    if (append) {
      transactions.value.push(...result.transactions)
    } else {
      transactions.value = result.transactions
    }
    hasMore.value = result.pagination.hasMore
  } catch (error) {
    console.error('Failed to fetch transactions:', error)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

// Open detail modal
async function openDetail(txId: number) {
  showDetail.value = true
  loadingDetail.value = true
  detailError.value = ''
  detailTransaction.value = null
  detailAttributeValues.value = []

  try {
    const [txResult, attrValResult, allAttrsResult] = await Promise.all([
      $fetch<{ transaction: TransactionDetail }>(`/api/transactions/${txId}`),
      $fetch<{ values: Record<number, string> }>(`/api/transactions/${txId}/attribute_values`),
      $fetch<{ attributes: any[] }>('/api/category_attributes')
    ])
    detailTransaction.value = txResult.transaction

    const categoryId = txResult.transaction.categoryId
    if (categoryId && attrValResult.values) {
      const attrs = (allAttrsResult.attributes || []).filter((a: any) => a.categoryId === categoryId)
      detailAttributeValues.value = attrs
        .map((a: any) => ({
          title: a.title,
          value: attrValResult.values[a.id] ?? '',
          unit: a.unit || undefined,
          type: a.type
        }))
        .filter(av => av.value !== '')
    }
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
  detailAttributeValues.value = []
}

// Edit transaction - navigate to edit page
const router = useRouter()

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

// Delete transaction
async function deleteTransaction() {
  const tx = detailTransaction.value
  if (!tx) return

  if (!confirm(t('transactions.deleteConfirm'))) return

  try {
    await $fetch(`/api/transactions/${tx.id}`, {
      method: 'DELETE'
    })
    closeDetail()
    // Refresh list and balances
    page.value = 1
    await Promise.all([fetchTransactions(1), fetchPeriodBalances()])
  } catch (error) {
    console.error('Failed to delete transaction:', error)
    alert(t('transactions.deleteError'))
  }
}

// Initial load
onMounted(() => {
  fetchPeriodBalances()
  fetchTransactions(1)
  fetchFilterData()
  setupInfiniteScroll()
})

// Infinite scroll setup
function setupInfiniteScroll() {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && hasMore.value && !loadingMore.value) {
        page.value++
        fetchTransactions(page.value, true)
      }
    },
    { threshold: 0.1 }
  )

  watch(loadMoreRef, (el) => {
    if (el) observer.observe(el)
  })

  onUnmounted(() => observer.disconnect())
}
</script>

<style scoped>
.transactions-page {
  min-height: 100%;
  padding: var(--space-lg);
}

/* Filter bar */
.filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.filter-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: var(--color-bg-glass);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.filter-toggle:hover,
.filter-toggle.active {
  border-color: var(--color-border-focus);
  color: var(--color-accent);
}

.filter-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text-on-accent);
  background: var(--color-accent);
  border-radius: 10px;
}

.filter-clear {
  padding: var(--space-sm) var(--space-md);
  font-family: inherit;
  font-size: 0.8rem;
  color: var(--color-error);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
}

.filter-panel {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  margin-bottom: var(--space-md);
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-sm);
}

.filter-grid .input-group label {
  font-size: 0.75rem;
}

.filter-grid .input-field {
  padding: var(--space-sm) var(--space-md);
  font-size: 0.85rem;
}

.checkbox-group {
  display: flex;
  align-items: flex-end;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--space-sm) 0;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--color-accent);
  cursor: pointer;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  padding: var(--space-xl);
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

.transactions-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding-bottom: var(--space-xl);
}

.load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl);
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.spinner-lg {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: var(--space-md);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* FAB Container */
.fab-container {
  position: fixed;
  bottom: calc(70px + var(--space-lg));
  right: var(--space-lg);
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-sm);
  z-index: 100;
}

.fab {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  text-decoration: none;
  font-size: 1.5rem;
}

.fab-primary {
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary));
  color: var(--color-text-on-accent);
  box-shadow: var(--shadow-glow);
}

.fab-automotive {
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary));
  box-shadow: var(--shadow-glow);
}

.fab:hover {
  transform: scale(1.1);
  box-shadow: var(--shadow-glow);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
