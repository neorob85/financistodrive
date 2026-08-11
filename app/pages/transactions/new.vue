<template>
    <div class="transaction-form-page">
        <header class="form-header">
            <button class="back-btn" @click="goBack">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
            </button>
            <h1>{{ isAutomotiveMode ? '🚗 ' + $t('transactions.automotiveExpense') : $t('transactions.new') }}</h1>
            <div class="header-spacer"></div>
        </header>

        <form @submit.prevent="handleSubmit" class="transaction-form">
            <!-- Transaction Type Toggle (Expense / Income / Transfer) -->
            <div class="type-toggle-section">
                <div class="type-toggle">
                    <button type="button" class="type-btn" :class="{ active: transactionType === 'expense' }"
                        @click="transactionType = 'expense'">
                        <span class="type-icon">−</span>
                        <span class="type-text">{{ $t('transactions.expense') }}</span>
                    </button>
                    <button type="button" class="type-btn" :class="{ active: transactionType === 'income' }"
                        @click="transactionType = 'income'">
                        <span class="type-icon">+</span>
                        <span class="type-text">{{ $t('transactions.income') }}</span>
                    </button>
                    <button type="button" class="type-btn" :class="{ active: transactionType === 'transfer' }"
                        @click="transactionType = 'transfer'">
                        <span class="type-icon">⇄</span>
                        <span class="type-text">{{ $t('transactions.transfer') }}</span>
                    </button>
                </div>
            </div>

            <!-- Amount -->
            <div class="amount-section">
                <span class="amount-sign" :class="transactionType">
                    {{ transactionType === 'expense' ? '−' : transactionType === 'income' ? '+' : '⇄' }}
                </span>
                <input v-model.number="form.amount" type="number" inputmode="decimal" step="0.01" min="0"
                    placeholder="0.00" class="amount-input" required>
                <span class="currency-symbol">€</span>
            </div>

            <!-- Date -->
            <div class="input-group">
                <label for="date">{{ $t('transactions.date') }} *</label>
                <input id="date" v-model="form.transactionDate" type="datetime-local" class="input-field" required>
            </div>

            <!-- Title / Description -->
            <div class="input-group">
                <label for="title">{{ $t('transactions.description') }} *</label>
                <input id="title" v-model="form.title" type="text" class="input-field" required>
            </div>

            <!-- From Account -->
            <div class="input-group">
                <label for="account">{{ $t('transactions.account') }} *</label>
                <select id="account" v-model="form.fromAccountId" class="input-field" required>
                    <option :value="null" disabled>{{ $t('transactions.selectAccount') }}</option>
                    <option v-for="acc in accounts" :key="acc.id" :value="acc.id">{{ acc.title }}</option>
                </select>
            </div>

            <!-- Split Checkbox -->
            <div class="checkbox-row">
                <label class="checkbox-label">
                    <input type="checkbox" v-model="isSplit" @change="handleSplitToggle">
                    <span>{{ $t('transactions.splitTransaction') }}</span>
                </label>
            </div>

            <!-- Category (if not transfer and not split) -->
            <div v-if="transactionType !== 'transfer' && !isSplit" class="input-group">
                <label for="category">{{ $t('transactions.category') }}</label>
                <select id="category" v-model="form.categoryId" class="input-field">
                    <option :value="null">-- {{ $t('transactions.noCategory') }} --</option>
                    <option v-for="cat in flatCategories" :key="cat.id" :value="cat.id">
                        {{ cat.indent }}{{ cat.title }}
                    </option>
                </select>
            </div>

            <!-- Category Attributes -->
            <template v-if="transactionType !== 'transfer' && !isSplit && activeCategoryAttributes.length > 0">
                <div class="attributes-header">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                        <line x1="7" y1="7" x2="7.01" y2="7" />
                    </svg>
                    {{ $t('transactions.categoryAttributes') }}
                </div>
                <div v-for="attr in activeCategoryAttributes" :key="attr.id" class="input-group">
                    <label>
                        {{ attr.title }}<span v-if="attr.unit" class="attr-unit-label"> ({{ attr.unit }})</span><span v-if="attr.isRequired" class="required-star"> *</span>
                    </label>
                    <input v-if="attr.type === 'TEXT'" v-model="attributeValues[attr.id]" type="text" class="input-field" :required="attr.isRequired" />
                    <input v-else-if="attr.type === 'NUMBER'" v-model="attributeValues[attr.id]" type="number" inputmode="decimal" step="any" class="input-field" :required="attr.isRequired" />
                    <label v-else-if="attr.type === 'BOOLEAN'" class="checkbox-label">
                        <input type="checkbox" :checked="attributeValues[attr.id] === '1'" @change="(e: Event) => { attributeValues[attr.id] = (e.target as HTMLInputElement).checked ? '1' : '0' }" />
                        <span>{{ $t('categoryAttributes.types.BOOLEAN') }}</span>
                    </label>
                    <input v-else-if="attr.type === 'DATE'" v-model="attributeValues[attr.id]" type="date" class="input-field" :required="attr.isRequired" />
                    <select v-else-if="attr.type === 'LIST'" v-model="attributeValues[attr.id]" class="input-field" :required="attr.isRequired">
                        <option value="">{{ $t('common.select') }}</option>
                        <option v-for="val in parseListValues(attr.listValues)" :key="val" :value="val">{{ val }}</option>
                    </select>
                </div>
            </template>

            <!-- To Account (for transfers) -->
            <div v-if="transactionType === 'transfer'" class="input-group">
                <label for="toAccount">{{ $t('transactions.destinationAccount') }} *</label>
                <select id="toAccount" v-model="form.toAccountId" class="input-field" required>
                    <option :value="null" disabled>{{ $t('transactions.selectAccount') }}</option>
                    <option v-for="acc in accounts.filter(a => a.id !== form.fromAccountId)" :key="acc.id"
                        :value="acc.id">
                        {{ acc.title }}
                    </option>
                </select>
            </div>

            <!-- Split items -->
            <div v-if="isSplit" class="split-section">
                <div class="split-header">
                    <span>{{ $t('transactions.subdivision') }}</span>
                    <span :class="{ 'amount-ok': splitBalanced, 'amount-error': !splitBalanced }">
                        {{ formatCurrency(totalSplitAmount) }} / {{ formatCurrency(form.amount) }}
                        <template v-if="splitBalanced">✓</template>
                        <template v-else>({{ splitRemaining >= 0 ? '+' : '-' }}{{
                            formatCurrency(Math.abs(splitRemaining)) }})</template>
                    </span>
                </div>

                <div v-for="(split, index) in splits" :key="index" class="split-item">
                    <div class="split-row">
                        <div class="split-type-toggle">
                            <button type="button" class="split-type-btn" :class="{ active: split.type === 'category' }"
                                @click="split.type = 'category'">Cat</button>
                            <button type="button" class="split-type-btn" :class="{ active: split.type === 'transfer' }"
                                @click="split.type = 'transfer'">Trasf</button>
                        </div>

                        <input v-model.number="split.amount" type="number" inputmode="decimal" step="0.01" min="0"
                            placeholder="€" class="split-amount">

                        <select v-if="split.type === 'category'" v-model="split.categoryId" class="split-select">
                            <option :value="null">{{ $t('transactions.category') }}</option>
                            <option v-for="cat in flatCategories" :key="cat.id" :value="cat.id">
                                {{ cat.indent }}{{ cat.title }}
                            </option>
                        </select>
                        <select v-else v-model="split.toAccountId" class="split-select">
                            <option :value="null">{{ $t('transactions.account') }}</option>
                            <option v-for="acc in accounts.filter(a => a.id !== form.fromAccountId)" :key="acc.id"
                                :value="acc.id">
                                {{ acc.title }}
                            </option>
                        </select>

                        <button type="button" class="remove-split-btn" @click="removeSplit(index)">×</button>
                    </div>
                    <input v-model="split.notes" type="text" class="split-notes" :placeholder="$t('common.notes')">
                </div>

                <button type="button" class="add-split-btn" @click="addSplit">{{ $t('transactions.addSplit') }}</button>
            </div>

            <!-- Project -->
            <div class="input-group">
                <label for="project">{{ $t('transactions.project') }}</label>
                <select id="project" v-model="form.projectId" class="input-field">
                    <option :value="null">{{ $t('transactions.noProject') }}</option>
                    <option v-for="p in projects.filter(p => p.isActive)" :key="p.id" :value="p.id">{{ p.title }}
                    </option>
                </select>
            </div>

            <!-- Payee -->
            <div class="input-group">
                <label for="payee">{{ $t('transactions.payee') }}</label>
                <select id="payee" v-model="form.payeeId" class="input-field">
                    <option :value="null">{{ $t('transactions.noPayee') }}</option>
                    <option v-for="p in payees.filter(p => p.isActive)" :key="p.id" :value="p.id">{{ p.title }}</option>
                </select>
            </div>

            <!-- Notes -->
            <div class="input-group">
                <label for="notes">{{ $t('common.notes') }}</label>
                <textarea id="notes" v-model="form.notes" class="input-field" rows="2"></textarea>
            </div>

            <!-- Deductible Amount (only for expenses/income, not transfers) -->
            <div v-if="transactionType !== 'transfer'" class="input-group">
                <label for="deductibleAmount">{{ $t('transactions.deductibleAmount') }}</label>
                <input id="deductibleAmount" v-model.number="form.deductibleAmount" type="number" inputmode="decimal"
                    step="0.01" min="0" placeholder="0.00" class="input-field">
            </div>

            <!-- Billed in the next cycle (credit cards only) -->
            <div v-if="isCreditCardSource" class="input-group">
                <label class="checkbox-label">
                    <input type="checkbox" v-model="form.isDeferred" @change="runDeferralCheck">
                    {{ $t('transactions.deferredToNextCycle') }}
                </label>
                <p class="field-hint">{{ $t('transactions.deferredToNextCycleHint') }}</p>
                <p v-if="form.isDeferred && deferral.alreadyPaid.value" class="field-warning">
                    ⚠️ {{ $t('transactions.deferredCycleAlreadyPaid') }}
                </p>
            </div>

            <!-- Attachments -->
            <div class="attachments-section">
                <label>{{ $t('transactions.attachments') }}</label>
                <div class="attachment-buttons">
                    <label class="attachment-btn">
                        <input type="file" multiple accept="image/*,.pdf,.doc,.docx" @change="handleFileSelect" hidden>
                        📁 {{ $t('transactions.file') }}
                    </label>
                    <button type="button" class="attachment-btn" @click="openCamera">
                        📷 {{ $t('transactions.photo') }}
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
                <button type="button" class="btn btn-secondary" @click="goBack">{{ $t('common.cancel') }}</button>
                <button type="submit" class="btn btn-primary" :disabled="saving || (isSplit && !splitBalanced)">
                    <span v-if="saving" class="spinner"></span>
                    {{ $t('common.save') }}
                </button>
            </div>
        </form>
    </div>
</template>

<script setup lang="ts">
definePageMeta({
    layout: 'default'
})

const { t } = useI18n()

interface Account {
    id: number
    title: string
    isCreditCard: boolean
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

interface Payee {
    id: number
    title: string
    isActive: boolean
}

interface Project {
    id: number
    title: string
    isActive: boolean
}

interface SplitItem {
    amount: number | null
    type: 'category' | 'transfer'
    categoryId: number | null
    toAccountId: number | null
    notes: string
}

interface CategoryAttribute {
    id: number
    categoryId: number
    title: string
    type: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'LIST'
    listValues: string | null
    defaultValue: string | null
    unit: string | null
    isRequired: boolean
}

const router = useRouter()
const route = useRoute()

// Check if automotive mode from query param
const isAutomotiveMode = computed(() => route.query.type === 'automotive')

const accounts = ref<Account[]>([])
const categories = ref<Category[]>([])
const payees = ref<Payee[]>([])
const projects = ref<Project[]>([])
const categoryAttributes = ref<CategoryAttribute[]>([])
const attributeValues = ref<Record<number, string>>({})

const transactionType = ref<'expense' | 'income' | 'transfer'>('expense')
const isSplit = ref(false)
const splits = ref<SplitItem[]>([])
const attachmentFiles = ref<File[]>([])
const formError = ref('')
const saving = ref(false)

const cameraInput = ref<HTMLInputElement | null>(null)

const form = ref({
    title: '',
    amount: null as number | null,
    transactionDate: (() => { const n = new Date(); return new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 16) })(),
    fromAccountId: null as number | null,
    toAccountId: null as number | null,
    categoryId: null as number | null,
    payeeId: null as number | null,
    projectId: null as number | null,
    notes: '',
    deductibleAmount: null as number | null,
    isDeferred: false
})

const deferral = useDeferralCheck()

// The flag only exists on credit cards, so the source account decides whether it shows
const isCreditCardSource = computed(() =>
    accounts.value.some(a => a.id === form.value.fromAccountId && a.isCreditCard)
)

function runDeferralCheck() {
    deferral.check(form.value.fromAccountId, form.value.transactionDate, form.value.isDeferred)
}

// Switching to a non-card account or changing the date invalidates the flag/warning
watch(() => [form.value.fromAccountId, form.value.transactionDate], () => {
    if (!isCreditCardSource.value) {
        form.value.isDeferred = false
        deferral.reset()
        return
    }
    runDeferralCheck()
})

const flatCategories = computed(() => {
    const result: FlatCategory[] = []
    const cats = categories.value

    // Build tree structure from flat list using parentId
    const categoryMap = new Map<number, Category & { children: (Category & { children: any[] })[] }>()
    const rootCategories: (Category & { children: any[] })[] = []

    // First pass: create map of all categories
    for (const cat of cats) {
        categoryMap.set(cat.id, { ...cat, children: [] })
    }

    // Second pass: build parent-child relationships
    for (const cat of cats) {
        const catWithChildren = categoryMap.get(cat.id)!
        if (cat.parentId && categoryMap.has(cat.parentId)) {
            categoryMap.get(cat.parentId)!.children.push(catWithChildren)
        } else {
            rootCategories.push(catWithChildren)
        }
    }

    // Check if a category or any of its descendants matches the mode
    function hasMatchingDescendant(cat: Category & { children?: any[] }): boolean {
        // In automotive mode, show only automotive categories
        // In normal mode, show only non-automotive categories
        const matches = isAutomotiveMode.value ? cat.isAutomotive : !cat.isAutomotive
        if (matches) return true
        if (cat.children && cat.children.length > 0) {
            return cat.children.some(child => hasMatchingDescendant(child))
        }
        return false
    }

    // Flatten with visual markers
    function flatten(items: (Category & { children?: any[] })[], level = 0) {
        for (const cat of items) {
            // Show if category or descendants match the current mode
            const shouldShow = hasMatchingDescendant(cat)
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

const totalSplitAmount = computed(() => {
    return splits.value.reduce((sum, s) => sum + (s.amount || 0), 0)
})

const splitBalanced = computed(() => {
    if (!isSplit.value) return true
    return Math.abs(totalSplitAmount.value - (form.value.amount || 0)) < 0.01
})

const splitRemaining = computed(() => {
    return totalSplitAmount.value - (form.value.amount || 0)
})

const activeCategoryAttributes = computed(() => {
    if (!form.value.categoryId || form.value.categoryId <= 0) return []
    return categoryAttributes.value.filter(a => a.categoryId === form.value.categoryId)
})

function parseListValues(raw: string | null): string[] {
    if (!raw) return []
    try { return JSON.parse(raw) } catch { return [] }
}

watch(() => form.value.categoryId, (newCatId) => {
    attributeValues.value = {}
    if (newCatId && newCatId > 0) {
        for (const attr of categoryAttributes.value.filter(a => a.categoryId === newCatId)) {
            attributeValues.value[attr.id] = attr.defaultValue ?? (attr.type === 'BOOLEAN' ? '0' : '')
        }
    }
}, { flush: 'sync' })

async function saveAttributeValues(transactionId: number) {
    const attrs = activeCategoryAttributes.value
    if (attrs.length === 0) return
    const values = attrs
        .map(attr => ({ categoryAttributeId: attr.id, value: attributeValues.value[attr.id] ?? '' }))
        .filter(v => v.value !== '')
    if (values.length === 0) return
    await $fetch('/api/transaction_attribute_values/upsert', {
        method: 'POST',
        body: { transactionId, values }
    })
}

function formatCurrency(amount: number | null) {
    return `€${(amount || 0).toFixed(2)}`
}

function handleSplitToggle() {
    if (isSplit.value && splits.value.length === 0) {
        addSplit()
    }
}

function addSplit() {
    splits.value.push({
        amount: null,
        type: 'category',
        categoryId: null,
        toAccountId: null,
        notes: ''
    })
}

function removeSplit(index: number) {
    splits.value.splice(index, 1)
}

function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement
    if (input.files) {
        attachmentFiles.value.push(...Array.from(input.files))
    }
    input.value = ''
}

function removeFile(index: number) {
    attachmentFiles.value.splice(index, 1)
}

function openCamera() {
    cameraInput.value?.click()
}

function goBack() {
    router.push('/transactions')
}

async function handleSubmit() {
    if (!form.value.title || form.value.amount == null || !form.value.fromAccountId || !form.value.transactionDate) {
        formError.value = t('common.required')
        return
    }

    if (transactionType.value === 'transfer' && !form.value.toAccountId) {
        formError.value = t('transactions.selectDestination')
        return
    }

    if (isSplit.value && !splitBalanced.value) {
        formError.value = t('transactions.splitMustEqual')
        return
    }

    saving.value = true
    formError.value = ''

    try {
        const isExpense = transactionType.value === 'expense'
        const isTransfer = transactionType.value === 'transfer'
        // amountFrom is negative for expenses AND transfers (money leaves the source account)
        const amountFrom = (isExpense || isTransfer) ? -Math.abs(form.value.amount) : Math.abs(form.value.amount)

        const body: any = {
            title: form.value.title,
            amountFrom,
            amountTo: isTransfer ? Math.abs(form.value.amount) : null,
            fromAccountId: form.value.fromAccountId,
            toAccountId: isTransfer ? form.value.toAccountId : null,
            // category_id: -1 = split, -2 = no category, -3 = transfer
            categoryId: isSplit.value ? -1 : (isTransfer ? -3 : (form.value.categoryId || -2)),
            payeeId: form.value.payeeId,
            projectId: form.value.projectId,
            transactionDate: form.value.transactionDate,
            notes: form.value.notes,
            isTransfer,
            currencyId: 1,
            deductibleAmount: form.value.deductibleAmount || null,
            isDeferred: isCreditCardSource.value && form.value.isDeferred
        }

        if (isSplit.value && splits.value.length > 0) {
            body.splits = splits.value.map(s => ({
                title: form.value.title,
                amountFrom: isExpense ? -Math.abs(s.amount || 0) : Math.abs(s.amount || 0),
                amountTo: s.type === 'transfer' ? Math.abs(s.amount || 0) : null,
                categoryId: s.type === 'transfer' ? -3 : (s.categoryId || -2),
                toAccountId: s.type === 'transfer' ? s.toAccountId : null,
                isTransfer: s.type === 'transfer',
                notes: s.notes || null
            }))
        }

        const result = await $fetch<{ id: number }>('/api/transactions', {
            method: 'POST',
            body
        })

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

        await saveAttributeValues(result.id)
        router.push('/transactions')
    } catch (error: any) {
        formError.value = error?.data?.message || t('common.saveError')
    } finally {
        saving.value = false
    }
}

async function loadDropdownData() {
    try {
        const [accountsData, categoriesData, payeesData, projectsData, attrData] = await Promise.all([
            $fetch<{ accounts: Account[] }>('/api/accounts'),
            $fetch<{ categories: Category[] }>('/api/categories'),
            $fetch<{ payees: Payee[] }>('/api/payees'),
            $fetch<{ projects: Project[] }>('/api/projects'),
            $fetch<{ attributes: CategoryAttribute[] }>('/api/category_attributes')
        ])

        accounts.value = accountsData.accounts || []
        categories.value = categoriesData.categories || []
        payees.value = payeesData.payees || []
        projects.value = projectsData.projects || []
        categoryAttributes.value = attrData.attributes || []
    } catch (error) {
        console.error('Failed to load dropdown data:', error)
    }
}

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
    background: var(--color-bg-glass);
    color: var(--color-text-primary);
}

.type-btn:first-child.active {
    background: var(--color-error-bg);
    color: var(--color-error);
}

.type-btn:nth-child(2).active {
    background: var(--color-success-bg);
    color: var(--color-success);
}

.type-btn:last-child.active {
    background: var(--color-accent-bg);
    color: var(--color-accent);
}

.type-icon {
    font-size: 1.3rem;
    font-weight: 700;
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

.amount-sign.income {
    color: var(--color-success);
}

.amount-sign.transfer {
    color: var(--color-accent);
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

/* Deferred-billing field */
.field-hint {
    margin: var(--space-xs) 0 0;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    line-height: 1.4;
}

.field-warning {
    margin: var(--space-xs) 0 0;
    font-size: 0.8rem;
    line-height: 1.4;
    color: var(--color-danger, #d94b4b);
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

/* Split Section */
.split-section {
    background: var(--color-bg-elevated);
    border-radius: var(--radius-md);
    padding: var(--space-md);
}

.split-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
    font-weight: 500;
    margin-bottom: var(--space-md);
}

.amount-ok {
    color: var(--color-success);
}

.amount-error {
    color: var(--color-error);
}

.split-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    margin-bottom: var(--space-sm);
    padding: var(--space-sm);
    background: var(--color-bg-glass);
    border-radius: var(--radius-sm);
}

.split-row {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
}

.split-notes {
    width: 100%;
    padding: var(--space-xs) var(--space-sm);
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    font-size: 0.8rem;
}

.split-type-toggle {
    display: flex;
    background: var(--color-bg-elevated);
    border-radius: var(--radius-sm);
    overflow: hidden;
    flex-shrink: 0;
}

.split-type-btn {
    padding: var(--space-xs) var(--space-sm);
    background: transparent;
    border: none;
    font-size: 0.75rem;
    cursor: pointer;
    color: var(--color-text-muted);
}

.split-type-btn.active {
    background: var(--color-accent);
    color: var(--color-text-on-accent);
}

.split-amount {
    width: 70px;
    padding: var(--space-xs) var(--space-sm);
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    font-size: 0.9rem;
    text-align: right;
}

.split-select {
    flex: 1;
    min-width: 0;
    padding: var(--space-xs) var(--space-sm);
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    font-size: 0.85rem;
    line-height: 1.4;
    -webkit-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right var(--space-sm) center;
    padding-right: calc(var(--space-sm) + 16px);
}

.remove-split-btn {
    width: 28px;
    height: 28px;
    background: var(--color-error-bg);
    color: var(--color-error);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 1rem;
    flex-shrink: 0;
}

.add-split-btn {
    width: 100%;
    padding: var(--space-sm);
    background: transparent;
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 0.85rem;
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
    flex: 1;
    padding: var(--space-md);
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: center;
    color: var(--color-text-primary);
    font-size: 0.9rem;
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

.remove-file-btn {
    background: none;
    border: none;
    color: var(--color-error);
    cursor: pointer;
    font-size: 1.2rem;
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

.attributes-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    padding-top: var(--space-xs);
    border-top: 1px solid var(--color-border);
}

.attr-unit-label {
    color: var(--color-text-muted);
    font-size: 0.8em;
    font-weight: 400;
}

.required-star {
    color: var(--color-error);
}
</style>
