<template>
  <div class="transactions-page">
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

    <!-- Transactions list -->
    <div v-else class="transactions-list" ref="listRef">
      <template v-for="(group, period) in groupedTransactions" :key="period">
        <PeriodSeparator :label="period" :count="group.transactions.length" :balance="group.balance" />
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
      :transaction="detailTransaction" @close="closeDetail" @edit="editTransaction" @delete="deleteTransaction" />


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

const { t } = useI18n()

interface Transaction {
  id: number
  title: string
  amountFrom: number
  amountTo?: number | null
  transactionDate: string
  toAccountId?: number
  categoryTitle?: string
  accountTitle: string
  balanceAmount: number
  vehicleName?: string | null
  odometer?: number | null
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

interface TransactionGroup {
  transactions: Transaction[]
  balance: number
}

const transactions = ref<Transaction[]>([])
const loading = ref(true)
const loadingMore = ref(false)
const hasMore = ref(true)
const page = ref(1)
const limit = 20

const listRef = ref<HTMLElement | null>(null)
const loadMoreRef = ref<HTMLElement | null>(null)

// Detail modal
const showDetail = ref(false)
const loadingDetail = ref(false)
const detailError = ref('')
const detailTransaction = ref<TransactionDetail | null>(null)

// Group transactions by period
const groupedTransactions = computed(() => {
  const groups: Record<string, TransactionGroup> = {}
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  for (const tx of transactions.value) {
    const txDate = new Date(tx.transactionDate)
    let period: string

    if (txDate > now) {
      period = t('transactions.periods.future')
    } else if (txDate >= today) {
      period = t('transactions.periods.today')
    } else if (txDate >= yesterday) {
      period = t('transactions.periods.yesterday')
    } else if (txDate >= thisMonthStart) {
      period = t('transactions.periods.thisMonth')
    } else if (txDate >= lastMonthStart) {
      period = t('transactions.periods.lastMonth')
    } else {
      period = t('transactions.periods.previous')
    }

    if (!groups[period]) {
      groups[period] = { transactions: [], balance: 0 }
    }
    const group = groups[period]!
    group.transactions.push(tx)
    group.balance += tx.balanceAmount
  }

  return groups
})

function formatAmount(amount: number, symbol: string = '€') {
  const sign = amount < 0 ? '-' : '+'
  return `${sign}${symbol}${Math.abs(amount).toFixed(2)}`
}

function formatFullDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('it-IT', {
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
    // Refresh list
    page.value = 1
    await fetchTransactions(1)
  } catch (error) {
    console.error('Failed to delete transaction:', error)
    alert(t('transactions.deleteError'))
  }
}

// Initial load
onMounted(() => {
  fetchTransactions(1)
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
  color: white;
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
