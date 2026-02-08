<template>
    <div class="transaction-form-page">
        <header class="form-header">
            <button class="back-btn" @click="goBack">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
            </button>
            <h1>Modifica Transazione</h1>
            <div class="header-spacer"></div>
        </header>

        <div v-if="loading" class="loading-state">
            <div class="spinner-lg"></div>
            <p>Caricamento...</p>
        </div>

        <div v-else-if="loadError" class="error-state">
            <p>{{ loadError }}</p>
            <button class="btn btn-secondary" @click="goBack">Torna indietro</button>
        </div>

        <form v-else @submit.prevent="handleSubmit" class="transaction-form">
            <!-- Transaction Type Toggle (Expense / Income / Transfer) -->
            <div class="type-toggle-section">
                <div class="type-toggle">
                    <button type="button" class="type-btn" :class="{ active: transactionType === 'expense' }"
                        @click="transactionType = 'expense'">
                        <span class="type-icon">−</span>
                        <span class="type-text">Uscita</span>
                    </button>
                    <button type="button" class="type-btn" :class="{ active: transactionType === 'income' }"
                        @click="transactionType = 'income'">
                        <span class="type-icon">+</span>
                        <span class="type-text">Entrata</span>
                    </button>
                    <button type="button" class="type-btn" :class="{ active: transactionType === 'transfer' }"
                        @click="transactionType = 'transfer'">
                        <span class="type-icon">⇄</span>
                        <span class="type-text">Trasferimento</span>
                    </button>
                </div>
            </div>

            <!-- Amount -->
            <div class="amount-section">
                <span class="amount-sign" :class="transactionType">
                    {{ transactionType === 'expense' ? '−' : transactionType === 'income' ? '+' : '⇄' }}
                </span>
                <input v-model.number="form.amount" type="number" step="0.01" min="0" placeholder="0.00"
                    class="amount-input" required>
                <span class="currency-symbol">€</span>
            </div>

            <!-- Date -->
            <div class="input-group">
                <label for="date">Data *</label>
                <input id="date" v-model="form.transactionDate" type="datetime-local" class="input-field" required>
            </div>

            <!-- Title / Description -->
            <div class="input-group">
                <label for="title">Descrizione *</label>
                <input id="title" v-model="form.title" type="text" class="input-field" required>
            </div>

            <!-- From Account -->
            <div class="input-group">
                <label for="account">Conto *</label>
                <select id="account" v-model="form.fromAccountId" class="input-field" required>
                    <option :value="null" disabled>-- Seleziona conto --</option>
                    <option v-for="acc in accounts" :key="acc.id" :value="acc.id">{{ acc.title }}</option>
                </select>
            </div>

            <!-- Split Checkbox -->
            <div class="checkbox-row">
                <label class="checkbox-label">
                    <input type="checkbox" v-model="isSplit" @change="handleSplitToggle">
                    <span>Transazione Split</span>
                </label>
            </div>

            <!-- Category (if not transfer and not split) -->
            <div v-if="transactionType !== 'transfer' && !isSplit" class="input-group">
                <label for="category">Categoria</label>
                <select id="category" v-model="form.categoryId" class="input-field">
                    <option :value="null">-- Nessuna categoria --</option>
                    <option v-for="cat in flatCategories" :key="cat.id" :value="cat.id">
                        {{ cat.indent }}{{ cat.title }}
                    </option>
                </select>
            </div>

            <!-- To Account (for transfers) -->
            <div v-if="transactionType === 'transfer'" class="input-group">
                <label for="toAccount">Conto destinazione *</label>
                <select id="toAccount" v-model="form.toAccountId" class="input-field" required>
                    <option :value="null" disabled>-- Seleziona conto --</option>
                    <option v-for="acc in accounts.filter(a => a.id !== form.fromAccountId)" :key="acc.id"
                        :value="acc.id">
                        {{ acc.title }}
                    </option>
                </select>
            </div>

            <!-- Split items -->
            <div v-if="isSplit" class="split-section">
                <div class="split-header">
                    <span>Suddivisione</span>
                    <span :class="{ 'amount-ok': splitBalanced, 'amount-error': !splitBalanced }">
                        {{ formatCurrency(totalSplitAmount) }} / {{ formatCurrency(form.amount) }}
                        {{ splitBalanced ? '✓' : '' }}
                    </span>
                </div>

                <div v-for="(split, index) in splits" :key="index" class="split-item">
                    <div class="split-type-toggle">
                        <button type="button" class="split-type-btn" :class="{ active: split.type === 'category' }"
                            @click="split.type = 'category'">Cat</button>
                        <button type="button" class="split-type-btn" :class="{ active: split.type === 'transfer' }"
                            @click="split.type = 'transfer'">Trasf</button>
                    </div>

                    <input v-model.number="split.amount" type="number" step="0.01" min="0" placeholder="€"
                        class="split-amount">

                    <select v-if="split.type === 'category'" v-model="split.categoryId" class="split-select">
                        <option :value="null">Categoria</option>
                        <option v-for="cat in flatCategories" :key="cat.id" :value="cat.id">
                            {{ cat.indent }}{{ cat.title }}
                        </option>
                    </select>
                    <select v-else v-model="split.toAccountId" class="split-select">
                        <option :value="null">Conto</option>
                        <option v-for="acc in accounts.filter(a => a.id !== form.fromAccountId)" :key="acc.id"
                            :value="acc.id">
                            {{ acc.title }}
                        </option>
                    </select>

                    <button type="button" class="remove-split-btn" @click="removeSplit(index)">×</button>
                </div>

                <button type="button" class="add-split-btn" @click="addSplit">+ Aggiungi</button>
            </div>

            <!-- Project -->
            <div class="input-group">
                <label for="project">Progetto</label>
                <select id="project" v-model="form.projectId" class="input-field">
                    <option :value="null">-- Nessun progetto --</option>
                    <option v-for="p in projects.filter(p => p.isActive)" :key="p.id" :value="p.id">{{ p.title }}</option>
                </select>
            </div>

            <!-- Payee -->
            <div class="input-group">
                <label for="payee">Beneficiario</label>
                <select id="payee" v-model="form.payeeId" class="input-field">
                    <option :value="null">-- Nessun beneficiario --</option>
                    <option v-for="p in payees.filter(p => p.isActive)" :key="p.id" :value="p.id">{{ p.title }}</option>
                </select>
            </div>

            <!-- Notes -->
            <div class="input-group">
                <label for="notes">Note</label>
                <textarea id="notes" v-model="form.notes" class="input-field" rows="2"></textarea>
            </div>

            <!-- Error message -->
            <div v-if="formError" class="form-error">{{ formError }}</div>

            <!-- Actions -->
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" @click="goBack">Annulla</button>
                <button type="submit" class="btn btn-primary" :disabled="saving || (isSplit && !splitBalanced)">
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
    id?: number
    amount: number
    type: 'category' | 'transfer'
    categoryId: number | null
    toAccountId: number | null
}

interface TransactionDetail {
    id: number
    title: string
    amountFrom: number
    amountTo: number | null
    transactionDate: string
    fromAccountId: number
    toAccountId: number | null
    categoryId: number | null
    projectId: number | null
    payeeId: number | null
    notes: string | null
    isTransfer: boolean
    isAutomotive: boolean
    children: {
        id: number
        amountFrom: number
        amountTo: number | null
        categoryId: number | null
        toAccountId: number | null
        isTransfer: boolean
    }[]
}

const router = useRouter()
const route = useRoute()
const transactionId = computed(() => route.params.id as string)

const accounts = ref<Account[]>([])
const categories = ref<Category[]>([])
const payees = ref<Payee[]>([])
const projects = ref<Project[]>([])

const loading = ref(true)
const loadError = ref('')
const transactionType = ref<'expense' | 'income' | 'transfer'>('expense')
const isSplit = ref(false)
const splits = ref<SplitItem[]>([])
const formError = ref('')
const saving = ref(false)

// Store original values for balance calculation
const originalData = ref<TransactionDetail | null>(null)

const form = ref({
    title: '',
    amount: null as number | null,
    transactionDate: (() => { const n = new Date(); return new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 16) })(),
    fromAccountId: null as number | null,
    toAccountId: null as number | null,
    categoryId: null as number | null,
    payeeId: null as number | null,
    projectId: null as number | null,
    notes: ''
})

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

    // Check if a category or any of its descendants is non-automotive
    function hasNonAutomotiveDescendant(cat: Category & { children?: any[] }): boolean {
        if (!cat.isAutomotive) return true
        if (cat.children && cat.children.length > 0) {
            return cat.children.some(child => hasNonAutomotiveDescendant(child))
        }
        return false
    }

    function flatten(items: (Category & { children?: any[] })[], level = 0) {
        for (const cat of items) {
            // Show only non-automotive categories or parents with non-automotive children
            const shouldShow = hasNonAutomotiveDescendant(cat)
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
        amount: 0,
        type: 'category',
        categoryId: null,
        toAccountId: null
    })
}

function removeSplit(index: number) {
    splits.value.splice(index, 1)
}

function goBack() {
    router.back()
}

async function handleSubmit() {
    if (!form.value.title || !form.value.amount || !form.value.fromAccountId || !form.value.transactionDate) {
        formError.value = 'Compila tutti i campi obbligatori'
        return
    }

    if (transactionType.value === 'transfer' && !form.value.toAccountId) {
        formError.value = 'Seleziona il conto destinazione'
        return
    }

    if (isSplit.value && !splitBalanced.value) {
        formError.value = 'La somma degli split deve essere uguale all\'importo totale'
        return
    }

    saving.value = true
    formError.value = ''

    try {
        const isExpense = transactionType.value === 'expense'
        const isTransfer = transactionType.value === 'transfer'
        const amountFrom = (isExpense || isTransfer) ? -Math.abs(form.value.amount) : Math.abs(form.value.amount)

        const body: any = {
            title: form.value.title,
            amountFrom,
            amountTo: isTransfer ? Math.abs(form.value.amount) : null,
            fromAccountId: form.value.fromAccountId,
            toAccountId: isTransfer ? form.value.toAccountId : null,
            categoryId: isSplit.value ? -1 : (isTransfer ? -3 : (form.value.categoryId || -2)),
            payeeId: form.value.payeeId,
            projectId: form.value.projectId,
            transactionDate: form.value.transactionDate,
            notes: form.value.notes,
            isTransfer,
            currencyId: 1
        }

        if (isSplit.value && splits.value.length > 0) {
            body.splits = splits.value.map(s => ({
                id: s.id,
                title: form.value.title,
                amountFrom: isExpense ? -Math.abs(s.amount) : Math.abs(s.amount),
                amountTo: s.type === 'transfer' ? Math.abs(s.amount) : null,
                categoryId: s.type === 'transfer' ? -3 : (s.categoryId || -2),
                toAccountId: s.type === 'transfer' ? s.toAccountId : null,
                isTransfer: s.type === 'transfer'
            }))
        }

        await $fetch(`/api/transactions/${transactionId.value}`, {
            method: 'PUT',
            body
        })

        router.back()
    } catch (error: any) {
        formError.value = error?.data?.message || 'Errore nel salvataggio'
    } finally {
        saving.value = false
    }
}

async function loadData() {
    loading.value = true
    loadError.value = ''

    try {
        // Load dropdown data and transaction in parallel
        const [accountsData, categoriesData, payeesData, projectsData, txData] = await Promise.all([
            $fetch<{ accounts: Account[] }>('/api/accounts'),
            $fetch<{ categories: Category[] }>('/api/categories'),
            $fetch<{ payees: Payee[] }>('/api/payees'),
            $fetch<{ projects: Project[] }>('/api/projects'),
            $fetch<{ transaction: TransactionDetail }>(`/api/transactions/${transactionId.value}`)
        ])

        accounts.value = accountsData.accounts || []
        categories.value = categoriesData.categories || []
        payees.value = payeesData.payees || []
        projects.value = projectsData.projects || []

        const tx = txData.transaction
        originalData.value = tx

        // Populate form
        form.value.title = tx.title
        form.value.amount = Math.abs(tx.amountFrom)
        const dateObj = new Date(tx.transactionDate)
        const localDate = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000)
        form.value.transactionDate = localDate.toISOString().slice(0, 16)
        form.value.fromAccountId = tx.fromAccountId
        form.value.toAccountId = tx.toAccountId
        form.value.categoryId = tx.categoryId && tx.categoryId > 0 ? tx.categoryId : null
        form.value.payeeId = tx.payeeId
        form.value.projectId = tx.projectId
        form.value.notes = tx.notes || ''

        // Determine transaction type
        if (tx.isTransfer) {
            transactionType.value = 'transfer'
        } else if (tx.amountFrom < 0) {
            transactionType.value = 'expense'
        } else {
            transactionType.value = 'income'
        }

        // Handle splits
        if (tx.children && tx.children.length > 0) {
            isSplit.value = true
            splits.value = tx.children.map(child => ({
                id: child.id,
                amount: Math.abs(child.amountFrom),
                type: child.isTransfer ? 'transfer' : 'category',
                categoryId: child.categoryId && child.categoryId > 0 ? child.categoryId : null,
                toAccountId: child.toAccountId
            }))
        }
    } catch (error: any) {
        console.error('Failed to load transaction:', error)
        loadError.value = error?.data?.message || 'Errore nel caricamento della transazione'
    } finally {
        loading.value = false
    }
}

onMounted(() => {
    loadData()
})
</script>

<style scoped>
.transaction-form-page {
    min-height: 100vh;
    padding-bottom: calc(var(--space-xl) * 2);
}

.loading-state,
.error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    gap: var(--space-md);
    color: var(--color-text-secondary);
}

.spinner-lg {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
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
    align-items: center;
    gap: var(--space-xs);
    margin-bottom: var(--space-sm);
    padding: var(--space-sm);
    background: var(--color-bg-glass);
    border-radius: var(--radius-sm);
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
    color: white;
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
</style>
