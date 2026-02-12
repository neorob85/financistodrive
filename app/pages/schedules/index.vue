<template>
    <div class="schedules-page">
        <!-- Loading state -->
        <div v-if="loading" class="loading-state">
            <div class="spinner-lg"></div>
            <p>{{ $t('schedules.loadingSchedules') }}</p>
        </div>

        <!-- Empty state -->
        <div v-else-if="schedules.length === 0" class="empty-state">
            <div class="empty-icon">📅</div>
            <h2>{{ $t('schedules.noSchedules') }}</h2>
            <p>{{ $t('schedules.addFirst') }}</p>
        </div>

        <!-- Schedules list -->
        <div v-else class="schedules-list">
            <template v-for="(group, status) in groupedSchedules" :key="status">
                <div class="period-separator">
                    <div class="period-label">{{ status }}</div>
                    <div class="period-stats">
                        <span class="count">{{ group.length }} {{ $t('schedules.schedulesCount') }}</span>
                    </div>
                </div>
                <div v-for="s in group" :key="s.id" class="schedule-card" @click="openDetail(s.id)">
                    <div class="tx-date-col">
                        <div class="tx-date-badge" :class="getType(s)">
                            <span class="tx-day">{{ getDay(s.nextTransactionDate) }}</span>
                            <span class="tx-month">{{ getMonth(s.nextTransactionDate) }}</span>
                            <span class="tx-year">{{ getYear(s.nextTransactionDate) }}</span>
                        </div>
                        <span class="tx-frequency">{{ frequencyLabel(s.frequency) }}</span>
                    </div>
                    <div class="tx-info">
                        <div class="tx-title">{{ s.title }}</div>
                        <div class="tx-meta">
                            <span class="tx-badge">{{ getTime(s.nextTransactionDate) }}</span>
                            <span class="tx-badge">{{ s.fromAccountTitle }}</span>
                            <span v-if="s.categoryTitle" class="tx-category">{{ s.categoryTitle }}</span>
                        </div>
                    </div>
                    <div class="tx-amount" :class="getType(s)">
                        {{ formatAmount(s.amountFrom) }}
                    </div>
                </div>
            </template>
        </div>

        <!-- Detail Modal -->
        <div v-if="showDetail" class="modal-overlay" @click.self="closeDetail">
            <div class="modal glass-card detail-modal">
                <div class="modal-header">
                    <div class="modal-actions-left">
                        <button class="action-btn edit-btn" @click.stop="editSchedule" :title="$t('common.edit')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                        </button>
                        <button class="action-btn delete-btn" @click.stop="deleteSchedule" :title="$t('common.delete')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path
                                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                        </button>
                    </div>
                    <h2>{{ $t('schedules.scheduleDetails') }}</h2>
                    <button class="close-btn" @click="closeDetail">&times;</button>
                </div>

                <div v-if="loadingDetail" class="loading-detail">
                    <div class="spinner"></div>
                </div>

                <div v-else-if="detailError" class="detail-error">
                    <div class="error-icon">⚠️</div>
                    <p>{{ detailError }}</p>
                    <button class="btn btn-secondary" @click="closeDetail">{{ $t('common.close') }}</button>
                </div>

                <div v-else-if="detail" class="detail-content">
                    <!-- Type Badge -->
                    <div class="type-badge" :class="detail.transactionType">
                        <span v-if="detail.transactionType === 'income'">📈 {{ $t('transactions.income') }}</span>
                        <span v-else-if="detail.transactionType === 'expense'">📉 {{ $t('transactions.expense') }}</span>
                        <span v-else-if="detail.transactionType === 'transfer'">🔄 {{ $t('transactions.transfer') }}</span>
                    </div>

                    <!-- Status Badge -->
                    <div class="status-badge" :class="detail.isActive ? 'active' : 'inactive'">
                        {{ detail.isActive ? $t('schedules.activeStatus') : $t('schedules.inactiveStatus') }}
                    </div>

                    <!-- Amount -->
                    <div class="main-amount" :class="detail.transactionType">
                        {{ formatAmount(detail.amountFrom, detail.currencySymbol) }}
                    </div>

                    <!-- Title -->
                    <h3 class="detail-title">{{ detail.title }}</h3>

                    <!-- Next cycle countdown -->
                    <div class="countdown-section">
                        <div class="countdown-label">{{ $t('schedules.nextExecution') }}</div>
                        <div class="countdown-date">{{ formatFullDate(detail.nextTransactionDate) }}</div>
                        <div class="countdown-remaining" :class="countdownClass">
                            {{ countdownText }}
                        </div>
                    </div>

                    <!-- Details Grid -->
                    <div class="details-grid">
                        <div class="detail-row">
                            <span class="label">{{ $t('schedules.frequency') }}</span>
                            <span class="value">{{ frequencyLabel(detail.frequency) }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">{{ $t('schedules.fromAccount') }}</span>
                            <span class="value">{{ detail.fromAccountTitle }}</span>
                        </div>
                        <div v-if="detail.toAccountId" class="detail-row">
                            <span class="label">{{ $t('schedules.toAccount') }}</span>
                            <span class="value">{{ detail.toAccountTitle }}</span>
                        </div>
                        <div v-if="detail.categoryTitle" class="detail-row">
                            <span class="label">{{ $t('transactions.category') }}</span>
                            <span class="value">{{ detail.categoryTitle }}</span>
                        </div>
                        <div v-if="detail.payeeTitle" class="detail-row">
                            <span class="label">{{ $t('transactions.payee') }}</span>
                            <span class="value">{{ detail.payeeTitle }}</span>
                        </div>
                        <div v-if="detail.projectTitle" class="detail-row">
                            <span class="label">{{ $t('transactions.project') }}</span>
                            <span class="value">{{ detail.projectTitle }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">{{ $t('schedules.startDate') }}</span>
                            <span class="value">{{ formatShortDate(detail.startDate) }}</span>
                        </div>
                        <div v-if="detail.endDate" class="detail-row">
                            <span class="label">{{ $t('schedules.endDate') }}</span>
                            <span class="value">{{ formatShortDate(detail.endDate) }}</span>
                        </div>
                        <div v-if="detail.isAutomotive" class="detail-row">
                            <span class="label">{{ $t('transactions.type') }}</span>
                            <span class="value automotive-badge">🚗 {{ $t('transactions.automotive') }}</span>
                        </div>
                    </div>

                    <!-- Notes -->
                    <div v-if="detail.notes" class="notes-section">
                        <h4>{{ $t('common.notes') }}</h4>
                        <p>{{ detail.notes }}</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- FAB -->
        <NuxtLink to="/schedules/new" class="fab fab-primary">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
        </NuxtLink>
    </div>
</template>

<script setup lang="ts">
definePageMeta({
    layout: 'default'
})

const { t, locale } = useI18n()

interface Schedule {
    id: number
    title: string
    amountFrom: number
    amountTo: number | null
    fromAccountId: number
    fromAccountTitle: string
    toAccountId: number | null
    toAccountTitle: string | null
    categoryId: number | null
    categoryTitle: string | null
    frequency: string
    nextTransactionDate: string
    startDate: string
    endDate: string | null
    isTransfer: boolean
    isAutomotive: boolean
    isActive: boolean
}

interface ScheduleDetail extends Schedule {
    projectId: number | null
    projectTitle: string | null
    payeeId: number | null
    payeeTitle: string | null
    currencyId: number
    currencyCode: string
    currencySymbol: string
    notes: string | null
    transactionType: 'income' | 'expense' | 'transfer'
}

const router = useRouter()

const schedules = ref<Schedule[]>([])
const loading = ref(true)

const showDetail = ref(false)
const loadingDetail = ref(false)
const detailError = ref('')
const detail = ref<ScheduleDetail | null>(null)

const groupedSchedules = computed(() => {
    const groups: Record<string, Schedule[]> = {}
    for (const s of schedules.value) {
        const label = s.isActive ? t('schedules.active') : t('schedules.inactive')
        if (!groups[label]) groups[label] = []
        groups[label].push(s)
    }
    return groups
})

function getType(s: Schedule): 'income' | 'expense' | 'transfer' {
    if (s.isTransfer) return 'transfer'
    return s.amountFrom < 0 ? 'expense' : 'income'
}

function formatAmount(amount: number, symbol: string = '€') {
    const sign = amount < 0 ? '-' : '+'
    return `${sign}${symbol}${Math.abs(amount).toFixed(2)}`
}

function formatShortDate(dateStr: string) {
    const date = new Date(dateStr)
    return date.toLocaleDateString(locale.value, { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatFullDate(dateStr: string) {
    const date = new Date(dateStr)
    const datePart = date.toLocaleDateString(locale.value, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
    const timePart = date.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
    return `${datePart} ${t('schedules.atTime')} ${timePart}`
}

function getDay(dateStr: string) {
    return new Date(dateStr).getDate()
}

function getMonth(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(locale.value, { month: 'short' }).replace('.', '').toUpperCase()
}

function getYear(dateStr: string) {
    return String(new Date(dateStr).getFullYear())
}

function getTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
}

function frequencyLabel(freq: string) {
    const map: Record<string, string> = {
        'DAILY': t('schedules.daily'),
        'WEEKLY': t('schedules.weekly'),
        'BIWEEKLY': t('schedules.biweekly'),
        'MONTHLY': t('schedules.monthly'),
        'BIMONTHLY': t('schedules.bimonthly'),
        'QUARTERLY': t('schedules.quarterly'),
        'SEMIANNUAL': t('schedules.semiannual'),
        'YEARLY': t('schedules.yearly')
    }
    return map[freq] || freq
}

function calendarDayDiff(now: Date, target: Date): number {
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate())
    return Math.round((targetDay.getTime() - nowDay.getTime()) / (1000 * 60 * 60 * 24))
}

const countdownText = computed(() => {
    if (!detail.value) return ''
    const now = new Date()
    const next = new Date(detail.value.nextTransactionDate)
    const diffDays = calendarDayDiff(now, next)

    if (diffDays < 0) return t('schedules.overdueDays', { days: Math.abs(diffDays) })
    if (diffDays === 0) return t('schedules.today')
    if (diffDays === 1) return t('schedules.tomorrow')
    return t('schedules.inDays', { days: diffDays })
})

const countdownClass = computed(() => {
    if (!detail.value) return ''
    const now = new Date()
    const next = new Date(detail.value.nextTransactionDate)
    const diffDays = calendarDayDiff(now, next)

    if (diffDays < 0) return 'overdue'
    if (diffDays <= 3) return 'soon'
    return 'normal'
})

async function fetchSchedules() {
    loading.value = true
    try {
        const data = await $fetch<{ schedules: Schedule[] }>('/api/schedules')
        schedules.value = data.schedules
    } catch (error) {
        console.error('Failed to fetch schedules:', error)
    } finally {
        loading.value = false
    }
}

async function openDetail(id: number) {
    showDetail.value = true
    loadingDetail.value = true
    detailError.value = ''
    detail.value = null

    try {
        const data = await $fetch<{ schedule: ScheduleDetail }>(`/api/schedules/${id}`)
        detail.value = data.schedule
    } catch (error: any) {
        detailError.value = error?.data?.message || t('schedules.loadError')
    } finally {
        loadingDetail.value = false
    }
}

function closeDetail() {
    showDetail.value = false
    detail.value = null
}

function editSchedule() {
    if (detail.value) {
        const id = detail.value.id
        closeDetail()
        router.push(`/schedules/${id}/edit`)
    }
}

async function deleteSchedule() {
    if (!detail.value) return
    if (!confirm(t('schedules.deleteConfirm'))) return

    try {
        await $fetch(`/api/schedules/${detail.value.id}`, { method: 'DELETE' })
        closeDetail()
        await fetchSchedules()
    } catch (error) {
        console.error('Failed to delete schedule:', error)
        alert(t('schedules.deleteError'))
    }
}

onMounted(() => fetchSchedules())
</script>

<style scoped>
.schedules-page {
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

.schedules-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding-bottom: var(--space-xl);
}

/* Period separator */
.period-separator {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) 0;
    margin-top: var(--space-md);
}

.period-separator:first-child {
    margin-top: 0;
}

.period-label {
    font-weight: 600;
    font-size: 1rem;
    color: var(--color-text-secondary);
}

.period-stats {
    font-size: 0.8rem;
}

.count {
    color: var(--color-text-muted);
}

/* Schedule card - glass-card style */
.schedule-card {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: var(--color-bg-card);
    backdrop-filter: blur(20px);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
}

.schedule-card:hover {
    transform: translateX(4px);
    box-shadow: var(--shadow-lg);
}

.tx-date-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
}

.tx-date-badge {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    line-height: 1;
}

.tx-date-badge.income {
    background: var(--color-success-bg);
    color: var(--color-success);
}

.tx-date-badge.expense {
    background: var(--color-error-bg);
    color: var(--color-error);
}

.tx-date-badge.transfer {
    background: var(--color-bg-glass);
    color: var(--color-text-secondary);
}

.tx-day {
    font-size: 1.1rem;
    font-weight: 700;
    line-height: 1;
}

.tx-month {
    font-size: 0.55rem;
    font-weight: 600;
    letter-spacing: 0.5px;
    line-height: 1;
    margin-top: 1px;
}

.tx-year {
    font-size: 0.5rem;
    font-weight: 500;
    line-height: 1;
    opacity: 0.7;
}

.tx-info {
    flex: 1;
    min-width: 0;
}

.tx-title {
    font-weight: 500;
    font-size: 0.95rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 4px;
}

.tx-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    font-size: 0.75rem;
    color: var(--color-text-muted);
}

.tx-badge {
    background: var(--color-bg-glass);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    white-space: nowrap;
}

.tx-category {
    background: var(--color-bg-glass);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
}

.tx-frequency {
    background: var(--color-accent-bg);
    color: var(--color-accent);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    font-size: 0.55rem;
    font-weight: 600;
    white-space: nowrap;
    text-align: center;
}

.tx-amount {
    font-weight: 600;
    font-size: 1rem;
    white-space: nowrap;
}

.tx-amount.income {
    color: var(--color-success);
}

.tx-amount.expense {
    color: var(--color-error);
}

.tx-amount.transfer {
    color: var(--color-text-secondary);
}

/* FAB */
.fab {
    position: fixed;
    bottom: calc(70px + var(--space-lg));
    right: var(--space-lg);
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
    z-index: 50;
}

.fab-primary {
    background: linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary));
    color: var(--color-text-on-accent);
    box-shadow: var(--shadow-glow);
}

.fab:hover {
    transform: scale(1.1);
    box-shadow: var(--shadow-glow);
}

/* Spinners */
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

.modal-header h2 {
    font-size: 1.1rem;
    font-weight: 600;
}

.modal-actions-left {
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

.detail-content {
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

.status-badge {
    align-self: flex-start;
    padding: var(--space-xs) var(--space-md);
    border-radius: var(--radius-lg);
    font-size: 0.75rem;
    font-weight: 500;
}

.status-badge.active {
    background: var(--color-success-bg);
    color: var(--color-success);
}

.status-badge.inactive {
    background: var(--color-bg-glass);
    color: var(--color-text-muted);
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

.main-amount.transfer {
    color: var(--color-text-primary);
}

.detail-title {
    text-align: center;
    font-size: 1.1rem;
    font-weight: 600;
}

/* Countdown */
.countdown-section {
    text-align: center;
    padding: var(--space-md);
    background: var(--color-bg-elevated);
    border-radius: var(--radius-md);
}

.countdown-label {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-bottom: var(--space-xs);
}

.countdown-date {
    font-size: 0.95rem;
    font-weight: 500;
    text-transform: capitalize;
    margin-bottom: var(--space-xs);
}

.countdown-remaining {
    font-size: 1.1rem;
    font-weight: 700;
}

.countdown-remaining.normal {
    color: var(--color-accent);
}

.countdown-remaining.soon {
    color: var(--color-warning);
}

.countdown-remaining.overdue {
    color: var(--color-error);
}

/* Details grid */
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

.automotive-badge {
    padding: 2px 8px;
    background: var(--color-accent-bg);
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
}

.notes-section {
    padding-top: var(--space-md);
    border-top: 1px solid var(--color-border);
}

.notes-section h4 {
    font-size: 0.9rem;
    font-weight: 600;
    margin-bottom: var(--space-sm);
    color: var(--color-text-secondary);
}

.notes-section p {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    white-space: pre-wrap;
}

.btn {
    padding: var(--space-sm) var(--space-lg);
    border-radius: var(--radius-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
    font-size: 0.9rem;
}

.btn-secondary {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
}

@media (max-width: 400px) {
    .tx-meta {
        font-size: 0.7rem;
    }

    .tx-amount {
        font-size: 0.9rem;
    }

    .period-label {
        font-size: 0.85rem;
    }
}
</style>
