<template>
    <div class="transaction-form-page">
        <header class="form-header">
            <button class="back-btn" @click="goBack">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
            </button>
            <h1>🔧 {{ $t('transactions.editMaintenance') }}</h1>
            <div class="header-spacer"></div>
        </header>

        <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <p>{{ $t('common.loading') }}</p>
        </div>

        <div v-else-if="loadError" class="error-state">
            <p>{{ loadError }}</p>
            <button class="btn btn-secondary" @click="goBack">{{ $t('common.goBack') }}</button>
        </div>

        <form v-else @submit.prevent="handleSubmit" class="transaction-form">
            <!-- Total Amount -->
            <div class="amount-section">
                <span class="amount-sign expense">−</span>
                <input v-model.number="form.maintenanceAmount" type="number" step="0.01" min="0" placeholder="0.00"
                    class="amount-input">
                <span class="currency-symbol">€</span>
            </div>

            <!-- Date -->
            <div class="input-group">
                <label for="date">{{ $t('transactions.date') }} *</label>
                <input id="date" v-model="form.transactionDate" type="datetime-local" class="input-field" required>
            </div>

            <!-- Vehicle Selection -->
            <div class="input-group">
                <label for="vehicle">{{ $t('automotive.vehicle') }} *</label>
                <select id="vehicle" v-model="form.vehicleId" class="input-field" required>
                    <option :value="null" disabled>{{ $t('automotive.selectVehicle') }}</option>
                    <option v-for="v in vehicles.filter(v => v.isActive || v.id === form.vehicleId)" :key="v.id"
                        :value="v.id">
                        {{ v.brand }} {{ v.model }} ({{ v.licensePlate }})
                    </option>
                </select>
            </div>

            <!-- Odometer -->
            <div class="input-group">
                <label for="odometer">{{ $t('automotive.mileage') }} *</label>
                <input id="odometer" v-model.number="form.odometer" type="number" min="0" class="input-field"
                    placeholder="es. 45000" required>
            </div>

            <!-- Category -->
            <div class="input-group">
                <label for="category">{{ $t('transactions.category') }}</label>
                <select id="category" v-model="form.categoryId" class="input-field">
                    <option :value="null">{{ $t('transactions.noCategory') }}</option>
                    <option v-for="cat in flatCategories" :key="cat.id" :value="cat.id">
                        {{ cat.indent }}{{ cat.title }}
                    </option>
                </select>
            </div>

            <!-- Maintenance Types Section -->
            <div class="maintenance-types-section">
                <div class="section-header">
                    <label>{{ $t('automotive.maintenanceTypesLabel') }}</label>
                    <button type="button" class="add-type-btn" @click="addMaintenanceItem">
                        {{ $t('automotive.addType') }}
                    </button>
                </div>

                <!-- Maintenance items list -->
                <div v-if="maintenanceItems.length === 0" class="no-items-hint">
                    {{ $t('automotive.noTypesHintEdit') }}
                </div>

                <div v-for="(item, index) in maintenanceItems" :key="index" class="maintenance-item">
                    <div class="item-row">
                        <select v-model="item.typeId" class="input-field item-type">
                            <option :value="null">{{ $t('automotive.selectType') }}</option>
                            <option v-for="mt in filteredMaintenanceTypes" :key="mt.id" :value="mt.id">{{ mt.title }}
                            </option>
                        </select>
                        <input v-model.number="item.amount" type="number" step="0.01" min="0"
                            class="input-field item-amount" placeholder="€">
                        <button type="button" class="remove-item-btn" @click="removeMaintenanceItem(index)">×</button>
                    </div>
                    <input v-model="item.description" type="text" class="input-field item-description"
                        :placeholder="$t('automotive.descriptionOptional')">
                </div>

                <!-- Balance indicator -->
                <div v-if="maintenanceItems.length > 0" class="amount-balance"
                    :class="{ balanced: isMaintenanceBalanced, unbalanced: !isMaintenanceBalanced }">
                    <span v-if="isMaintenanceBalanced" class="balance-ok">✓ {{ $t('automotive.amountsBalanced') }}</span>
                    <span v-else class="balance-diff">
                        {{ $t('automotive.difference') }}: {{ maintenanceAmountDiff > 0 ? '+' : '' }}{{ maintenanceAmountDiff.toFixed(2) }} €
                    </span>
                </div>
            </div>

            <!-- Description (when no items) -->
            <div v-if="maintenanceItems.length === 0" class="input-group">
                <label for="description">{{ $t('automotive.descriptionRequired') }} *</label>
                <input id="description" v-model="form.description" type="text" class="input-field"
                    :placeholder="$t('automotive.exampleAnnualService')">
            </div>

            <!-- Account -->
            <div class="input-group">
                <label for="account">{{ $t('transactions.account') }} *</label>
                <select id="account" v-model="form.fromAccountId" class="input-field" required>
                    <option :value="null" disabled>{{ $t('transactions.selectAccount') }}</option>
                    <option v-for="acc in accounts" :key="acc.id" :value="acc.id">{{ acc.title }}</option>
                </select>
            </div>

            <!-- Attachments Section -->
            <div class="attachments-section">
                <label>{{ $t('transactions.attachments') }}</label>

                <!-- Existing attachments -->
                <div v-if="attachments.length > 0" class="attachment-preview">
                    <div v-for="att in attachments" :key="att.id" class="preview-item">
                        <a :href="att.filePath" target="_blank" class="attachment-link">
                            {{ getFileName(att.filePath) }}
                        </a>
                        <button type="button" class="remove-file-btn" @click="deleteAttachment(att.id)"
                            :disabled="deletingAttachment === att.id">
                            <span v-if="deletingAttachment === att.id" class="spinner-sm"></span>
                            <span v-else>×</span>
                        </button>
                    </div>
                </div>

                <!-- Upload buttons -->
                <div class="attachment-buttons">
                    <label class="attachment-btn">
                        <input type="file" ref="fileInput" multiple accept="image/*,.pdf,.doc,.docx"
                            @change="handleFileSelect" hidden>
                        <span v-if="uploading" class="spinner-sm"></span>
                        <span v-else>📁 {{ $t('transactions.file') }}</span>
                    </label>
                    <button type="button" class="attachment-btn" @click="openCamera" :disabled="uploading">
                        <span v-if="uploading" class="spinner-sm"></span>
                        <span v-else>📷 {{ $t('transactions.photo') }}</span>
                    </button>
                </div>
            </div>

            <!-- Hidden camera input -->
            <input ref="cameraInput" type="file" accept="image/*" capture="environment" @change="handleCameraCapture"
                hidden>

            <!-- Notes -->
            <div class="input-group">
                <label for="notes">{{ $t('common.notes') }}</label>
                <textarea id="notes" v-model="form.notes" class="input-field" rows="2"
                    :placeholder="$t('common.additionalNotes')"></textarea>
            </div>

            <!-- Error message -->
            <div v-if="formError" class="form-error">{{ formError }}</div>

            <!-- Actions -->
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" @click="goBack">{{ $t('common.cancel') }}</button>
                <button type="submit" class="btn btn-primary"
                    :disabled="saving || (maintenanceItems.length > 0 && !isMaintenanceBalanced)">
                    <span v-if="saving" class="spinner"></span>
                    {{ $t('common.saveChanges') }}
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

interface MaintenanceType {
    id: number
    title: string
    vehicleId: number | null
}

interface MaintenanceItem {
    typeId: number | null
    amount: number | null
    description: string
}

interface Attachment {
    id: number
    filePath: string
}

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const transactionId = computed(() => Number(route.params.id))

const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const formError = ref('')

const accounts = ref<Account[]>([])
const categories = ref<Category[]>([])
const vehicles = ref<Vehicle[]>([])
const maintenanceTypes = ref<MaintenanceType[]>([])
const maintenanceItems = ref<MaintenanceItem[]>([])
const attachments = ref<Attachment[]>([])
const uploading = ref(false)
const deletingAttachment = ref<number | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const cameraInput = ref<HTMLInputElement | null>(null)

const form = ref({
    transactionDate: '',
    vehicleId: null as number | null,
    odometer: null as number | null,
    fromAccountId: null as number | null,
    categoryId: null as number | null,
    maintenanceAmount: null as number | null,
    description: '',
    notes: ''
})

// Filter maintenance types by selected vehicle (null = general, or matching vehicleId)
const filteredMaintenanceTypes = computed(() => {
    return maintenanceTypes.value.filter(mt =>
        mt.vehicleId === null || mt.vehicleId === form.value.vehicleId
    )
})

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

        // Load accounts, categories, vehicles, maintenance types
        const [accRes, catRes, vehRes, mtRes] = await Promise.all([
            $fetch<{ accounts: Account[] }>('/api/accounts'),
            $fetch<{ categories: Category[] }>('/api/categories'),
            $fetch<{ vehicles: Vehicle[] }>('/api/vehicles'),
            $fetch<{ maintenanceTypes: MaintenanceType[] }>('/api/maintenance_types')
        ])

        accounts.value = accRes.accounts
        categories.value = catRes.categories
        vehicles.value = vehRes.vehicles
        maintenanceTypes.value = mtRes.maintenanceTypes

        // Load transaction with maintenance logs
        const txRes = await $fetch<{ transaction: any }>(`/api/transactions/${transactionId.value}`)
        const tx = txRes.transaction

        if (!tx.isAutomotive || !tx.maintenanceLogs || tx.maintenanceLogs.length === 0) {
            loadError.value = t('transactions.notMaintenanceTransaction')
            return
        }

        // Populate form with maintenance log data - parse as local time (not UTC)
        const normalized = tx.transactionDate.replace('T', ' ').replace('Z', '')
        const parts = normalized.split(' ')
        const datePart = parts[0] || ''
        const timePart = parts[1] || '00:00'
        const dateParts = datePart.split('-')
        const timeParts = timePart.split(':')
        const year = dateParts[0] || '2026'
        const month = dateParts[1] || '01'
        const day = dateParts[2] || '01'
        const hours = timeParts[0] || '00'
        const minutes = timeParts[1] || '00'
        form.value.transactionDate = `${year}-${month}-${day}T${hours}:${minutes}`

        form.value.vehicleId = tx.maintenanceLogs[0].vehicleId
        form.value.odometer = tx.maintenanceLogs[0].odometer
        form.value.fromAccountId = tx.fromAccountId
        form.value.categoryId = tx.categoryId
        form.value.notes = tx.notes || ''

        // Calculate total amount from all maintenance items
        form.value.maintenanceAmount = tx.maintenanceLogs.reduce((sum: number, ml: any) => sum + (ml.amount || 0), 0)

        // Populate maintenance items
        if (tx.maintenanceLogs.length === 1 && !tx.maintenanceLogs[0].maintenanceTypeId) {
            // Single generic maintenance
            form.value.description = tx.maintenanceLogs[0].description || ''
            maintenanceItems.value = []
        } else {
            // Multiple maintenance types
            maintenanceItems.value = tx.maintenanceLogs.map((ml: any) => ({
                typeId: ml.maintenanceTypeId,
                amount: ml.amount,
                description: ml.description || ''
            }))
        }

        // Load attachments
        attachments.value = tx.attachments || []

    } catch (error: any) {
        loadError.value = error.data?.message || t('transactions.loadTransactionError')
    } finally {
        loading.value = false
    }
}

async function handleSubmit() {
    if (!form.value.vehicleId || !form.value.odometer || !form.value.fromAccountId || !form.value.transactionDate) {
        formError.value = t('common.required')
        return
    }

    if (!form.value.maintenanceAmount) {
        formError.value = t('automotive.enterMaintenanceAmount')
        return
    }

    if (maintenanceItems.value.length === 0 && !form.value.description) {
        formError.value = t('automotive.enterDescription')
        return
    }

    if (maintenanceItems.value.length > 0 && !isMaintenanceBalanced.value) {
        formError.value = t('automotive.typesAmountMustMatch')
        return
    }

    saving.value = true
    formError.value = ''

    try {
        const body: any = {
            type: 'maintenance',
            transactionDate: form.value.transactionDate,
            vehicleId: form.value.vehicleId,
            odometer: form.value.odometer,
            fromAccountId: form.value.fromAccountId,
            categoryId: form.value.categoryId,
            notes: form.value.notes,
            amount: form.value.maintenanceAmount
        }

        if (maintenanceItems.value.length > 0) {
            body.maintenanceItems = maintenanceItems.value.map(item => ({
                typeId: item.typeId,
                amount: item.amount,
                description: item.description || ''
            }))
        } else {
            body.description = form.value.description
        }

        await $fetch(`/api/transactions/${transactionId.value}/automotive`, {
            method: 'PUT',
            body
        })

        router.back()
    } catch (error: any) {
        formError.value = error.data?.message || t('common.saveError')
    } finally {
        saving.value = false
    }
}

// Attachment functions
function getFileName(path: string): string {
    return path.split('/').pop() || t('transactions.attachments')
}

function triggerFileSelect() {
    fileInput.value?.click()
}

async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement
    if (!input.files || input.files.length === 0) return

    uploading.value = true
    try {
        const formData = new FormData()
        for (const file of input.files) {
            formData.append('files', file)
        }

        const response = await $fetch<{ success: boolean; files: string[] }>(`/api/transactions/${transactionId.value}/attachments`, {
            method: 'POST',
            body: formData
        })

        if (response.success && response.files) {
            const txData = await $fetch<{ transaction: any }>(`/api/transactions/${transactionId.value}`)
            attachments.value = txData.transaction.attachments || []
        }
    } catch (error: any) {
        formError.value = error?.data?.message || t('transactions.fileUploadError')
    } finally {
        uploading.value = false
        if (input) input.value = ''
    }
}

async function deleteAttachment(attachmentId: number) {
    deletingAttachment.value = attachmentId
    try {
        await $fetch(`/api/transactions/${transactionId.value}/attachments/${attachmentId}`, {
            method: 'DELETE'
        })
        attachments.value = attachments.value.filter(a => a.id !== attachmentId)
    } catch (error: any) {
        formError.value = error?.data?.message || t('transactions.fileDeleteError')
    } finally {
        deletingAttachment.value = null
    }
}

function openCamera() {
    cameraInput.value?.click()
}

async function handleCameraCapture(event: Event) {
    const input = event.target as HTMLInputElement
    if (!input.files || input.files.length === 0) return

    uploading.value = true
    try {
        const formData = new FormData()
        for (const file of input.files) {
            formData.append('files', file)
        }

        const response = await $fetch<{ success: boolean; files: string[] }>(`/api/transactions/${transactionId.value}/attachments`, {
            method: 'POST',
            body: formData
        })

        if (response.success && response.files) {
            const txData = await $fetch<{ transaction: any }>(`/api/transactions/${transactionId.value}`)
            attachments.value = txData.transaction.attachments || []
        }
    } catch (error: any) {
        formError.value = error?.data?.message || t('transactions.photoUploadError')
    } finally {
        uploading.value = false
        if (input) input.value = ''
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
    color: var(--color-text-on-accent);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.85rem;
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
    background: var(--color-error-bg);
    color: var(--color-error);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 1.2rem;
    font-weight: bold;
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
    background: var(--color-error-bg);
    color: var(--color-error);
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
    color: var(--color-text-on-accent);
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

/* Attachments Section */
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
    flex: 1;
    padding: var(--space-md);
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: center;
    color: var(--color-text-primary);
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
}

.attachment-btn:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
}

.attachment-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

.attachment-preview {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
}

.preview-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    background: var(--color-bg-glass);
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
}

.preview-item .attachment-link {
    color: var(--color-accent);
    text-decoration: none;
}

.preview-item .attachment-link:hover {
    text-decoration: underline;
}

.remove-file-btn {
    background: none;
    border: none;
    color: var(--color-error);
    cursor: pointer;
    font-size: 1.2rem;
    line-height: 1;
}

.remove-file-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

.spinner-sm {
    width: 14px;
    height: 14px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    display: inline-block;
}
</style>
