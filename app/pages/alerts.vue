<template>
    <div class="alerts-page">
        <!-- Loading state -->
        <div v-if="loading" class="loading-state">
            <div class="spinner-lg"></div>
            <p>{{ $t('alerts.loading') }}</p>
        </div>

        <!-- Empty state -->
        <div v-else-if="alerts.length === 0" class="empty-state">
            <div class="empty-icon">🔔</div>
            <h2>{{ $t('alerts.noAlerts') }}</h2>
            <p>{{ $t('alerts.noAlertsDesc') }}</p>
        </div>

        <!-- Alerts list -->
        <div v-else class="alerts-list">
            <!-- Vehicle filter -->
            <div v-if="vehicleOptions.length > 1" class="vehicle-filter">
                <button class="filter-chip" :class="{ active: selectedVehicleId === null }"
                    @click="selectedVehicleId = null">
                    {{ $t('alerts.allVehicles') }}
                </button>
                <button v-for="v in vehicleOptions" :key="v.id" class="filter-chip"
                    :class="{ active: selectedVehicleId === v.id }" @click="selectedVehicleId = v.id">
                    🚗 {{ v.name }}
                </button>
            </div>
            <template v-for="(group, status) in groupedAlerts" :key="status">
                <div class="period-separator">
                    <div class="period-label">{{ status }}</div>
                    <div class="period-stats">
                        <span class="count">{{ group.length }} {{ $t('alerts.alertsCount') }}</span>
                    </div>
                </div>
                <div v-for="a in group" :key="a.id" class="alert-card" :class="getAlertStatus(a)"
                    @click="openDetail(a)">
                    <!-- Status icon -->
                    <div class="alert-icon-badge" :class="getAlertStatus(a)">
                        <span v-if="getAlertStatus(a) === 'overdue'">⚠️</span>
                        <span v-else-if="getAlertStatus(a) === 'soon'">🔔</span>
                        <span v-else>🔧</span>
                    </div>

                    <!-- Alert info -->
                    <div class="alert-info">
                        <div class="alert-title">{{ a.maintenanceTypeTitle }}</div>
                        <div class="alert-meta">
                            <span class="alert-badge">🚗 {{ a.vehicleName }}</span>
                            <span v-if="a.licensePlate" class="alert-badge">{{ a.licensePlate }}</span>
                            <span v-if="a.currentMileage" class="alert-badge">
                                {{ a.currentMileage.toLocaleString() }} km
                            </span>
                            <span v-if="a.nextMaintenanceOdometer" class="alert-badge km-badge">
                                → {{ a.nextMaintenanceOdometer.toLocaleString() }} km
                            </span>
                        </div>
                    </div>

                    <!-- Countdown -->
                    <div class="alert-countdown" :class="getAlertStatus(a)">
                        <template v-if="a.nextMaintenanceDate">
                            <span class="countdown-value">{{ getDaysRemaining(a) }}</span>
                            <span class="countdown-unit">{{ $t('alerts.days') }}</span>
                        </template>
                        <template v-else-if="a.nextMaintenanceOdometer && a.currentMileage">
                            <span class="countdown-value">{{ (a.nextMaintenanceOdometer - a.currentMileage).toLocaleString() }}</span>
                            <span class="countdown-unit">km</span>
                        </template>
                    </div>
                </div>
            </template>
        </div>

        <!-- Detail / Edit Modal -->
        <div v-if="showDetail" class="modal-overlay" @click.self="closeDetail">
            <div class="modal glass-card detail-modal">
                <div class="modal-header">
                    <div class="modal-actions-left">
                        <button class="action-btn delete-btn" @click.stop="deleteAlert" :title="$t('common.delete')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path
                                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                        </button>
                    </div>
                    <h2>{{ $t('alerts.alertDetails') }}</h2>
                    <button class="close-btn" @click="closeDetail">&times;</button>
                </div>

                <div v-if="selectedAlert" class="detail-content">
                    <!-- Status Badge -->
                    <div class="status-badge" :class="getAlertStatus(selectedAlert)">
                        <span v-if="getAlertStatus(selectedAlert) === 'overdue'">⚠️ {{ $t('alerts.overdue') }}</span>
                        <span v-else-if="getAlertStatus(selectedAlert) === 'soon'">🔔 {{ $t('alerts.comingSoon') }}</span>
                        <span v-else>✅ {{ $t('alerts.onTrack') }}</span>
                    </div>

                    <!-- Type title -->
                    <h3 class="detail-title">{{ selectedAlert.maintenanceTypeTitle }}</h3>

                    <!-- Vehicle info -->
                    <div class="vehicle-section">
                        <span>🚗 {{ selectedAlert.vehicleName }}</span>
                        <span v-if="selectedAlert.licensePlate"> ({{ selectedAlert.licensePlate }})</span>
                    </div>

                    <!-- Last maintenance info -->
                    <div class="details-grid">
                        <div class="grid-header">{{ $t('alerts.lastMaintenance') }}</div>
                        <div v-if="selectedAlert.lastMaintenanceDate" class="detail-row">
                            <span class="label">{{ $t('alerts.date') }}</span>
                            <span class="value">{{ formatDate(selectedAlert.lastMaintenanceDate) }}</span>
                        </div>
                        <div v-if="selectedAlert.lastMaintenanceOdometer" class="detail-row">
                            <span class="label">{{ $t('alerts.odometer') }}</span>
                            <span class="value">{{ selectedAlert.lastMaintenanceOdometer.toLocaleString() }} km</span>
                        </div>
                    </div>

                    <!-- Next maintenance (editable) -->
                    <form @submit.prevent="saveAlert" class="edit-form">
                        <div class="details-grid editable">
                            <div class="grid-header">{{ $t('alerts.nextMaintenance') }}</div>
                            <div class="input-row">
                                <label>{{ $t('alerts.date') }}</label>
                                <input type="date" v-model="editForm.nextMaintenanceDate" class="input-field">
                            </div>
                            <div class="input-row">
                                <label>{{ $t('alerts.odometer') }} (km)</label>
                                <input type="number" v-model.number="editForm.nextMaintenanceOdometer"
                                    class="input-field" min="0">
                            </div>
                        </div>

                        <div class="details-grid editable">
                            <div class="grid-header">{{ $t('alerts.alertSettings') }}</div>
                            <div class="input-row">
                                <label>{{ $t('alerts.alertDate') }}</label>
                                <input type="date" v-model="editForm.nextAlertDate" class="input-field">
                            </div>
                            <div class="input-row">
                                <label>{{ $t('alerts.alertOdometer') }} (km)</label>
                                <input type="number" v-model.number="editForm.nextAlertOdometer" class="input-field"
                                    min="0">
                            </div>
                        </div>

                        <!-- Interval info (read-only) -->
                        <div v-if="selectedAlert.defaultIntervalKm || selectedAlert.defaultIntervalMonths"
                            class="details-grid">
                            <div class="grid-header">{{ $t('alerts.intervals') }}</div>
                            <div v-if="selectedAlert.defaultIntervalMonths" class="detail-row">
                                <span class="label">{{ $t('alerts.intervalMonths') }}</span>
                                <span class="value">{{ selectedAlert.defaultIntervalMonths }} {{ $t('alerts.months') }}</span>
                            </div>
                            <div v-if="selectedAlert.defaultIntervalKm" class="detail-row">
                                <span class="label">{{ $t('alerts.intervalKm') }}</span>
                                <span class="value">{{ selectedAlert.defaultIntervalKm.toLocaleString() }} km</span>
                            </div>
                        </div>

                        <div v-if="saveError" class="form-error">{{ saveError }}</div>

                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary" @click="closeDetail">
                                {{ $t('common.cancel') }}
                            </button>
                            <button type="submit" class="btn btn-primary" :disabled="saving">
                                <span v-if="saving" class="spinner"></span>
                                {{ $t('common.saveChanges') }}
                            </button>
                        </div>
                    </form>
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

interface Alert {
    id: number
    vehicleId: number
    maintenanceTypeId: number
    lastMaintenanceDate: string | null
    lastMaintenanceOdometer: number | null
    nextMaintenanceDate: string | null
    nextMaintenanceOdometer: number | null
    nextAlertDate: string | null
    nextAlertOdometer: number | null
    isAlertSent: boolean
    maintenanceTypeTitle: string
    defaultIntervalKm: number | null
    defaultIntervalMonths: number | null
    defaultDaysBeforeAlert: number | null
    defaultKmBeforeAlert: number | null
    vehicleName: string
    licensePlate: string | null
    currentMileage: number | null
}

const alerts = ref<Alert[]>([])
const loading = ref(true)
const selectedVehicleId = ref<number | null>(null)

const showDetail = ref(false)
const selectedAlert = ref<Alert | null>(null)
const saving = ref(false)
const saveError = ref('')

const editForm = ref({
    nextMaintenanceDate: '',
    nextMaintenanceOdometer: null as number | null,
    nextAlertDate: '',
    nextAlertOdometer: null as number | null
})

// Unique vehicles for filter
const vehicleOptions = computed(() => {
    const map = new Map<number, { id: number; name: string }>()
    for (const a of alerts.value) {
        if (!map.has(a.vehicleId)) {
            map.set(a.vehicleId, { id: a.vehicleId, name: a.vehicleName })
        }
    }
    return Array.from(map.values())
})

const filteredAlerts = computed(() => {
    if (selectedVehicleId.value === null) return alerts.value
    return alerts.value.filter(a => a.vehicleId === selectedVehicleId.value)
})

const groupedAlerts = computed(() => {
    const groups: Record<string, Alert[]> = {}

    const overdue: Alert[] = []
    const soon: Alert[] = []
    const normal: Alert[] = []

    for (const a of filteredAlerts.value) {
        const status = getAlertStatus(a)
        if (status === 'overdue') overdue.push(a)
        else if (status === 'soon') soon.push(a)
        else normal.push(a)
    }

    // Order: 1. overdue, 2. soon, 3. on track — each sorted by urgency
    if (overdue.length > 0) groups[t('alerts.statusOverdue')] = sortByUrgency(overdue)
    if (soon.length > 0) groups[t('alerts.statusSoon')] = sortByUrgency(soon)
    if (normal.length > 0) groups[t('alerts.statusOk')] = sortByUrgency(normal)

    return groups
})

function sortByUrgency(list: Alert[]): Alert[] {
    return [...list].sort((a, b) => {
        // Sort by nearest deadline first (date, then km)
        const aDate = a.nextMaintenanceDate ? new Date(a.nextMaintenanceDate).getTime() : Infinity
        const bDate = b.nextMaintenanceDate ? new Date(b.nextMaintenanceDate).getTime() : Infinity
        if (aDate !== bDate) return aDate - bDate
        const aKm = a.nextMaintenanceOdometer ?? Infinity
        const bKm = b.nextMaintenanceOdometer ?? Infinity
        return aKm - bKm
    })
}

function getAlertStatus(a: Alert): 'overdue' | 'soon' | 'normal' {
    const now = new Date()

    // Check date-based alert
    if (a.nextAlertDate && new Date(a.nextAlertDate) <= now) {
        if (a.nextMaintenanceDate && new Date(a.nextMaintenanceDate) <= now) {
            return 'overdue'
        }
        return 'soon'
    }

    if (a.nextMaintenanceDate && new Date(a.nextMaintenanceDate) <= now) {
        return 'overdue'
    }

    // Check km-based alert
    if (a.currentMileage != null) {
        if (a.nextMaintenanceOdometer && a.currentMileage >= a.nextMaintenanceOdometer) {
            return 'overdue'
        }
        if (a.nextAlertOdometer && a.currentMileage >= a.nextAlertOdometer) {
            return 'soon'
        }
    }

    return 'normal'
}

function getDaysRemaining(a: Alert): number {
    if (!a.nextMaintenanceDate) return 0
    const now = new Date()
    const target = new Date(a.nextMaintenanceDate)
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate())
    return Math.round((targetDay.getTime() - nowDay.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    return date.toLocaleDateString(locale.value, { day: '2-digit', month: 'short', year: 'numeric' })
}

function toInputDate(dateStr: string | null): string {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toISOString().split('T')[0]
}

async function fetchAlerts() {
    loading.value = true
    try {
        const data = await $fetch<{ alerts: Alert[] }>('/api/maintenance_alerts')
        alerts.value = data.alerts
    } catch (error) {
        console.error('Failed to fetch alerts:', error)
    } finally {
        loading.value = false
    }
}

function openDetail(a: Alert) {
    selectedAlert.value = a
    editForm.value = {
        nextMaintenanceDate: toInputDate(a.nextMaintenanceDate),
        nextMaintenanceOdometer: a.nextMaintenanceOdometer,
        nextAlertDate: toInputDate(a.nextAlertDate),
        nextAlertOdometer: a.nextAlertOdometer
    }
    saveError.value = ''
    showDetail.value = true
}

function closeDetail() {
    showDetail.value = false
    selectedAlert.value = null
}

async function saveAlert() {
    if (!selectedAlert.value) return

    saving.value = true
    saveError.value = ''

    try {
        await $fetch(`/api/maintenance_alerts/${selectedAlert.value.id}`, {
            method: 'PUT',
            body: {
                nextMaintenanceDate: editForm.value.nextMaintenanceDate || null,
                nextMaintenanceOdometer: editForm.value.nextMaintenanceOdometer || null,
                nextAlertDate: editForm.value.nextAlertDate || null,
                nextAlertOdometer: editForm.value.nextAlertOdometer || null
            }
        })
        closeDetail()
        await fetchAlerts()
    } catch (error: any) {
        saveError.value = error?.data?.message || t('common.saveError')
    } finally {
        saving.value = false
    }
}

async function deleteAlert() {
    if (!selectedAlert.value) return
    if (!confirm(t('alerts.deleteConfirm'))) return

    try {
        await $fetch(`/api/maintenance_alerts/${selectedAlert.value.id}`, { method: 'DELETE' })
        closeDetail()
        await fetchAlerts()
    } catch (error) {
        console.error('Failed to delete alert:', error)
    }
}

onMounted(() => fetchAlerts())
</script>

<style scoped>
.alerts-page {
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

.alerts-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding-bottom: var(--space-xl);
}

/* Vehicle filter */
.vehicle-filter {
    display: flex;
    gap: var(--space-xs);
    overflow-x: auto;
    padding-bottom: var(--space-sm);
    margin-bottom: var(--space-sm);
    -webkit-overflow-scrolling: touch;
}

.vehicle-filter::-webkit-scrollbar {
    display: none;
}

.filter-chip {
    padding: var(--space-xs) var(--space-md);
    background: var(--color-bg-card);
    backdrop-filter: blur(20px);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    color: var(--color-text-secondary);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
    font-family: inherit;
}

.filter-chip:hover {
    border-color: var(--color-accent);
    color: var(--color-text-primary);
}

.filter-chip.active {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: white;
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

/* Alert card */
.alert-card {
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

.alert-card:hover {
    transform: translateX(4px);
    box-shadow: var(--shadow-lg);
}

.alert-card.overdue {
    border-left: 3px solid var(--color-error);
}

.alert-card.soon {
    border-left: 3px solid var(--color-warning);
}

.alert-icon-badge {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 1.3rem;
}

.alert-icon-badge.overdue {
    background: var(--color-error-bg);
}

.alert-icon-badge.soon {
    background: var(--color-warning-bg);
}

.alert-icon-badge.normal {
    background: var(--color-bg-glass);
}

.alert-info {
    flex: 1;
    min-width: 0;
}

.alert-title {
    font-weight: 500;
    font-size: 0.95rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 4px;
}

.alert-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    font-size: 0.75rem;
    color: var(--color-text-muted);
}

.alert-badge {
    background: var(--color-bg-glass);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    white-space: nowrap;
}

.km-badge {
    background: var(--color-accent-bg);
    color: var(--color-accent);
}

.alert-countdown {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    min-width: 50px;
}

.countdown-value {
    font-size: 1.2rem;
    font-weight: 700;
    line-height: 1;
}

.countdown-unit {
    font-size: 0.65rem;
    font-weight: 500;
    opacity: 0.7;
}

.alert-countdown.overdue .countdown-value {
    color: var(--color-error);
}

.alert-countdown.soon .countdown-value {
    color: var(--color-warning);
}

.alert-countdown.normal .countdown-value {
    color: var(--color-success);
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
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-spinner-border);
    border-top-color: var(--color-spinner-active);
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

.detail-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
}

.status-badge {
    align-self: flex-start;
    padding: var(--space-xs) var(--space-md);
    border-radius: var(--radius-lg);
    font-size: 0.8rem;
    font-weight: 500;
}

.status-badge.overdue {
    background: var(--color-error-bg);
    color: var(--color-error);
}

.status-badge.soon {
    background: var(--color-warning-bg);
    color: var(--color-warning);
}

.status-badge.normal {
    background: var(--color-success-bg);
    color: var(--color-success);
}

.detail-title {
    font-size: 1.2rem;
    font-weight: 600;
    text-align: center;
}

.vehicle-section {
    text-align: center;
    font-size: 0.9rem;
    color: var(--color-text-secondary);
}

.details-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-md);
    background: var(--color-bg-elevated);
    border-radius: var(--radius-md);
}

.details-grid.editable {
    border: 1px solid var(--color-border);
}

.grid-header {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: var(--space-xs);
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

.input-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.input-row label {
    font-size: 0.8rem;
    color: var(--color-text-muted);
}

.edit-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
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
    margin-top: var(--space-sm);
}

.btn {
    padding: var(--space-sm) var(--space-lg);
    border-radius: var(--radius-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
    font-size: 0.9rem;
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

@media (max-width: 400px) {
    .alert-meta {
        font-size: 0.7rem;
    }

    .alert-countdown .countdown-value {
        font-size: 1rem;
    }

    .period-label {
        font-size: 0.85rem;
    }
}
</style>
