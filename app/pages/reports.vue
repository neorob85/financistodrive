<template>
    <div class="reports-page">
        <header class="page-header">
            <h1>📊 {{ $t('reports.title') }}</h1>
        </header>

        <!-- Period selector -->
        <div class="period-selector">
            <button v-for="p in periods" :key="p.key" class="period-btn" :class="{ active: selectedPeriod === p.key }"
                @click="selectPeriod(p.key)">
                {{ p.label }}
            </button>
        </div>

        <!-- Custom date range -->
        <div v-if="selectedPeriod === 'custom'" class="custom-range glass-card">
            <div class="date-field">
                <label>{{ $t('reports.from') }}</label>
                <input type="date" v-model="customFrom" @change="fetchReport" />
            </div>
            <div class="date-field">
                <label>{{ $t('reports.to') }}</label>
                <input type="date" v-model="customTo" @change="fetchReport" />
            </div>
        </div>

        <!-- Period label -->
        <div class="period-label">{{ periodDescription }}</div>

        <!-- Loading -->
        <div v-if="loading" class="loading-state">
            <div class="spinner-lg"></div>
        </div>

        <!-- Empty -->
        <div v-else-if="categories.length === 0" class="empty-state">
            <div class="empty-icon">📭</div>
            <p>{{ $t('reports.noTransactions') }}</p>
        </div>

        <!-- Report content -->
        <div v-else class="report-content">
            <!-- Totals summary -->
            <div class="totals-section glass-card">
                <div class="total-row">
                    <span class="total-label">{{ $t('reports.income') }}</span>
                    <span class="total-value income">+€{{ formatAmount(totals.income) }}</span>
                </div>
                <div class="total-row">
                    <span class="total-label">{{ $t('reports.expenses') }}</span>
                    <span class="total-value expense">-€{{ formatAmount(totals.expenses) }}</span>
                </div>
                <div class="total-row total-balance">
                    <span class="total-label">{{ $t('reports.balance') }}</span>
                    <span class="total-value" :class="totals.balance >= 0 ? 'income' : 'expense'">
                        {{ totals.balance >= 0 ? '+' : '-' }}€{{ formatAmount(Math.abs(totals.balance)) }}
                    </span>
                </div>
            </div>

            <!-- Expense bar chart -->
            <div v-if="maxExpense > 0" class="chart-section glass-card">
                <h3 class="section-title">{{ $t('reports.expensesByCategory') }}</h3>
                <div class="bar-chart">
                    <div v-for="cat in sortedByExpenses" :key="cat.categoryId" class="bar-row">
                        <div class="bar-label">{{ cat.categoryTitle }}</div>
                        <div class="bar-track">
                            <div class="bar-fill" :style="{ width: (cat.expenses / maxExpense * 100) + '%' }"></div>
                        </div>
                        <div class="bar-value">€{{ formatAmount(cat.expenses) }}</div>
                    </div>
                </div>
            </div>

            <!-- Category details table -->
            <div class="details-section glass-card">
                <h3 class="section-title">{{ $t('reports.categoryDetails') }}</h3>
                <div class="category-list">
                    <div class="category-header">
                        <span class="cat-name">{{ $t('reports.category') }}</span>
                        <span class="cat-amount">{{ $t('reports.expenses') }}</span>
                        <span class="cat-amount">{{ $t('reports.income') }}</span>
                        <span class="cat-amount">{{ $t('reports.balance') }}</span>
                    </div>
                    <div v-for="cat in categories" :key="cat.categoryId" class="category-row">
                        <span class="cat-name">{{ cat.categoryTitle }}</span>
                        <span class="cat-amount expense">{{ cat.expenses > 0 ? '-€' + formatAmount(cat.expenses) : '—'
                            }}</span>
                        <span class="cat-amount income">{{ cat.income > 0 ? '+€' + formatAmount(cat.income) : '—'
                            }}</span>
                        <span class="cat-amount" :class="cat.balance >= 0 ? 'income' : 'expense'">
                            {{ cat.balance !== 0 ? (cat.balance >= 0 ? '+' : '-') + '€' +
                                formatAmount(Math.abs(cat.balance)) : '—' }}
                        </span>
                    </div>
                    <!-- Total row -->
                    <div class="category-row total-category-row">
                        <span class="cat-name">{{ $t('reports.total') }}</span>
                        <span class="cat-amount expense">-€{{ formatAmount(totals.expenses) }}</span>
                        <span class="cat-amount income">+€{{ formatAmount(totals.income) }}</span>
                        <span class="cat-amount" :class="totals.balance >= 0 ? 'income' : 'expense'">
                            {{ totals.balance >= 0 ? '+' : '-' }}€{{ formatAmount(Math.abs(totals.balance)) }}
                        </span>
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

interface CategoryReport {
    categoryId: number
    categoryTitle: string
    expenses: number
    income: number
    balance: number
}

interface Totals {
    expenses: number
    income: number
    balance: number
}

const loading = ref(true)
const categories = ref<CategoryReport[]>([])
const totals = ref<Totals>({ expenses: 0, income: 0, balance: 0 })

const selectedPeriod = ref('this_month')
const customFrom = ref('')
const customTo = ref('')

const periods = computed(() => [
    { key: 'this_month', label: t('reports.thisMonth') },
    { key: 'last_month', label: t('reports.lastMonth') },
    { key: 'this_year', label: t('reports.thisYear') },
    { key: 'last_year', label: t('reports.lastYear') },
    { key: 'custom', label: t('reports.custom') }
])

function getDateRange(period: string): { from: string, to: string } {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()

    switch (period) {
        case 'this_month': {
            const from = new Date(year, month, 1)
            const to = new Date(year, month + 1, 1)
            return { from: formatDate(from), to: formatDate(to) }
        }
        case 'last_month': {
            const from = new Date(year, month - 1, 1)
            const to = new Date(year, month, 1)
            return { from: formatDate(from), to: formatDate(to) }
        }
        case 'this_year': {
            const from = new Date(year, 0, 1)
            const to = new Date(year + 1, 0, 1)
            return { from: formatDate(from), to: formatDate(to) }
        }
        case 'last_year': {
            const from = new Date(year - 1, 0, 1)
            const to = new Date(year, 0, 1)
            return { from: formatDate(from), to: formatDate(to) }
        }
        case 'custom':
            return {
                from: customFrom.value || formatDate(new Date(year, month, 1)),
                to: customTo.value || formatDate(new Date(year, month + 1, 1))
            }
        default:
            return { from: formatDate(new Date(year, month, 1)), to: formatDate(new Date(year, month + 1, 1)) }
    }
}

function formatDate(d: Date): string {
    return d.toISOString().split('T')[0] || ''
}

function formatAmount(n: number): string {
    return n.toLocaleString(locale.value, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })
}

const periodDescription = computed(() => {
    const { from, to } = getDateRange(selectedPeriod.value)
    const fromDate = new Date(from)
    const toDate = new Date(to)
    toDate.setDate(toDate.getDate() - 1) // show inclusive end
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
    return `${fromDate.toLocaleDateString(locale.value, opts)} — ${toDate.toLocaleDateString(locale.value, opts)}`
})

const sortedByExpenses = computed(() => {
    return [...categories.value].filter(c => c.expenses > 0).sort((a, b) => b.expenses - a.expenses)
})

const maxExpense = computed(() => {
    if (sortedByExpenses.value.length === 0) return 0
    return sortedByExpenses.value[0]!.expenses
})

function selectPeriod(key: string) {
    selectedPeriod.value = key
    if (key !== 'custom') {
        fetchReport()
    }
}

async function fetchReport() {
    loading.value = true
    const { from, to } = getDateRange(selectedPeriod.value)
    try {
        const data = await $fetch<{ categories: CategoryReport[], totals: Totals }>('/api/reports/categories', {
            query: { from, to }
        })
        categories.value = data.categories
        totals.value = data.totals
    } catch (error) {
        console.error('Failed to fetch report:', error)
        categories.value = []
        totals.value = { expenses: 0, income: 0, balance: 0 }
    } finally {
        loading.value = false
    }
}

onMounted(() => {
    fetchReport()
})
</script>

<style scoped>
.reports-page {
    min-height: 100%;
    padding: var(--space-lg);
    max-width: 900px;
    margin: 0 auto;
}

.page-header {
    margin-bottom: var(--space-lg);
}

.page-header h1 {
    font-size: 1.3rem;
    font-weight: 700;
}

/* Period selector */
.period-selector {
    display: flex;
    gap: var(--space-xs);
    overflow-x: auto;
    padding-bottom: var(--space-sm);
    margin-bottom: var(--space-md);
    -webkit-overflow-scrolling: touch;
}

.period-btn {
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
    background: var(--color-bg-card);
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
    transition: all 0.2s;
}

.period-btn:hover {
    border-color: var(--color-border-focus);
    background: var(--color-bg-hover);
}

.period-btn.active {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-text-on-accent);
}

/* Custom date range */
.custom-range {
    display: flex;
    gap: var(--space-lg);
    padding: var(--space-md) var(--space-lg);
    margin-bottom: var(--space-md);
}

.date-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    flex: 1;
}

.date-field label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.date-field input {
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-glass);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: 0.9rem;
}

.date-field input:focus {
    outline: none;
    border-color: var(--color-accent);
}

/* Period label */
.period-label {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    margin-bottom: var(--space-lg);
}

/* Loading / empty */
.loading-state,
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 40vh;
    gap: var(--space-md);
    color: var(--color-text-muted);
}

.empty-icon {
    font-size: 3rem;
}

.spinner-lg {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

/* Report content */
.report-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
}

/* Totals section */
.totals-section {
    padding: var(--space-lg);
}

.total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) 0;
}

.total-row+.total-row {
    border-top: 1px solid var(--color-border);
}

.total-label {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
}

.total-value {
    font-size: 1rem;
    font-weight: 600;
}

.total-balance {
    margin-top: var(--space-xs);
}

.total-balance .total-label {
    font-weight: 600;
    color: var(--color-text-primary);
}

.total-balance .total-value {
    font-size: 1.1rem;
}

.income {
    color: var(--color-success);
}

.expense {
    color: var(--color-error);
}

/* Bar chart */
.chart-section {
    padding: var(--space-lg);
}

.section-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: var(--space-md);
}

.bar-chart {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.bar-row {
    display: flex;
    align-items: center;
    gap: var(--space-md);
}

.bar-label {
    width: 120px;
    font-size: 0.82rem;
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
}

.bar-track {
    flex: 1;
    height: 20px;
    background: var(--color-bg-elevated);
    border-radius: var(--radius-sm);
    overflow: hidden;
}

.bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-error), var(--color-error-bg));
    border-radius: var(--radius-sm);
    transition: width 0.4s ease;
    min-width: 2px;
}

.bar-value {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-error);
    min-width: 70px;
    text-align: right;
    white-space: nowrap;
}

/* Category details table */
.details-section {
    padding: var(--space-lg);
}

.category-list {
    display: flex;
    flex-direction: column;
}

.category-header,
.category-row {
    display: grid;
    grid-template-columns: 1fr repeat(3, 90px);
    gap: var(--space-sm);
    padding: var(--space-sm) 0;
    align-items: center;
}

.category-header {
    border-bottom: 2px solid var(--color-border);
    margin-bottom: var(--space-xs);
}

.category-header .cat-name,
.category-header .cat-amount {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.category-row+.category-row {
    border-top: 1px solid var(--color-border);
}

.cat-name {
    font-size: 0.88rem;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.cat-amount {
    font-size: 0.85rem;
    font-weight: 500;
    text-align: right;
}

.total-category-row {
    border-top: 2px solid var(--color-border) !important;
    margin-top: var(--space-xs);
}

.total-category-row .cat-name {
    font-weight: 700;
}

.total-category-row .cat-amount {
    font-weight: 700;
}

@media (max-width: 600px) {
    .reports-page {
        padding: var(--space-md);
    }

    .custom-range {
        flex-direction: column;
        gap: var(--space-md);
    }

    .category-header,
    .category-row {
        grid-template-columns: 1fr repeat(3, 75px);
        gap: var(--space-xs);
    }

    .bar-label {
        width: 80px;
        font-size: 0.75rem;
    }

    .bar-value {
        min-width: 55px;
        font-size: 0.75rem;
    }
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
