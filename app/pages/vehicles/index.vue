<template>
    <div class="vehicles-page">
        <div class="page-header-row">
            <h1 class="page-title">{{ $t('vehicles.title') }}</h1>
            <div class="page-actions">
                <button class="filter-chip" :class="{ active: showActiveOnly }" @click="showActiveOnly = !showActiveOnly">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {{ $t('common.activeOnly') }}
                </button>
                <button class="action-chip" @click="router.push('/alerts')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    {{ $t('vehicles.alerts') }}
                </button>
                <button class="action-chip" @click="router.push('/maintenance_types')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                    {{ $t('vehicles.maintenanceTypes') }}
                </button>
            </div>
        </div>

        <!-- Loading state -->
        <div v-if="loading" class="loading-state">
            <div class="spinner-lg"></div>
        </div>

        <!-- Empty state -->
        <div v-else-if="filteredVehicles.length === 0" class="empty-state">
            <div class="empty-icon">🚗</div>
            <h2>{{ $t('vehicles.noVehicles') }}</h2>
            <p>{{ $t('vehicles.addFirst') }}</p>
        </div>

        <!-- Vehicles grid -->
        <div v-else class="vehicles-grid">
            <div v-for="vehicle in filteredVehicles" :key="vehicle.id" class="vehicle-card glass-card"
                :class="{ inactive: !vehicle.isActive }" @click="viewVehicle(vehicle.id)">
                <div class="card-header">
                    <button class="edit-btn" @click.stop="editVehicle(vehicle)" :title="$t('vehicles.edit')">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                    </button>
                    <div class="card-badges">
                        <span v-if="!vehicle.isActive" class="inactive-badge">{{ $t('common.inactive') }}</span>
                        <span v-if="vehicle.alertsOverdue > 0" class="alert-badge overdue" :title="$t('dashboard.overdueMaintenances', { count: vehicle.alertsOverdue })" @click.stop="router.push('/alerts')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                            </svg>
                            {{ vehicle.alertsOverdue }}
                        </span>
                        <span v-if="vehicle.alertsUpcoming > 0" class="alert-badge upcoming" :title="$t('dashboard.upcomingMaintenances', { count: vehicle.alertsUpcoming })" @click.stop="router.push('/alerts')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                            </svg>
                            {{ vehicle.alertsUpcoming }}
                        </span>
                    </div>
                </div>
                <h3 class="vehicle-name">{{ vehicle.brand }} {{ vehicle.model }}</h3>
                <div class="vehicle-details">
                    <span v-if="vehicle.licensePlate" class="detail-item">
                        🔖 {{ vehicle.licensePlate }}
                    </span>
                    <span v-if="vehicle.year" class="detail-item">
                        📅 {{ vehicle.year }}
                    </span>
                    <span v-if="vehicle.fuelName" class="detail-item">
                        ⛽ {{ vehicle.fuelName }}
                    </span>
                </div>
                <div v-if="vehicle.currentMileage" class="mileage">
                    <span class="mileage-label">{{ $t('vehicles.currentMileage') }}</span>
                    <span class="mileage-value">{{ formatNumber(vehicle.currentMileage) }}</span>
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
                    <h2>{{ editingId ? $t('vehicles.edit') : $t('vehicles.new') }}</h2>
                    <button class="close-btn" @click="closeModal">×</button>
                </div>
                <form @submit.prevent="saveVehicle" class="modal-form">
                    <div class="form-row">
                        <div class="input-group">
                            <label for="brand">{{ $t('vehicles.brand') }} *</label>
                            <input id="brand" v-model="form.brand" type="text" class="input-field" required>
                        </div>
                        <div class="input-group">
                            <label for="model">{{ $t('vehicles.model') }} *</label>
                            <input id="model" v-model="form.model" type="text" class="input-field" required>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="input-group">
                            <label for="licensePlate">{{ $t('vehicles.licensePlate') }}</label>
                            <input id="licensePlate" v-model="form.licensePlate" type="text" class="input-field">
                        </div>
                        <div class="input-group">
                            <label for="year">{{ $t('vehicles.year') }}</label>
                            <input id="year" v-model.number="form.year" type="number" min="1900" max="2100"
                                class="input-field">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="input-group">
                            <label for="fuelId">{{ $t('vehicles.fuel') }}</label>
                            <select id="fuelId" v-model="form.fuelId" class="input-field">
                                <option :value="null">{{ $t('vehicles.selectFuel') }}</option>
                                <option v-for="fuel in fuels" :key="fuel.id" :value="fuel.id">
                                    {{ fuel.title }}
                                </option>
                            </select>
                        </div>
                        <div class="input-group">
                            <label for="initialMileage">{{ $t('vehicles.initialMileage') }}</label>
                            <input id="initialMileage" v-model.number="form.initialMileage" type="number" min="0"
                                class="input-field">
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
                    </div>

                    <div v-if="formError" class="form-error">{{ formError }}</div>

                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" @click="closeModal">{{ $t('common.cancel') }}</button>
                        <button type="submit" class="btn btn-primary" :disabled="saving">
                            <span v-if="saving" class="spinner"></span>
                            {{ editingId ? $t('common.saveChanges') : $t('vehicles.createVehicle') }}
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

const { t, locale } = useI18n()
const router = useRouter()

interface Vehicle {
    id: number
    brand: string
    model: string
    licensePlate: string | null
    year: number | null
    fuelId: number | null
    fuelName: string | null
    initialMileage: number
    currentMileage: number | null
    isActive: boolean
    notes: string | null
    alertsUpcoming: number
    alertsOverdue: number
}

interface Fuel {
    id: number
    title: string
}

const vehicles = ref<Vehicle[]>([])
const fuels = ref<Fuel[]>([])
const loading = ref(true)
const showActiveOnly = ref(true)

const filteredVehicles = computed(() => {
    if (showActiveOnly.value) return vehicles.value.filter(v => v.isActive)
    return vehicles.value
})
const showModal = ref(false)
const saving = ref(false)
const formError = ref('')
const editingId = ref<number | null>(null)

const form = ref({
    brand: '',
    model: '',
    licensePlate: '',
    year: null as number | null,
    fuelId: null as number | null,
    initialMileage: 0,
    notes: '',
    isActive: true
})

function formatNumber(n: number) {
    return n.toLocaleString(locale.value)
}

async function loadVehicles() {
    loading.value = true
    try {
        const data = await $fetch<{ vehicles: Vehicle[] }>('/api/vehicles')
        vehicles.value = data.vehicles
    } catch (error) {
        console.error('Failed to load vehicles:', error)
    } finally {
        loading.value = false
    }
}

async function loadFuels() {
    try {
        const data = await $fetch<{ fuels: Fuel[] }>('/api/fuels')
        fuels.value = data.fuels
    } catch (error) {
        console.error('Failed to load fuels:', error)
    }
}

function openModal() {
    editingId.value = null
    form.value = {
        brand: '',
        model: '',
        licensePlate: '',
        year: null,
        fuelId: null,
        initialMileage: 0,
        notes: '',
        isActive: true
    }
    showModal.value = true
    formError.value = ''
}

function viewVehicle(id: number) {
    router.push(`/vehicles/${id}`)
}

function editVehicle(vehicle: Vehicle) {
    editingId.value = vehicle.id
    form.value = {
        brand: vehicle.brand || '',
        model: vehicle.model || '',
        licensePlate: vehicle.licensePlate || '',
        year: vehicle.year,
        fuelId: vehicle.fuelId,
        initialMileage: vehicle.initialMileage,
        notes: vehicle.notes || '',
        isActive: vehicle.isActive
    }
    showModal.value = true
    formError.value = ''
}

function closeModal() {
    showModal.value = false
    editingId.value = null
}

async function saveVehicle() {
    if (!form.value.brand || !form.value.model) {
        formError.value = t('vehicles.brandModelRequired')
        return
    }

    saving.value = true
    formError.value = ''

    try {
        const body = {
            brand: form.value.brand,
            model: form.value.model,
            licensePlate: form.value.licensePlate || null,
            year: form.value.year,
            fuelId: form.value.fuelId,
            initialMileage: form.value.initialMileage,
            notes: form.value.notes || null,
            isActive: form.value.isActive
        }

        if (editingId.value) {
            await $fetch(`/api/vehicles/${editingId.value}`, {
                method: 'PUT',
                body
            })
        } else {
            await $fetch('/api/vehicles', {
                method: 'POST',
                body
            })
        }
        closeModal()
        await loadVehicles()
    } catch (error: any) {
        formError.value = error.data?.message || t('common.saveError')
    } finally {
        saving.value = false
    }
}

onMounted(async () => {
    await Promise.all([loadVehicles(), loadFuels()])
})
</script>

<style scoped>
.vehicles-page {
    padding: var(--space-lg);
}

.page-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
}

.page-title {
    font-size: 1.5rem;
    font-weight: 700;
}

.page-actions {
    display: flex;
    gap: var(--space-sm);
}

.action-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
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

.action-chip:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
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

.vehicles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-md);
}

.vehicle-card {
    padding: var(--space-lg);
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
}

.vehicle-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
}

.vehicle-card.inactive {
    opacity: 0.6;
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-sm);
}

.edit-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s, background 0.2s;
}

.edit-btn:hover {
    color: var(--color-accent);
    background: var(--color-bg-elevated);
}

.card-badges {
    display: flex;
    gap: var(--space-xs);
    align-items: center;
}

.inactive-badge {
    background: var(--color-error-bg);
    color: var(--color-error);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    font-size: 0.7rem;
    font-weight: 500;
}

.alert-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
}

.alert-badge:hover {
    opacity: 0.8;
}

.alert-badge.overdue {
    background: var(--color-error-bg);
    color: var(--color-error);
}

.alert-badge.upcoming {
    background: var(--color-warning-bg);
    color: var(--color-warning);
}

.vehicle-name {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: var(--space-sm);
}

.vehicle-details {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    margin-bottom: var(--space-md);
}

.detail-item {
    background: var(--color-bg-elevated);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
}

.mileage {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: var(--space-sm);
    border-top: 1px solid var(--color-border);
}

.mileage-label {
    font-size: 0.8rem;
    color: var(--color-text-muted);
}

.mileage-value {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-accent);
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
    color: var(--color-text-on-accent);
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
    color: var(--color-text-on-accent);
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
