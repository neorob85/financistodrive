<template>
    <div class="transaction-form-page">
        <header class="form-header">
            <button class="back-btn" @click="goBack">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
            </button>
            <h1>🚗 Spesa Auto/Moto</h1>
            <div class="header-spacer"></div>
        </header>

        <form @submit.prevent="handleSubmit" class="transaction-form">
            <!-- Tab Toggle: Rifornimento / Manutenzione -->
            <div class="type-toggle-section">
                <div class="type-toggle">
                    <button type="button" class="type-btn" :class="{ active: activeTab === 'fuel' }"
                        @click="activeTab = 'fuel'">
                        <span class="type-icon">⛽</span>
                        <span class="type-text">Rifornimento</span>
                    </button>
                    <button type="button" class="type-btn" :class="{ active: activeTab === 'maintenance' }"
                        @click="activeTab = 'maintenance'">
                        <span class="type-icon">🔧</span>
                        <span class="type-text">Manutenzione</span>
                    </button>
                </div>
            </div>

            <!-- Amount Section (top of form for both tabs) -->
            <div class="amount-section">
                <span class="amount-sign expense">−</span>
                <input v-if="activeTab === 'fuel'" v-model.number="form.fuelTotal" type="number" step="0.01" min="0"
                    placeholder="0.00" class="amount-input" @input="onFuelFieldEdit('total')">
                <input v-else v-model.number="form.maintenanceAmount" type="number" step="0.01" min="0"
                    placeholder="0.00" class="amount-input">
                <span class="currency-symbol">€</span>
            </div>

            <!-- Date -->
            <div class="input-group">
                <label for="date">Data *</label>
                <input id="date" v-model="form.transactionDate" type="datetime-local" class="input-field" required>
            </div>

            <!-- Vehicle Selection -->
            <div class="input-group">
                <label for="vehicle">Veicolo *</label>
                <select id="vehicle" v-model="form.vehicleId" class="input-field" required>
                    <option :value="null" disabled>-- Seleziona veicolo --</option>
                    <option v-for="v in vehicles.filter(v => v.isActive)" :key="v.id" :value="v.id">
                        {{ v.brand }} {{ v.model }} ({{ v.licensePlate }})
                    </option>
                </select>
            </div>

            <!-- Odometer -->
            <div class="input-group">
                <label for="odometer">Chilometraggio *</label>
                <input id="odometer" v-model.number="form.odometer" type="number" min="0" class="input-field"
                    placeholder="es. 45000" required>
            </div>

            <!-- FUEL TAB FIELDS -->
            <template v-if="activeTab === 'fuel'">
                <!-- Fuel Type -->
                <div class="input-group">
                    <label for="fuelType">Tipo carburante *</label>
                    <select id="fuelType" v-model="form.fuelTypeId" class="input-field" required>
                        <option :value="null" disabled>-- Seleziona --</option>
                        <option v-for="f in fuels" :key="f.id" :value="f.id">{{ f.title }}</option>
                    </select>
                </div>

                <!-- Fuel Volume -->
                <div class="input-group">
                    <label for="fuelVolume">Litri</label>
                    <input id="fuelVolume" v-model.number="form.fuelVolume" type="number" step="0.01" min="0"
                        class="input-field" placeholder="es. 45.50" @input="onFuelFieldEdit('volume')">
                </div>

                <!-- Price per Liter -->
                <div class="input-group">
                    <label for="pricePerLiter">Prezzo/Litro (€)</label>
                    <input id="pricePerLiter" v-model.number="form.pricePerLiter" type="number" step="0.001" min="0"
                        class="input-field" placeholder="es. 1.789" @input="onFuelFieldEdit('price')">
                </div>

                <!-- Full Tank -->
                <div class="checkbox-row">
                    <label class="checkbox-label">
                        <input type="checkbox" v-model="form.isFullTank">
                        <span>Pieno completo</span>
                    </label>
                </div>

                <!-- Previous Missed -->
                <div class="checkbox-row">
                    <label class="checkbox-label">
                        <input type="checkbox" v-model="form.isPreviousMissed">
                        <span>Rifornimento precedente mancante</span>
                    </label>
                </div>
            </template>

            <!-- MAINTENANCE TAB FIELDS -->
            <template v-if="activeTab === 'maintenance'">
                <!-- Category -->
                <div class="input-group">
                    <label for="maintCategory">Categoria</label>
                    <select id="maintCategory" v-model="form.categoryId" class="input-field">
                        <option :value="null">-- Nessuna categoria --</option>
                        <option v-for="cat in flatCategories" :key="cat.id" :value="cat.id">
                            {{ cat.indent }}{{ cat.title }}
                        </option>
                    </select>
                </div>

                <!-- Maintenance Types Section -->
                <div class="maintenance-types-section">
                    <div class="section-header">
                        <label>Tipi di Manutenzione</label>
                        <button type="button" class="add-type-btn" @click="addMaintenanceItem">
                            + Aggiungi tipo
                        </button>
                    </div>

                    <!-- Maintenance items list -->
                    <div v-if="maintenanceItems.length === 0" class="no-items-hint">
                        Nessun tipo specificato. Verrà creata una manutenzione generica.
                    </div>

                    <div v-for="(item, index) in maintenanceItems" :key="index" class="maintenance-item">
                        <div class="item-row">
                            <select v-model="item.typeId" class="input-field item-type">
                                <option :value="null">-- Tipo --</option>
                                <option v-for="m in filteredMaintenanceTypes" :key="m.id" :value="m.id">{{ m.title }}</option>
                            </select>
                            <input v-model.number="item.amount" type="number" step="0.01" min="0"
                                class="input-field item-amount" placeholder="€">
                            <button type="button" class="remove-item-btn"
                                @click="removeMaintenanceItem(index)">×</button>
                        </div>
                        <input v-model="item.description" type="text" class="input-field item-description"
                            placeholder="Descrizione (opzionale)">
                    </div>

                    <!-- Amount balance indicator -->
                    <div v-if="maintenanceItems.length > 0" class="amount-balance"
                        :class="{ 'balanced': isMaintenanceBalanced, 'unbalanced': !isMaintenanceBalanced }">
                        <span>Totale tipi: € {{ maintenanceItemsTotal.toFixed(2) }}</span>
                        <span v-if="!isMaintenanceBalanced" class="balance-diff">
                            ({{ maintenanceAmountDiff > 0 ? '+' : '' }}{{ maintenanceAmountDiff.toFixed(2) }} €)
                        </span>
                        <span v-else class="balance-ok">✓</span>
                    </div>
                </div>

                <!-- General Description (if no types) -->
                <div v-if="maintenanceItems.length === 0" class="input-group">
                    <label for="description">Descrizione *</label>
                    <input id="description" v-model="form.description" type="text" class="input-field"
                        placeholder="es. Manutenzione generale" required>
                </div>
            </template>

            <!-- Account -->
            <div class="input-group">
                <label for="account">Conto *</label>
                <select id="account" v-model="form.fromAccountId" class="input-field" required>
                    <option :value="null" disabled>-- Seleziona conto --</option>
                    <option v-for="acc in accounts" :key="acc.id" :value="acc.id">{{ acc.title }}</option>
                </select>
            </div>

            <!-- Category -->
            <div class="input-group">
                <label for="category">Categoria</label>
                <select id="category" v-model="form.categoryId" class="input-field">
                    <option :value="null">-- Nessuna categoria --</option>
                    <option v-for="cat in flatCategories" :key="cat.id" :value="cat.id">
                        {{ cat.indent }}{{ cat.title }}
                    </option>
                </select>
            </div>

            <!-- Notes -->
            <div class="input-group">
                <label for="notes">Note</label>
                <textarea id="notes" v-model="form.notes" class="input-field" rows="2"></textarea>
            </div>

            <!-- Attachments -->
            <div class="attachments-section">
                <label>Allegati</label>
                <div class="attachment-buttons">
                    <label class="attachment-btn">
                        <input type="file" multiple accept="image/*,.pdf,.doc,.docx" @change="handleFileSelect" hidden>
                        📁 File
                    </label>
                    <button type="button" class="attachment-btn" @click="openCamera">
                        📷 Foto
                    </button>
                </div>
                <div v-if="attachmentFiles.length > 0" class="attachment-preview">
                    <div v-for="(file, index) in attachmentFiles" :key="index" class="preview-item">
                        <span>{{ file.name }}</span>
                        <button type="button" class="remove-file-btn" @click="removeFile(index)">×</button>
                    </div>
                </div>
            </div>

            <!-- Hidden camera input -->
            <input ref="cameraInput" type="file" accept="image/*" capture="environment" @change="handleFileSelect"
                hidden>

            <!-- Error message -->
            <div v-if="formError" class="form-error">{{ formError }}</div>

            <!-- Actions -->
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" @click="goBack">Annulla</button>
                <button type="submit" class="btn btn-primary" :disabled="saving">
                    <span v-if="saving" class="spinner"></span>
                    Salva
                </button>
            </div>
        </form>
    </div>
</template>

<script setup lang="ts">
definePageMeta({
    layout: 'default'
})

interface Account {
    id: number
    title: string
}

interface Category {
    id: number
    title: string
    parentId: number | null
    isAutomotive: boolean
    isActive: boolean
    children?: Category[]
}

interface FlatCategory {
    id: number
    title: string
    indent: string
}

interface Vehicle {
    id: number
    brand: string
    model: string
    licensePlate: string
    currentMileage: number | null
    isActive: boolean
}

interface Fuel {
    id: number
    title: string
}

interface MaintenanceType {
    id: number
    title: string
    vehicleId: number | null
}

const router = useRouter()
const route = useRoute()

// Read vehicleId from query params (when coming from vehicle detail page)
const queryVehicleId = computed(() => route.query.vehicleId ? Number(route.query.vehicleId) : null)

const activeTab = ref<'fuel' | 'maintenance'>('fuel')

const accounts = ref<Account[]>([])
const categories = ref<Category[]>([])
const vehicles = ref<Vehicle[]>([])
const fuels = ref<Fuel[]>([])
const maintenanceTypes = ref<MaintenanceType[]>([])

const formError = ref('')
const saving = ref(false)
const attachmentFiles = ref<File[]>([])
const cameraInput = ref<HTMLInputElement | null>(null)

// Multi-maintenance items
interface MaintenanceItem {
    typeId: number | null
    amount: number | null
    description: string
}
const maintenanceItems = ref<MaintenanceItem[]>([])

const form = ref({
    transactionDate: (() => { const n = new Date(); return new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 16) })(),
    vehicleId: null as number | null,
    odometer: null as number | null,
    fromAccountId: null as number | null,
    categoryId: null as number | null,
    notes: '',
    // Fuel specific
    fuelTypeId: null as number | null,
    fuelVolume: null as number | null,
    pricePerLiter: null as number | null,
    fuelTotal: null as number | null,
    isFullTank: true,
    isPreviousMissed: false,
    // Maintenance specific
    maintenanceTypeId: null as number | null,
    maintenanceAmount: null as number | null,
    description: ''
})

// Filter maintenance types by selected vehicle (null = general, or matching vehicleId)
const filteredMaintenanceTypes = computed(() => {
    return maintenanceTypes.value.filter(mt =>
        mt.vehicleId === null || mt.vehicleId === form.value.vehicleId
    )
})

// Fuel auto-calculation: when 2 of 3 fields are filled, calculate the 3rd
const fuelLastEdited = ref<string[]>([])
const isAutoCalc = ref(false)

function onFuelFieldEdit(field: string) {
    if (isAutoCalc.value) return
    fuelLastEdited.value = [field, ...fuelLastEdited.value.filter(f => f !== field)].slice(0, 2)
    autoCalcFuel()
}

function autoCalcFuel() {
    const edited = fuelLastEdited.value
    if (edited.length < 2) return

    const v = form.value.fuelVolume
    const p = form.value.pricePerLiter
    const t = form.value.fuelTotal

    isAutoCalc.value = true

    if (edited.includes('volume') && edited.includes('price') && v && p) {
        form.value.fuelTotal = Math.round(v * p * 100) / 100
    } else if (edited.includes('volume') && edited.includes('total') && v && t) {
        form.value.pricePerLiter = Math.round((t / v) * 1000) / 1000
    } else if (edited.includes('price') && edited.includes('total') && p && t) {
        form.value.fuelVolume = Math.round((t / p) * 100) / 100
    }

    isAutoCalc.value = false
}


// Computed for maintenance items
const maintenanceItemsTotal = computed(() => {
    return maintenanceItems.value.reduce((sum, item) => sum + (item.amount || 0), 0)
})

const maintenanceAmountDiff = computed(() => {
    return maintenanceItemsTotal.value - (form.value.maintenanceAmount || 0)
})

const isMaintenanceBalanced = computed(() => {
    if (maintenanceItems.value.length === 0) return true
    return Math.abs(maintenanceAmountDiff.value) < 0.01
})

// Functions for maintenance items
function addMaintenanceItem() {
    maintenanceItems.value.push({
        typeId: null,
        amount: null,
        description: ''
    })
}

function removeMaintenanceItem(index: number) {
    maintenanceItems.value.splice(index, 1)
}

// Filter to show only automotive categories
const flatCategories = computed(() => {
    const result: FlatCategory[] = []
    const cats = categories.value

    const categoryMap = new Map<number, Category & { children: (Category & { children: any[] })[] }>()
    const rootCategories: (Category & { children: any[] })[] = []

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

    function hasAutomotiveDescendant(cat: Category & { children?: any[] }): boolean {
        if (cat.isAutomotive) return true
        if (cat.children && cat.children.length > 0) {
            return cat.children.some(child => hasAutomotiveDescendant(child))
        }
        return false
    }

    function flatten(items: (Category & { children?: any[] })[], level = 0) {
        for (const cat of items) {
            const shouldShow = hasAutomotiveDescendant(cat)
            if (shouldShow) {
                if (cat.isActive !== false) {
                    const prefix = level > 0 ? '└' + '─'.repeat(level) + ' ' : ''
                    result.push({
                        id: cat.id,
                        title: cat.title,
                        indent: prefix
                    })
                }
                if (cat.children && cat.children.length > 0) {
                    flatten(cat.children, level + 1)
                }
            }
        }
    }

    flatten(rootCategories)
    return result
})

function goBack() {
    if (queryVehicleId.value) {
        router.push(`/vehicles/${queryVehicleId.value}`)
    } else {
        router.push('/transactions')
    }
}

async function handleSubmit() {
    // Validation
    if (!form.value.vehicleId || !form.value.odometer || !form.value.fromAccountId || !form.value.transactionDate) {
        formError.value = 'Compila tutti i campi obbligatori'
        return
    }

    if (activeTab.value === 'fuel') {
        if (!form.value.fuelTypeId || !form.value.fuelVolume || !form.value.pricePerLiter || !form.value.fuelTotal) {
            formError.value = 'Compila almeno 2 campi tra Litri, Prezzo/Litro e Totale'
            return
        }
    } else {
        if (!form.value.maintenanceAmount) {
            formError.value = 'Inserisci l\'importo della manutenzione'
            return
        }
        // If no maintenance items, require description
        if (maintenanceItems.value.length === 0 && !form.value.description) {
            formError.value = 'Inserisci una descrizione per la manutenzione'
            return
        }
        // If maintenance items exist, check balance
        if (maintenanceItems.value.length > 0 && !isMaintenanceBalanced.value) {
            formError.value = 'La somma degli importi dei tipi deve essere uguale all\'importo totale'
            return
        }
    }

    saving.value = true
    formError.value = ''

    try {
        const amount = activeTab.value === 'fuel'
            ? form.value.fuelTotal
            : form.value.maintenanceAmount

        const body: any = {
            type: activeTab.value,
            transactionDate: form.value.transactionDate,
            vehicleId: form.value.vehicleId,
            odometer: form.value.odometer,
            fromAccountId: form.value.fromAccountId,
            categoryId: form.value.categoryId,
            notes: form.value.notes,
            amount: amount
        }

        if (activeTab.value === 'fuel') {
            body.fuelTypeId = form.value.fuelTypeId
            body.fuelVolume = form.value.fuelVolume
            body.pricePerLiter = form.value.pricePerLiter
            body.isFullTank = form.value.isFullTank
            body.isPreviousMissed = form.value.isPreviousMissed
        } else {
            // Multi-maintenance items or single generic
            if (maintenanceItems.value.length > 0) {
                body.maintenanceItems = maintenanceItems.value.map(item => ({
                    typeId: item.typeId,
                    amount: item.amount,
                    description: item.description || ''
                }))
            } else {
                // Single generic maintenance (no type)
                body.description = form.value.description
            }
        }

        const result = await $fetch<{ id: number }>('/api/transactions/automotive', {
            method: 'POST',
            body
        })

        // Upload attachments if any
        if (attachmentFiles.value.length > 0 && result.id) {
            const formData = new FormData()
            for (const file of attachmentFiles.value) {
                formData.append('files', file)
            }

            await $fetch(`/api/transactions/${result.id}/attachments`, {
                method: 'POST',
                body: formData
            })
        }

        if (queryVehicleId.value) {
            router.push(`/vehicles/${queryVehicleId.value}`)
        } else {
            router.push('/transactions')
        }
    } catch (error: any) {
        formError.value = error?.data?.message || 'Errore nel salvataggio'
    } finally {
        saving.value = false
    }
}

// File handling functions
function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement
    if (input.files) {
        attachmentFiles.value.push(...Array.from(input.files))
    }
}

function removeFile(index: number) {
    attachmentFiles.value.splice(index, 1)
}

function openCamera() {
    cameraInput.value?.click()
}

async function loadDropdownData() {
    try {
        const [accountsData, categoriesData, vehiclesData, fuelsData, maintenanceTypesData] = await Promise.all([
            $fetch<{ accounts: Account[] }>('/api/accounts'),
            $fetch<{ categories: Category[] }>('/api/categories'),
            $fetch<{ vehicles: Vehicle[] }>('/api/vehicles'),
            $fetch<{ fuels: Fuel[] }>('/api/fuels'),
            $fetch<{ maintenanceTypes: MaintenanceType[] }>('/api/maintenance_types')
        ])

        accounts.value = accountsData.accounts || []
        categories.value = categoriesData.categories || []
        vehicles.value = vehiclesData.vehicles || []
        fuels.value = fuelsData.fuels || []
        maintenanceTypes.value = maintenanceTypesData.maintenanceTypes || []

        // Auto-select vehicle from query param or first vehicle
        if (queryVehicleId.value) {
            const qVehicle = vehicles.value.find(v => v.id === queryVehicleId.value)
            if (qVehicle) {
                form.value.vehicleId = qVehicle.id
                form.value.odometer = qVehicle.currentMileage || 0
            }
        } else if (vehicles.value.length > 0) {
            form.value.vehicleId = vehicles.value[0].id
            form.value.odometer = vehicles.value[0].currentMileage || 0
        }

        // Auto-select fuel type based on vehicle
        if (fuels.value.length > 0) {
            const selectedVehicle = vehicles.value.find(v => v.id === form.value.vehicleId) as any
            if (selectedVehicle?.fuelId) {
                form.value.fuelTypeId = selectedVehicle.fuelId
            }
        }
    } catch (error) {
        console.error('Failed to load dropdown data:', error)
    }
}

// Update odometer when vehicle changes
watch(() => form.value.vehicleId, (newVehicleId) => {
    if (newVehicleId) {
        const vehicle = vehicles.value.find(v => v.id === newVehicleId)
        if (vehicle?.currentMileage) {
            form.value.odometer = vehicle.currentMileage
        }
    }
})

onMounted(() => {
    loadDropdownData()
})
</script>

<style scoped>
.transaction-form-page {
    min-height: 100vh;
    padding-bottom: calc(var(--space-xl) * 2);
}

.form-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) var(--space-lg);
    background: var(--color-bg-elevated);
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    z-index: 10;
}

.back-btn {
    background: none;
    border: none;
    color: var(--color-text-primary);
    cursor: pointer;
    padding: var(--space-xs);
}

.form-header h1 {
    font-size: 1.1rem;
    font-weight: 600;
}

.header-spacer {
    width: 32px;
}

.transaction-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    padding: var(--space-lg);
    max-width: 700px;
    margin: 0 auto;
}

/* Type Toggle */
.type-toggle-section {
    margin-bottom: var(--space-sm);
}

.type-toggle {
    display: flex;
    background: var(--color-bg-elevated);
    border-radius: var(--radius-lg);
    padding: 4px;
    gap: 4px;
}

.type-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: var(--space-sm) var(--space-xs);
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s;
    color: var(--color-text-muted);
}

.type-btn.active {
    background: var(--color-accent-bg);
    color: var(--color-accent);
}

.type-icon {
    font-size: 1.3rem;
}

.type-text {
    font-size: 0.7rem;
    font-weight: 500;
}

/* Amount Section */
.amount-section {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    background: var(--color-bg-elevated);
    padding: var(--space-md);
    border-radius: var(--radius-lg);
    overflow: hidden;
}

.amount-sign {
    font-size: 1.5rem;
    font-weight: 700;
    min-width: 32px;
    text-align: center;
}

.amount-sign.expense {
    color: var(--color-error);
}

.amount-input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    font-size: 2rem;
    font-weight: 700;
    color: var(--color-text-primary);
    text-align: right;
    outline: none;
}

.amount-input:read-only {
    opacity: 0.7;
}

.amount-input::placeholder {
    color: var(--color-text-muted);
}

.currency-symbol {
    font-size: 1.5rem;
    color: var(--color-text-muted);
    flex-shrink: 0;
}

/* Input Groups */
.input-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
}

.input-group label {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    font-weight: 500;
}

/* Checkbox Row */
.checkbox-row {
    display: flex;
    gap: var(--space-lg);
    padding: var(--space-sm) 0;
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    cursor: pointer;
    font-size: 0.9rem;
}

.checkbox-label input {
    width: 20px;
    height: 20px;
    accent-color: var(--color-accent);
}

/* Form Error */
.form-error {
    background: var(--color-error-bg);
    color: var(--color-error);
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
}

/* Actions */
.form-actions {
    display: flex;
    gap: var(--space-md);
    margin-top: var(--space-md);
}

.btn {
    flex: 1;
    padding: var(--space-md);
    border-radius: var(--radius-md);
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
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
    width: 18px;
    height: 18px;
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

/* Attachments */
.attachments-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.attachments-section>label {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    font-weight: 500;
}

.attachment-buttons {
    display: flex;
    gap: var(--space-sm);
}

.attachment-btn {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-sm) var(--space-md);
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 0.9rem;
}

.attachment-preview {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
}

.preview-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-xs) var(--space-sm);
    background: var(--color-bg-elevated);
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
}

.preview-item span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.remove-file-btn {
    background: none;
    border: none;
    color: var(--color-error);
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0 var(--space-xs);
}

/* Multi-maintenance items */
.maintenance-types-section {
    margin-top: var(--space-md);
    padding: var(--space-md);
    background: var(--color-bg-elevated);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-md);
}

.section-header label {
    font-weight: 600;
    color: var(--color-text-primary);
}

.add-type-btn {
    padding: var(--space-xs) var(--space-sm);
    background: var(--color-accent);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.85rem;
    transition: opacity 0.2s;
}

.add-type-btn:hover {
    opacity: 0.9;
}

.no-items-hint {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    text-align: center;
    padding: var(--space-md);
    font-style: italic;
}

.maintenance-item {
    margin-bottom: var(--space-sm);
    padding: var(--space-sm);
    background: var(--color-bg-glass);
    border-radius: var(--radius-sm);
}

.item-row {
    display: flex;
    gap: var(--space-sm);
    align-items: center;
    margin-bottom: var(--space-xs);
}

.item-type {
    flex: 2;
}

.item-amount {
    flex: 1;
    min-width: 80px;
}

.item-description {
    font-size: 0.9rem;
}

.remove-item-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-error-bg, var(--color-error-bg));
    color: var(--color-error);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 1.2rem;
    font-weight: bold;
    transition: background 0.2s;
}

.remove-item-btn:hover {
    background: var(--color-error);
    color: white;
}

.amount-balance {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm);
    margin-top: var(--space-sm);
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
    font-weight: 500;
}

.amount-balance.balanced {
    background: var(--color-success-bg);
    color: var(--color-success);
}

.amount-balance.unbalanced {
    background: var(--color-error-bg, var(--color-error-bg));
    color: var(--color-error);
}

.balance-diff {
    font-weight: 600;
}

.balance-ok {
    font-size: 1.1rem;
}
</style>
