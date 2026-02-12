<template>
    <div class="transactions-page">
        <div class="page-header">
            <button class="back-btn" @click="router.back()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="15 18 9 12 15 6" />
                </svg>
            </button>
            <div v-if="account" class="header-content">
                <h1>{{ account.title }}</h1>
                <div class="balance" :class="{ negative: account.actualAmount < 0 }">
                    {{ account.currencySymbol }} {{ formatAmount(account.actualAmount) }}
                </div>
            </div>
            <div v-else class="header-skeleton">
                <div class="skeleton-title"></div>
                <div class="skeleton-balance"></div>
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

        <!-- Transactions list -->
        <div v-else class="transactions-list" ref="listRef">
            <template v-for="(group, period) in groupedTransactions" :key="period">
                <PeriodSeparator :label="period" :count="group.transactions.length" :balance="group.balance" />
                <TransactionCard v-for="tx in group.transactions" :key="tx.id" :transaction="tx"
                    @click="openDetail(tx.id)" />
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
    </div>
</template>

<script setup lang="ts">
definePageMeta({
    layout: 'default'
})

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()

const accountId = Number(route.params.id)

// Types (simplified re-declaration or imported if available centrally)
interface Account {
    id: number
    title: string
    actualAmount: number
    currencySymbol: string
    accountType: string
}

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
    children: any[]
    attachments: any[]
    fuelLog?: any
    maintenanceLogs?: any[]
}

interface TransactionGroup {
    transactions: Transaction[]
    balance: number
}

// State
const account = ref<Account | null>(null)
const transactions = ref<Transaction[]>([])
const loading = ref(true)
const loadingMore = ref(false)
const hasMore = ref(true)
const page = ref(1)
const limit = 20
const listRef = ref<HTMLElement | null>(null)
const loadMoreRef = ref<HTMLElement | null>(null)

// Detail modal state
const showDetail = ref(false)
const loadingDetail = ref(false)
const detailError = ref('')
const detailTransaction = ref<TransactionDetail | null>(null)

// Derived state
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

// Formatting
function formatAmount(amount: number, symbol: string = '') {
    // If symbol provided in args use it, else if account present use account symbol
    const sym = symbol || (account.value?.currencySymbol || '€')
    return Math.abs(amount).toLocaleString(locale.value, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })
}

// API Calls
async function loadAccount() {
    try {
        const data = await $fetch<{ accounts: Account[] }>('/api/accounts')
        account.value = data.accounts.find((a: Account) => a.id === accountId) || null
        if (!account.value) {
            // Handle not found?
            console.warn('Account not found')
        }
    } catch (error) {
        console.error('Failed to load account:', error)
    }
}

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
            query: { page: pageNum, limit, accountId }
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

function editTransaction(tx: TransactionDetail) {
    if (!tx) return
    const txId = tx.id
    const isAutomotive = tx.isAutomotive
    const hasFuelLog = !!tx.fuelLog
    const hasMaintenanceLogs = tx.maintenanceLogs && tx.maintenanceLogs.length > 0

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

async function deleteTransaction(tx: TransactionDetail) {
    if (!tx) return
    if (!confirm(t('transactions.deleteConfirm'))) return

    try {
        await $fetch(`/api/transactions/${tx.id}`, {
            method: 'DELETE'
        })
        closeDetail()
        // Refresh list and account balance
        page.value = 1
        await Promise.all([
            fetchTransactions(1),
            loadAccount()
        ])
    } catch (error) {
        console.error('Failed to delete transaction:', error)
        alert(t('transactions.deleteError'))
    }
}

// Lifecycle
onMounted(async () => {
    await Promise.all([
        loadAccount(),
        fetchTransactions(1)
    ])
    setupInfiniteScroll()
})

// Infinite scroll
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

.page-header {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    margin-bottom: var(--space-xl);
}

.back-btn {
    background: var(--color-bg-elevated);
    border: none;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--color-text-primary);
    transition: background 0.2s;
}

.back-btn:hover {
    background: var(--color-bg-glass);
}

.header-content {
    flex: 1;
}

.header-content h1 {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.2;
}

.balance {
    font-size: 1.1rem;
    color: var(--color-success);
    font-weight: 600;
}

.balance.negative {
    color: var(--color-error);
}

.loading-state,
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
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

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
