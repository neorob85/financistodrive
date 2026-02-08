<template>
    <div class="transaction-form-page">
        <header class="form-header">
            <button class="back-btn" @click="goBack">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
            </button>
            <h1>⛽ Modifica Rifornimento</h1>
            <div class="header-spacer"></div>
        </header>

        <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <p>Caricamento...</p>
        </div>

        <div v-else-if="loadError" class="error-state">
            <p>{{ loadError }}</p>
            <button class="btn btn-secondary" @click="goBack">Torna indietro</button>
        </div>

        <form v-else @submit.prevent="handleSubmit" class="transaction-form">
            <!-- Amount -->
            <div class="amount-section">
                <span class="amount-sign expense">−</span>
                <input v-model.number="form.fuelTotal" type="number" step="0.01" min="0" placeholder="0.00"
                    class="amount-input" @input="onFuelFieldEdit('total')">
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
                    <option v-for="v in vehicles.filter(v => v.isActive || v.id === form.vehicleId)" :key="v.id" :value="v.id">
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
                <textarea id="notes" v-model="form.notes" class="input-field" rows="2"
                    placeholder="Note aggiuntive..."></textarea>
            </div>

            <!-- Error message -->
            <div v-if="formError" class="form-error">{{ formError }}</div>

            <!-- Actions -->
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" @click="goBack">Annulla</button>
                <button type="submit" class="btn btn-primary" :disabled="saving">
                    <span v-if="saving" class="spinner"></span>
                    Salva Modifiche
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
    isActive: boolean
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
    isActive: boolean
}

interface Fuel {
    id: number
    title: string
}

const router = useRouter()
const route = useRoute()
const transactionId = computed(() => Number(route.params.id))

const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const formError = ref('')

const accounts = ref<Account[]>([])
const categories = ref<Category[]>([])
const vehicles = ref<Vehicle[]>([])
const fuels = ref<Fuel[]>([])

const form = ref({
    transactionDate: '',
    vehicleId: null as number | null,
    odometer: null as number | null,
    fromAccountId: null as number | null,
    categoryId: null as number | null,
    fuelTypeId: null as number | null,
    fuelVolume: null as number | null,
    pricePerLiter: null as number | null,
    fuelTotal: null as number | null,
    isFullTank: true,
    isPreviousMissed: false,
    notes: ''
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

    function flatten(cats: (Category & { children: any[] })[], level: number) {
        for (const cat of cats) {
            if (cat.isActive !== false) {
                result.push({
                    id: cat.id,
                    title: cat.title,
                    indent: '  '.repeat(level) + (level > 0 ? '└ ' : '')
                })
            }
            if (cat.children.length > 0) {
                flatten(cat.children, level + 1)
            }
        }
    }
    flatten(rootCategories, 0)
    return result
})

function goBack() {
    router.back()
}

async function loadData() {
    try {
        loading.value = true
        loadError.value = ''

        // Load accounts, categories, vehicles, fuels
        const [accRes, catRes, vehRes, fuelRes] = await Promise.all([
            $fetch<{ accounts: Account[] }>('/api/accounts'),
            $fetch<{ categories: Category[] }>('/api/categories'),
            $fetch<{ vehicles: Vehicle[] }>('/api/vehicles'),
            $fetch<{ fuels: Fuel[] }>('/api/fuels')
        ])

        accounts.value = accRes.accounts
        categories.value = catRes.categories
        vehicles.value = vehRes.vehicles
        fuels.value = fuelRes.fuels

        // Load transaction with fuel log
        const txRes = await $fetch<{ transaction: any }>(`/api/transactions/${transactionId.value}`)
        const tx = txRes.transaction

        if (!tx.isAutomotive || !tx.fuelLog) {
            loadError.value = 'Questa non è una transazione rifornimento'
            return
        }

        // Populate form with fuel log data
        const dateObj = new Date(tx.transactionDate)
        const localDate = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000)
        form.value.transactionDate = localDate.toISOString().slice(0, 16)

        form.value.vehicleId = tx.fuelLog.vehicleId
        form.value.odometer = tx.fuelLog.odometer
        form.value.fromAccountId = tx.fromAccountId
        form.value.categoryId = tx.categoryId
        form.value.fuelTypeId = tx.fuelLog.fuelTypeId
        form.value.fuelVolume = tx.fuelLog.fuelVolume
        form.value.pricePerLiter = tx.fuelLog.fuelPricePerUnit
        form.value.fuelTotal = tx.fuelLog.totalCost
        form.value.isFullTank = tx.fuelLog.isFullTank
        form.value.isPreviousMissed = tx.fuelLog.isPreviousMissed || false
        form.value.notes = tx.notes || ''

    } catch (error: any) {
        loadError.value = error.data?.message || 'Errore nel caricamento'
    } finally {
        loading.value = false
    }
}

async function handleSubmit() {
    if (!form.value.vehicleId || !form.value.odometer || !form.value.fromAccountId || !form.value.transactionDate) {
        formError.value = 'Compila tutti i campi obbligatori'
        return
    }

    if (!form.value.fuelTypeId || !form.value.fuelVolume || !form.value.pricePerLiter || !form.value.fuelTotal) {
        formError.value = 'Compila almeno 2 campi tra Litri, Prezzo/Litro e Totale'
        return
    }

    saving.value = true
    formError.value = ''

    try {
        const amount = form.value.fuelTotal

        await $fetch(`/api/transactions/${transactionId.value}/automotive`, {
            method: 'PUT',
            body: {
                type: 'fuel',
                transactionDate: form.value.transactionDate,
                vehicleId: form.value.vehicleId,
                odometer: form.value.odometer,
                fromAccountId: form.value.fromAccountId,
                categoryId: form.value.categoryId,
                notes: form.value.notes,
                amount: amount,
                fuelTypeId: form.value.fuelTypeId,
                fuelVolume: form.value.fuelVolume,
                pricePerLiter: form.value.pricePerLiter,
                isFullTank: form.value.isFullTank,
                isPreviousMissed: form.value.isPreviousMissed
            }
        })

        router.back()
    } catch (error: any) {
        formError.value = error.data?.message || 'Errore nel salvataggio'
    } finally {
        saving.value = false
    }
}

onMounted(() => {
    loadData()
})
</script>

<style scoped>
.transaction-form-page {
    min-height: 100vh;
    background: var(--color-bg-primary);
}

.form-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md);
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
}

.form-header h1 {
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

.transaction-form {
    padding: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
}

.amount-section {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    padding: var(--space-lg) 0;
    background: var(--color-bg-elevated);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-sm);
}

.amount-sign {
    font-size: 2rem;
    font-weight: 300;
}

.amount-sign.expense {
    color: var(--color-expense);
}

.amount-input {
    font-size: 2.5rem;
    font-weight: 600;
    background: none;
    border: none;
    text-align: center;
    width: 200px;
    color: var(--color-text-primary);
}

.amount-input:read-only {
    color: var(--color-expense);
}

.amount-input:focus {
    outline: none;
}

.currency-symbol {
    font-size: 1.5rem;
    color: var(--color-text-muted);
}

.input-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
}

.input-group label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--color-text-muted);
}

.input-field {
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-elevated);
    color: var(--color-text-primary);
    font-size: 1rem;
}

.input-field:focus {
    outline: none;
    border-color: var(--color-accent);
}

.checkbox-row {
    display: flex;
    align-items: center;
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    cursor: pointer;
    font-size: 0.95rem;
    color: var(--color-text-primary);
}

.checkbox-label input[type="checkbox"] {
    width: 20px;
    height: 20px;
    accent-color: var(--color-accent);
}

.form-error {
    padding: var(--space-sm) var(--space-md);
    background: var(--color-error-bg);
    border: 1px solid var(--color-error);
    border-radius: var(--radius-md);
    color: var(--color-error);
    font-size: 0.9rem;
}

.form-actions {
    display: flex;
    gap: var(--space-md);
    padding-top: var(--space-md);
}

.btn {
    flex: 1;
    padding: var(--space-md);
    border-radius: var(--radius-md);
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
}

.btn-primary {
    background: var(--color-accent);
    color: white;
}

.btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-secondary {
    background: var(--color-bg-elevated);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);
}

.spinner {
    width: 20px;
    height: 20px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
