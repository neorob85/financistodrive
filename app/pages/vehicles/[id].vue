<template>
    <div class="vehicle-detail-page">
        <header class="page-header">
            <button class="back-btn" @click="goBack">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
            </button>
            <h1 v-if="vehicle">{{ vehicle.brand }} {{ vehicle.model }}</h1>
            <h1 v-else>{{ $t('vehicles.detail') }}</h1>
            <div class="header-spacer"></div>
        </header>

        <div v-if="loading" class="loading-state">
            <div class="spinner-lg"></div>
        </div>

        <div v-else-if="loadError" class="error-state">
            <p>{{ loadError }}</p>
            <button class="btn btn-secondary" @click="goBack">{{ $t('vehicles.goBack') }}</button>
        </div>

        <div v-else-if="vehicle" class="detail-content">
            <!-- Vehicle info -->
            <div class="info-section glass-card">
                <div class="vehicle-title-row">
                    <span class="vehicle-icon">🚗</span>
                    <div>
                        <h2 class="vehicle-name">{{ vehicle.brand }} {{ vehicle.model }}</h2>
                        <span v-if="vehicle.licensePlate" class="vehicle-plate">{{ vehicle.licensePlate }}</span>
                    </div>
                    <div class="title-badges">
                        <span v-if="vehicle.alertsOverdue > 0" class="alert-badge overdue">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2">
                                <path
                                    d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                            </svg>
                            {{ vehicle.alertsOverdue }} {{ $t('vehicles.overdue') }}
                        </span>
                        <span v-if="vehicle.alertsUpcoming > 0" class="alert-badge upcoming">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2">
                                <path
                                    d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                            </svg>
                            {{ vehicle.alertsUpcoming }} {{ $t('vehicles.upcoming') }}
                        </span>
                    </div>
                </div>
                <div class="info-tags">
                    <span v-if="vehicle.year" class="info-tag">📅 {{ vehicle.year }}</span>
                    <span v-if="vehicle.fuelName" class="info-tag">⛽ {{ vehicle.fuelName }}</span>
                    <span v-if="!vehicle.isActive" class="info-tag inactive-tag">{{ $t('common.inactive') }}</span>
                </div>
            </div>

            <!-- Stats cards grid -->
            <div class="stats-grid">
                <div class="stats-section glass-card">
                    <h3 class="section-title">{{ $t('vehicles.mileageSection') }}</h3>
                    <div class="stat-row">
                        <span class="stat-label">{{ $t('vehicles.currentMileage') }}</span>
                        <span class="stat-value">{{ vehicle.currentMileage ? formatNumber(vehicle.currentMileage) + ' km' : '—' }}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">{{ $t('vehicles.kmDriven') }}</span>
                        <span class="stat-value">{{ vehicle.kmDriven > 0 ? formatNumber(vehicle.kmDriven) + ' km' : '—'
                            }}</span>
                    </div>
                </div>

                <div class="stats-section glass-card">
                    <h3 class="section-title">{{ $t('vehicles.consumptionSection') }}</h3>
                    <div class="stat-row">
                        <span class="stat-label">{{ $t('vehicles.avgConsumption') }}</span>
                        <span class="stat-value">{{ vehicle.avgConsumption != null ? vehicle.avgConsumption + ' km/L' :
                            '—' }}</span>
                    </div>
                </div>

                <div class="stats-section glass-card">
                    <h3 class="section-title">{{ $t('vehicles.costsSection') }}</h3>
                    <div class="stat-row">
                        <span class="stat-label">{{ $t('vehicles.fuelCost') }}</span>
                        <span class="stat-value">€ {{ formatAmount(vehicle.totalFuelCost) }}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">{{ $t('vehicles.maintenanceCost') }}</span>
                        <span class="stat-value">€ {{ formatAmount(vehicle.totalMaintenanceCost) }}</span>
                    </div>
                    <div v-if="vehicle.purchasePrice > 0" class="stat-row">
                        <span class="stat-label">{{ $t('vehicles.purchasePrice') }}</span>
                        <span class="stat-value">€ {{ formatAmount(vehicle.purchasePrice) }}</span>
                    </div>
                    <div class="stat-row total-row">
                        <span class="stat-label">{{ $t('common.total') }}</span>
                        <span class="stat-value">€ {{ formatAmount(vehicle.totalCost) }}</span>
                    </div>
                </div>

                <div class="stats-section glass-card">
                    <h3 class="section-title">{{ $t('vehicles.costPerKmSection') }}</h3>
                    <div class="stat-row">
                        <span class="stat-label">{{ $t('vehicles.runningCost') }}</span>
                        <span class="stat-value">{{ vehicle.runningCostPerKm != null ? '€ ' +
                            vehicle.runningCostPerKm.toFixed(3) : '—' }}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">{{ $t('vehicles.totalWithPurchase') }}</span>
                        <span class="stat-value">{{ vehicle.costPerKm != null ? '€ ' + vehicle.costPerKm.toFixed(3) :
                            '—' }}</span>
                    </div>
                </div>
            </div>

            <!-- Maintenance alerts -->
            <div v-if="overdueAlerts.length > 0" class="alerts-section">
                <h3 class="section-title-lg alerts-header overdue-header">⚠️ {{ $t('vehicles.overdueMaintenances') }}</h3>
                <div class="alerts-list">
                    <div v-for="a in overdueAlerts" :key="a.id" class="alert-item overdue"
                        @click="router.push('/alerts')">
                        <div class="alert-icon-circle overdue">⚠️</div>
                        <div class="alert-item-info">
                            <div class="alert-item-title">{{ a.maintenanceTypeTitle }}</div>
                            <div class="alert-item-meta">
                                <span v-if="a.nextMaintenanceDate" class="alert-meta-tag">{{
                                    formatDate(a.nextMaintenanceDate) }}</span>
                                <span v-if="a.nextMaintenanceOdometer" class="alert-meta-tag km">→ {{
                                    formatNumber(a.nextMaintenanceOdometer) }} km</span>
                            </div>
                        </div>
                        <div class="alert-item-countdown overdue">
                            <template v-if="a.nextMaintenanceDate">
                                <span class="countdown-val">{{ getDaysRemaining(a) }}</span>
                                <span class="countdown-lbl">{{ $t('vehicles.days') }}</span>
                            </template>
                            <template v-else-if="a.nextMaintenanceOdometer && a.currentMileage">
                                <span class="countdown-val">{{ formatNumber(a.nextMaintenanceOdometer -
                                    a.currentMileage) }}</span>
                                <span class="countdown-lbl">km</span>
                            </template>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="upcomingAlerts.length > 0" class="alerts-section">
                <h3 class="section-title-lg alerts-header upcoming-header">🔔 {{ $t('vehicles.upcomingMaintenances') }}</h3>
                <div class="alerts-list">
                    <div v-for="a in upcomingAlerts" :key="a.id" class="alert-item upcoming"
                        @click="router.push('/alerts')">
                        <div class="alert-icon-circle upcoming">🔔</div>
                        <div class="alert-item-info">
                            <div class="alert-item-title">{{ a.maintenanceTypeTitle }}</div>
                            <div class="alert-item-meta">
                                <span v-if="a.nextMaintenanceDate" class="alert-meta-tag">{{
                                    formatDate(a.nextMaintenanceDate)
                                    }}</span>
                                <span v-if="a.nextMaintenanceOdometer" class="alert-meta-tag km">→ {{
                                    formatNumber(a.nextMaintenanceOdometer) }} km</span>
                            </div>
                        </div>
                        <div class="alert-item-countdown upcoming">
                            <template v-if="a.nextMaintenanceDate">
                                <span class="countdown-val">{{ getDaysRemaining(a) }}</span>
                                <span class="countdown-lbl">{{ $t('vehicles.days') }}</span>
                            </template>
                            <template v-else-if="a.nextMaintenanceOdometer && a.currentMileage">
                                <span class="countdown-val">{{ formatNumber(a.nextMaintenanceOdometer -
                                    a.currentMileage) }}</span>
                                <span class="countdown-lbl">km</span>
                            </template>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Consumption chart -->
            <div v-if="consumptionPoints.length >= 2" class="chart-section glass-card">
                <h3 class="section-title">{{ $t('vehicles.consumptionTrend') }}</h3>
                <div class="chart-wrapper">
                    <svg :viewBox="`0 0 ${chartWidth} ${chartHeight}`" class="consumption-chart"
                        preserveAspectRatio="none">
                        <!-- Grid lines -->
                        <line v-for="i in 4" :key="'grid-' + i" :x1="chartPadding.left"
                            :x2="chartWidth - chartPadding.right"
                            :y1="chartPadding.top + ((i - 1) / 3) * chartInnerHeight"
                            :y2="chartPadding.top + ((i - 1) / 3) * chartInnerHeight" stroke="var(--color-border)"
                            stroke-width="0.5" stroke-dasharray="4,4" />

                        <!-- Area fill -->
                        <path :d="areaPath" fill="url(#consumptionGradient)" opacity="0.3" />

                        <!-- Line -->
                        <path :d="linePath" fill="none" stroke="var(--color-accent)" stroke-width="2"
                            stroke-linecap="round" stroke-linejoin="round" />

                        <!-- Trend line -->
                        <line :x1="trendLine.x1" :y1="trendLine.y1" :x2="trendLine.x2" :y2="trendLine.y2"
                            stroke="var(--color-text-muted)" stroke-width="1.5" stroke-dasharray="6,4" opacity="0.6" />

                        <!-- Data points -->
                        <circle v-for="(p, i) in chartPoints" :key="'point-' + i" :cx="p.x" :cy="p.y" r="3"
                            fill="var(--color-accent)" stroke="var(--color-bg-card)" stroke-width="1.5" />

                        <defs>
                            <linearGradient id="consumptionGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="var(--color-accent)" stop-opacity="0.4" />
                                <stop offset="100%" stop-color="var(--color-accent)" stop-opacity="0" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <div class="chart-labels">
                        <span class="chart-label-y top">{{ chartMaxVal.toFixed(1) }} km/L</span>
                        <span class="chart-label-y bottom">{{ chartMinVal.toFixed(1) }} km/L</span>
                    </div>
                    <div class="chart-x-labels">
                        <span v-for="label in chartXLabels" :key="label">{{ label }}</span>
                    </div>
                </div>
            </div>

            <!-- Transactions list -->
            <div class="transactions-section">
                <h3 class="section-title-lg">{{ $t('vehicles.transactions') }}</h3>
                <div v-if="loadingTransactions && transactions.length === 0" class="loading-inline">
                    <div class="spinner-sm"></div>
                </div>
                <div v-else-if="!loadingTransactions && transactions.length === 0" class="empty-state-sm">
                    {{ $t('vehicles.noTransactions') }}
                </div>
                <div v-else class="transactions-list">
                    <template v-for="group in groupedTransactions" :key="group.label">
                        <PeriodSeparator :label="group.label" :count="group.transactions.length" :balance="group.balance" />
                        <TransactionCard v-for="tx in group.transactions" :key="tx.id" :transaction="tx"
                            @click="openDetail(tx.id)" />
                    </template>
                    <!-- Load more sentinel -->
                    <div v-if="hasMoreTransactions" class="load-more" ref="loadMoreRef">
                        <div v-if="loadingMoreTransactions" class="spinner-sm"></div>
                        <span v-else>{{ $t('vehicles.scrollToLoad') }}</span>
                    </div>
                </div>
            </div>

            <!-- Transaction Detail Modal -->
            <TransactionDetailModal :show="showDetail" :loading="loadingDetail" :error="detailError"
                :transaction="detailTransaction" @close="closeDetail" @edit="editTransaction"
                @delete="deleteTransaction" />
        </div>

        <!-- FAB for new automotive transaction -->
        <button v-if="vehicle" class="fab-btn" @click="createAutomotiveTransaction" :title="$t('vehicles.newExpense')">
        🚗
        <!--<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <path d="M12 5v14M5 12h14" />
            </svg>-->
        </button>
    </div>

</template>

<script setup lang="ts">
definePageMeta({
    layout: 'default'
})

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()

interface VehicleDetail {
    id: number
    brand: string
    model: string
    licensePlate: string | null
    year: number | null
    fuelName: string | null
    initialMileage: number
    currentMileage: number | null
    kmDriven: number
    purchasePrice: number
    purchaseDate: string | null
    notes: string | null
    isActive: boolean
    totalFuelCost: number
    totalMaintenanceCost: number
    totalCost: number
    runningCostPerKm: number | null
    costPerKm: number | null
    avgConsumption: number | null
    alertsUpcoming: number
    alertsOverdue: number
}

interface ConsumptionPoint {
    date: string
    odometer: number
    consumption: number
}

interface VehicleAlert {
    id: number
    maintenanceTypeTitle: string
    lastMaintenanceDate: string | null
    lastMaintenanceOdometer: number | null
    nextMaintenanceDate: string | null
    nextMaintenanceOdometer: number | null
    nextAlertDate: string | null
    nextAlertOdometer: number | null
    currentMileage: number | null
}

interface VehicleTransaction {
    id: number
    title: string
    amountFrom: number
    amountTo: number | null
    transactionDate: string
    toAccountId?: number
    categoryTitle?: string
    accountTitle: string
    logType: string
    vehicleName?: string | null
    odometer?: number | null
    averageConsumption?: number | null
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

const vehicleId = computed(() => route.params.id as string)
const loading = ref(true)
const loadError = ref('')
const vehicle = ref<VehicleDetail | null>(null)
const consumptionPoints = ref<ConsumptionPoint[]>([])
const vehicleAlerts = ref<VehicleAlert[]>([])
const transactions = ref<VehicleTransaction[]>([])
const loadingTransactions = ref(true)
const loadingMoreTransactions = ref(false)
const hasMoreTransactions = ref(true)
const txPage = ref(1)
const txLimit = 20
const loadMoreRef = ref<HTMLElement | null>(null)

interface TransactionGroup {
    label: string
    transactions: VehicleTransaction[]
    balance: number
}

const groupedTransactions = computed(() => {
    const groups: TransactionGroup[] = []
    const currentYear = new Date().getFullYear()
    let currentGroup: TransactionGroup | null = null

    for (const tx of transactions.value) {
        const txYear = new Date(tx.transactionDate).getFullYear()
        const label = txYear === currentYear ? t('vehicles.thisYear') : String(txYear)

        if (!currentGroup || currentGroup.label !== label) {
            currentGroup = { label, transactions: [], balance: 0 }
            groups.push(currentGroup)
        }
        currentGroup.transactions.push(tx)
        currentGroup.balance += tx.amountFrom
    }

    return groups
})

// Detail modal
const showDetail = ref(false)
const loadingDetail = ref(false)
const detailError = ref('')
const detailTransaction = ref<TransactionDetail | null>(null)

function formatNumber(n: number): string {
    return n.toLocaleString(locale.value)
}

function formatAmount(n: number): string {
    return n.toLocaleString(locale.value, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })
}

function goBack() {
    router.push('/vehicles')
}

function getAlertStatus(a: VehicleAlert): 'overdue' | 'soon' | 'normal' {
    const now = new Date()
    if (a.nextAlertDate && new Date(a.nextAlertDate) <= now) {
        if (a.nextMaintenanceDate && new Date(a.nextMaintenanceDate) <= now) return 'overdue'
        return 'soon'
    }
    if (a.nextMaintenanceDate && new Date(a.nextMaintenanceDate) <= now) return 'overdue'
    if (a.currentMileage != null) {
        if (a.nextMaintenanceOdometer && a.currentMileage >= a.nextMaintenanceOdometer) return 'overdue'
        if (a.nextAlertOdometer && a.currentMileage >= a.nextAlertOdometer) return 'soon'
    }
    return 'normal'
}

function getDaysRemaining(a: VehicleAlert): number {
    if (!a.nextMaintenanceDate) return 0
    const now = new Date()
    const target = new Date(a.nextMaintenanceDate)
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate())
    return Math.round((targetDay.getTime() - nowDay.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(locale.value, { day: '2-digit', month: 'short', year: 'numeric' })
}

const overdueAlerts = computed(() => vehicleAlerts.value.filter(a => getAlertStatus(a) === 'overdue'))
const upcomingAlerts = computed(() => vehicleAlerts.value.filter(a => getAlertStatus(a) === 'soon'))

// Chart constants
const chartWidth = 600
const chartHeight = 200
const chartPadding = { top: 15, right: 15, bottom: 5, left: 15 }
const chartInnerWidth = chartWidth - chartPadding.left - chartPadding.right
const chartInnerHeight = chartHeight - chartPadding.top - chartPadding.bottom

const chartMinVal = computed(() => {
    if (consumptionPoints.value.length === 0) return 0
    const min = Math.min(...consumptionPoints.value.map(p => p.consumption))
    return Math.floor(min * 2) / 2
})

const chartMaxVal = computed(() => {
    if (consumptionPoints.value.length === 0) return 10
    const max = Math.max(...consumptionPoints.value.map(p => p.consumption))
    return Math.ceil(max * 2) / 2
})

const chartPoints = computed(() => {
    const pts = consumptionPoints.value
    if (pts.length < 2) return []
    const range = chartMaxVal.value - chartMinVal.value || 1
    return pts.map((p, i) => ({
        x: chartPadding.left + (i / (pts.length - 1)) * chartInnerWidth,
        y: chartPadding.top + (1 - (p.consumption - chartMinVal.value) / range) * chartInnerHeight
    }))
})

const linePath = computed(() => {
    const pts = chartPoints.value
    if (pts.length < 2) return ''
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
})

const areaPath = computed(() => {
    const pts = chartPoints.value
    if (pts.length < 2) return ''
    const bottom = chartPadding.top + chartInnerHeight
    return `M${pts[0].x},${bottom} ` +
        pts.map(p => `L${p.x},${p.y}`).join(' ') +
        ` L${pts[pts.length - 1].x},${bottom} Z`
})

const trendLine = computed(() => {
    const pts = consumptionPoints.value
    if (pts.length < 2) return { x1: 0, y1: 0, x2: 0, y2: 0 }
    const n = pts.length
    const sumX = pts.reduce((s, _, i) => s + i, 0)
    const sumY = pts.reduce((s, p) => s + p.consumption, 0)
    const sumXY = pts.reduce((s, p, i) => s + i * p.consumption, 0)
    const sumX2 = pts.reduce((s, _, i) => s + i * i, 0)
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n
    const range = chartMaxVal.value - chartMinVal.value || 1
    const y0 = intercept
    const y1 = slope * (n - 1) + intercept
    return {
        x1: chartPadding.left,
        y1: chartPadding.top + (1 - (y0 - chartMinVal.value) / range) * chartInnerHeight,
        x2: chartPadding.left + chartInnerWidth,
        y2: chartPadding.top + (1 - (y1 - chartMinVal.value) / range) * chartInnerHeight
    }
})

const chartXLabels = computed(() => {
    const pts = consumptionPoints.value
    if (pts.length < 2) return []
    const maxLabels = 5
    const step = Math.max(1, Math.floor(pts.length / maxLabels))
    const labels: string[] = []
    for (let i = 0; i < pts.length; i += step) {
        const d = new Date(pts[i].date)
        labels.push(d.toLocaleDateString(locale.value, { month: 'short', year: '2-digit' }))
    }
    // Always include last
    const last = new Date(pts[pts.length - 1].date)
    const lastLabel = last.toLocaleDateString(locale.value, { month: 'short', year: '2-digit' })
    if (labels[labels.length - 1] !== lastLabel) {
        labels.push(lastLabel)
    }
    return labels
})

async function loadVehicle() {
    loading.value = true
    loadError.value = ''
    try {
        const data = await $fetch<{ vehicle: VehicleDetail }>(`/api/vehicles/${vehicleId.value}`)
        vehicle.value = data.vehicle
    } catch (error: any) {
        loadError.value = error?.data?.message || t('vehicles.loadError')
    } finally {
        loading.value = false
    }
}

async function loadAlerts() {
    try {
        const data = await $fetch<{ alerts: VehicleAlert[] }>(`/api/vehicles/${vehicleId.value}/alerts`)
        vehicleAlerts.value = data.alerts
    } catch {
        // silently ignore
    }
}

async function loadConsumption() {
    try {
        const data = await $fetch<{ points: ConsumptionPoint[] }>(`/api/vehicles/${vehicleId.value}/consumption`)
        consumptionPoints.value = data.points
    } catch {
        // silently ignore
    }
}

async function loadTransactions(pageNum: number = 1, append = false) {
    if (append) {
        loadingMoreTransactions.value = true
    } else {
        loadingTransactions.value = true
    }
    try {
        const data = await $fetch<{ transactions: VehicleTransaction[], pagination: { hasMore: boolean } }>(
            `/api/vehicles/${vehicleId.value}/transactions`,
            { query: { page: pageNum, limit: txLimit } }
        )
        if (append) {
            transactions.value.push(...data.transactions)
        } else {
            transactions.value = data.transactions
        }
        hasMoreTransactions.value = data.pagination.hasMore
    } catch {
        // silently ignore
    } finally {
        loadingTransactions.value = false
        loadingMoreTransactions.value = false
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
        detailError.value = error?.data?.message || t('vehicles.loadError')
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

// Delete transaction
async function deleteTransaction() {
    const tx = detailTransaction.value
    if (!tx) return

    if (!confirm(t('vehicles.deleteConfirm'))) return

    try {
        await $fetch(`/api/transactions/${tx.id}`, {
            method: 'DELETE'
        })
        closeDetail()
        // Refresh list
        loadVehicle()
        txPage.value = 1
        loadTransactions(1)
        loadConsumption()
        loadAlerts()
    } catch (error) {
        console.error('Failed to delete transaction:', error)
        alert(t('vehicles.deleteError'))
    }
}

// Infinite scroll for transactions
function setupInfiniteScroll() {
    const observer = new IntersectionObserver(
        (entries) => {
            if (entries[0]?.isIntersecting && hasMoreTransactions.value && !loadingMoreTransactions.value) {
                txPage.value++
                loadTransactions(txPage.value, true)
            }
        },
        { threshold: 0.1 }
    )

    watch(loadMoreRef, (el) => {
        if (el) observer.observe(el)
    })

    onUnmounted(() => observer.disconnect())
}

onMounted(async () => {
    await loadVehicle()
    if (vehicle.value) {
        loadAlerts()
        loadConsumption()
        loadTransactions(1)
        setupInfiniteScroll()
    }
})

function createAutomotiveTransaction() {
    router.push(`/transactions/automotive?vehicleId=${vehicleId.value}`)
}
</script>

<style scoped>
.vehicle-detail-page {
    min-height: 100%;
}

.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md);
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
}

.page-header h1 {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-text-primary);
}

.back-btn {
    background: none;
    border: none;
    color: var(--color-text-primary);
    cursor: pointer;
    padding: var(--space-xs);
    display: flex;
    align-items: center;
    justify-content: center;
}

.header-spacer {
    width: 36px;
}

.loading-state,
.error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    gap: var(--space-md);
    color: var(--color-text-muted);
}

.spinner-lg {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

.spinner-sm {
    width: 24px;
    height: 24px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

.detail-content {
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    max-width: 900px;
    margin: 0 auto;
}

/* Info section */
.info-section {
    padding: var(--space-lg);
}

.vehicle-title-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
}

.vehicle-icon {
    font-size: 2rem;
}

.vehicle-name {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
}

.vehicle-plate {
    font-size: 0.85rem;
    color: var(--color-text-muted);
}

.title-badges {
    margin-left: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    align-items: flex-end;
}

.alert-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
}

.alert-badge.overdue {
    background: var(--color-error-bg);
    color: var(--color-error);
}

.alert-badge.upcoming {
    background: var(--color-warning-bg);
    color: var(--color-warning);
}

.info-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
}

.info-tag {
    background: var(--color-bg-elevated);
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    color: var(--color-text-secondary);
}

.inactive-tag {
    background: var(--color-error-bg);
    color: var(--color-error);
}

/* Stats grid - horizontal on desktop, vertical on mobile */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-md);
}

.stats-section {
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

.stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) 0;
}

.stat-row+.stat-row {
    border-top: 1px solid var(--color-border);
}

.stat-label {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
}

.stat-value {
    font-size: 0.95rem;
    font-weight: 600;
}

.total-row {
    margin-top: var(--space-xs);
}

.total-row .stat-label {
    font-weight: 600;
    color: var(--color-text-primary);
}

.total-row .stat-value {
    font-size: 1.05rem;
    color: var(--color-accent);
}

/* Maintenance alerts */
.alerts-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.alerts-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
}

.alerts-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.alert-item {
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

.alert-item:hover {
    transform: translateX(4px);
    box-shadow: var(--shadow-lg);
}

.alert-item.overdue {
    border-left: 3px solid var(--color-error);
}

.alert-item.upcoming {
    border-left: 3px solid var(--color-warning);
}

.alert-icon-circle {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 1.1rem;
}

.alert-icon-circle.overdue {
    background: var(--color-error-bg);
}

.alert-icon-circle.upcoming {
    background: var(--color-warning-bg);
}

.alert-item-info {
    flex: 1;
    min-width: 0;
}

.alert-item-title {
    font-weight: 500;
    font-size: 0.95rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 4px;
}

.alert-item-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    font-size: 0.75rem;
    color: var(--color-text-muted);
}

.alert-meta-tag {
    background: var(--color-bg-glass);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    white-space: nowrap;
}

.alert-meta-tag.km {
    background: var(--color-accent-bg);
    color: var(--color-accent);
}

.alert-item-countdown {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    min-width: 50px;
}

.countdown-val {
    font-size: 1.1rem;
    font-weight: 700;
    line-height: 1;
}

.countdown-lbl {
    font-size: 0.6rem;
    font-weight: 500;
    opacity: 0.7;
}

.alert-item-countdown.overdue .countdown-val {
    color: var(--color-error);
}

.alert-item-countdown.upcoming .countdown-val {
    color: var(--color-warning);
}

/* Consumption chart */
.chart-section {
    padding: var(--space-lg);
}

.chart-wrapper {
    position: relative;
    margin-top: var(--space-sm);
}

.consumption-chart {
    width: 100%;
    height: 180px;
}

.chart-labels {
    position: absolute;
    top: 0;
    right: 8px;
    bottom: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    pointer-events: none;
}

.chart-label-y {
    font-size: 0.65rem;
    color: var(--color-text-muted);
    background: var(--color-bg-card);
    padding: 1px 4px;
    border-radius: 3px;
}

.chart-label-y.top {
    align-self: flex-end;
}

.chart-label-y.bottom {
    align-self: flex-end;
}

.chart-x-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.65rem;
    color: var(--color-text-muted);
    margin-top: var(--space-xs);
    padding: 0 var(--space-sm);
}

/* Transactions */
.transactions-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
}

.section-title-lg {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-primary);
}

.loading-inline {
    display: flex;
    justify-content: center;
    padding: var(--space-lg);
}

.load-more {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-lg);
    color: var(--color-text-muted);
    font-size: 0.85rem;
}

.empty-state-sm {
    text-align: center;
    color: var(--color-text-muted);
    padding: var(--space-xl);
    font-size: 0.9rem;
}

.transactions-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.btn {
    padding: var(--space-sm) var(--space-lg);
    border-radius: var(--radius-sm);
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
}

.btn-secondary {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
}

@media (max-width: 600px) {
    .stats-grid {
        grid-template-columns: 1fr;
    }

    .detail-content {
        padding: var(--space-md);
    }

    .consumption-chart {
        height: 150px;
    }
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* FAB */
.fab-btn {
    position: fixed;
    bottom: calc(70px + var(--space-lg));
    right: var(--space-lg);
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: none;
    background: linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary, #818cf8));
    color: var(--color-text-on-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 16px var(--color-accent-glow);
    transition: transform 0.2s, box-shadow 0.2s;
    z-index: 50;
    font-size: 1.5rem;
}

.fab-btn:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 24px var(--color-accent-glow);
}

.fab-btn:active {
    transform: scale(0.95);
}
</style>
