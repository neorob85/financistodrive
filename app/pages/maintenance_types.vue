<template>
    <div class="maintenance-types-page">
        <h1 class="page-title">{{ $t('maintenance.title') }}</h1>

        <!-- Loading state -->
        <div v-if="loading" class="loading-state">
            <div class="spinner-lg"></div>
        </div>

        <!-- Empty state -->
        <div v-else-if="maintenanceTypes.length === 0" class="empty-state">
            <div class="empty-icon">🔧</div>
            <h2>{{ $t('maintenance.noTypes') }}</h2>
            <p>{{ $t('maintenance.addFirst') }}</p>
        </div>

        <!-- Maintenance types grouped by vehicle -->
        <div v-else class="maintenance-list">
            <div v-for="group in groupedByVehicle" :key="group.vehicleId ?? 'general'" class="vehicle-group">
                <h2 class="group-title">
                    <span class="group-icon">{{ group.vehicleId ? '🚗' : '🔧' }}</span>
                    {{ group.vehicleName || $t('maintenance.generalAllVehicles') }}
                </h2>

                <div class="cards-container">
                    <div v-for="mt in group.items" :key="mt.id" class="maintenance-card glass-card"
                        @click="editMaintenanceType(mt)">
                        <div class="card-content">
                            <h3 class="card-title">{{ mt.title }}</h3>
                            <div class="card-details">
                                <span v-if="mt.defaultIntervalKm" class="detail-item">
                                    <span class="detail-label">{{ $t('maintenance.every') }}</span>
                                    <span class="detail-value">{{ formatNumber(mt.defaultIntervalKm) }} km</span>
                                </span>
                                <span v-if="mt.defaultIntervalMonths" class="detail-item">
                                    <span class="detail-label">{{ $t('maintenance.every') }}</span>
                                    <span class="detail-value">{{ mt.defaultIntervalMonths }} {{ $t('maintenance.months') }}</span>
                                </span>
                                <span v-if="!mt.defaultIntervalKm && !mt.defaultIntervalMonths"
                                    class="detail-item no-interval">
                                    {{ $t('maintenance.noIntervalDefined') }}
                                </span>
                            </div>
                        </div>
                        <div class="card-arrow">›</div>
                    </div>
                </div>
            </div>
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
                    <h2>{{ editingId ? $t('maintenance.edit') : $t('maintenance.new') }}</h2>
                    <button class="close-btn" @click="closeModal">×</button>
                </div>
                <form @submit.prevent="saveMaintenanceType" class="modal-form">
                    <div class="input-group">
                        <label for="title">{{ $t('maintenance.typeName') }} *</label>
                        <input id="title" v-model="form.title" type="text" class="input-field" required>
                    </div>

                    <div class="input-group">
                        <label for="vehicleId">{{ $t('maintenance.vehicle') }}</label>
                        <select id="vehicleId" v-model="form.vehicleId" class="input-field">
                            <option :value="null">{{ $t('maintenance.allVehicles') }}</option>
                            <option v-for="vehicle in vehicles" :key="vehicle.id" :value="vehicle.id">
                                {{ vehicle.brand }} {{ vehicle.model }}
                            </option>
                        </select>
                    </div>

                    <div class="form-row">
                        <div class="input-group">
                            <label for="defaultIntervalKm">{{ $t('maintenance.intervalKm') }}</label>
                            <input id="defaultIntervalKm" v-model.number="form.defaultIntervalKm" type="number" min="0"
                                class="input-field">
                        </div>
                        <div class="input-group">
                            <label for="defaultIntervalMonths">{{ $t('maintenance.intervalMonths') }}</label>
                            <input id="defaultIntervalMonths" v-model.number="form.defaultIntervalMonths" type="number"
                                min="0" class="input-field">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="input-group">
                            <label for="defaultDaysBeforeAlert">{{ $t('maintenance.daysBeforeAlert') }}</label>
                            <input id="defaultDaysBeforeAlert" v-model.number="form.defaultDaysBeforeAlert" type="number"
                                min="0" class="input-field">
                        </div>
                        <div class="input-group">
                            <label for="defaultKmBeforeAlert">{{ $t('maintenance.kmBeforeAlert') }}</label>
                            <input id="defaultKmBeforeAlert" v-model.number="form.defaultKmBeforeAlert" type="number"
                                min="0" class="input-field">
                        </div>
                    </div>

                    <div v-if="formError" class="form-error">{{ formError }}</div>

                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" @click="closeModal">{{ $t('common.cancel') }}</button>
                        <button type="submit" class="btn btn-primary" :disabled="saving">
                            <span v-if="saving" class="spinner"></span>
                            {{ editingId ? $t('common.saveChanges') : $t('maintenance.createMaintenance') }}
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

const { t } = useI18n()

interface MaintenanceType {
    id: number
    title: string
    vehicleId: number | null
    vehicleName: string | null
    defaultIntervalKm: number | null
    defaultIntervalMonths: number | null
    defaultDaysBeforeAlert: number | null
    defaultKmBeforeAlert: number | null
}

interface Vehicle {
    id: number
    brand: string
    model: string
}

interface GroupedMaintenance {
    vehicleId: number | null
    vehicleName: string | null
    items: MaintenanceType[]
}

const maintenanceTypes = ref<MaintenanceType[]>([])
const vehicles = ref<Vehicle[]>([])
const loading = ref(true)
const showModal = ref(false)
const saving = ref(false)
const formError = ref('')
const editingId = ref<number | null>(null)

const form = ref({
    title: '',
    vehicleId: null as number | null,
    defaultIntervalKm: null as number | null,
    defaultIntervalMonths: null as number | null,
    defaultDaysBeforeAlert: null as number | null,
    defaultKmBeforeAlert: null as number | null
})

const groupedByVehicle = computed(() => {
    const groups: Map<number | null, GroupedMaintenance> = new Map()

    // First add general (null vehicleId) group
    groups.set(null, {
        vehicleId: null,
        vehicleName: null,
        items: []
    })

    for (const mt of maintenanceTypes.value) {
        if (!groups.has(mt.vehicleId)) {
            groups.set(mt.vehicleId, {
                vehicleId: mt.vehicleId,
                vehicleName: mt.vehicleName,
                items: []
            })
        }
        groups.get(mt.vehicleId)!.items.push(mt)
    }

    // Convert to array, put general first, then sort by vehicle name
    const result = Array.from(groups.values())
        .filter(g => g.items.length > 0)
        .sort((a, b) => {
            if (a.vehicleId === null) return -1
            if (b.vehicleId === null) return 1
            return (a.vehicleName || '').localeCompare(b.vehicleName || '')
        })

    return result
})

function formatNumber(n: number) {
    return n.toLocaleString('it-IT')
}

async function loadMaintenanceTypes() {
    loading.value = true
    try {
        const data = await $fetch<{ maintenanceTypes: MaintenanceType[] }>('/api/maintenance_types')
        maintenanceTypes.value = data.maintenanceTypes
    } catch (error) {
        console.error('Failed to load maintenance types:', error)
    } finally {
        loading.value = false
    }
}

async function loadVehicles() {
    try {
        const data = await $fetch<{ vehicles: Vehicle[] }>('/api/vehicles')
        vehicles.value = data.vehicles
    } catch (error) {
        console.error('Failed to load vehicles:', error)
    }
}

function openModal() {
    editingId.value = null
    form.value = {
        title: '',
        vehicleId: null,
        defaultIntervalKm: null,
        defaultIntervalMonths: null,
        defaultDaysBeforeAlert: null,
        defaultKmBeforeAlert: null
    }
    showModal.value = true
    formError.value = ''
}

function editMaintenanceType(mt: MaintenanceType) {
    editingId.value = mt.id
    form.value = {
        title: mt.title,
        vehicleId: mt.vehicleId,
        defaultIntervalKm: mt.defaultIntervalKm,
        defaultIntervalMonths: mt.defaultIntervalMonths,
        defaultDaysBeforeAlert: mt.defaultDaysBeforeAlert,
        defaultKmBeforeAlert: mt.defaultKmBeforeAlert
    }
    showModal.value = true
    formError.value = ''
}

function closeModal() {
    showModal.value = false
    editingId.value = null
}

async function saveMaintenanceType() {
    if (!form.value.title) {
        formError.value = t('maintenance.titleRequired')
        return
    }

    saving.value = true
    formError.value = ''

    try {
        const body = {
            title: form.value.title,
            vehicleId: form.value.vehicleId,
            defaultIntervalKm: form.value.defaultIntervalKm,
            defaultIntervalMonths: form.value.defaultIntervalMonths,
            defaultDaysBeforeAlert: form.value.defaultDaysBeforeAlert,
            defaultKmBeforeAlert: form.value.defaultKmBeforeAlert
        }

        if (editingId.value) {
            await $fetch(`/api/maintenance_types/${editingId.value}`, {
                method: 'PUT',
                body
            })
        } else {
            await $fetch('/api/maintenance_types', {
                method: 'POST',
                body
            })
        }
        closeModal()
        await loadMaintenanceTypes()
    } catch (error: any) {
        formError.value = error.data?.message || t('common.saveError')
    } finally {
        saving.value = false
    }
}

onMounted(async () => {
    await Promise.all([loadMaintenanceTypes(), loadVehicles()])
})
</script>

<style scoped>
.maintenance-types-page {
    padding: var(--space-lg);
}

.page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: var(--space-lg);
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
    min-height: 40vh;
    text-align: center;
    color: var(--color-text-secondary);
}

.empty-icon {
    font-size: 4rem;
    margin-bottom: var(--space-lg);
}

.empty-state h2 {
    font-size: 1.25rem;
    color: var(--color-text-primary);
}

.maintenance-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
}

.vehicle-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
}

.group-title {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-text-secondary);
}

.group-icon {
    font-size: 1.2rem;
}

.cards-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.maintenance-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) var(--space-lg);
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
}

.maintenance-card:hover {
    transform: translateX(4px);
    box-shadow: var(--shadow-lg);
}

.card-content {
    flex: 1;
}

.card-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: var(--space-xs);
}

.card-details {
    display: flex;
    gap: var(--space-lg);
    flex-wrap: wrap;
}

.detail-item {
    display: flex;
    gap: var(--space-xs);
    font-size: 0.85rem;
}

.detail-label {
    color: var(--color-text-muted);
}

.detail-value {
    color: var(--color-accent);
    font-weight: 500;
}

.no-interval {
    color: var(--color-text-muted);
    font-style: italic;
}

.card-arrow {
    font-size: 1.5rem;
    color: var(--color-text-muted);
    font-weight: 300;
}

.spinner-lg {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
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
    max-width: 450px;
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

.btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-secondary {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
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
