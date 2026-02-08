<template>
    <div class="transaction-form-page">
        <header class="form-header">
            <button class="back-btn" @click="goBack">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
            </button>
            <h1>{{ $t('schedules.newSchedule') }}</h1>
            <div class="header-spacer"></div>
        </header>

        <form @submit.prevent="handleSubmit" class="transaction-form">
            <!-- Transaction Type Toggle -->
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
                <input v-model.number="form.amount" type="number" step="0.01" min="0" placeholder="0.00"
                    class="amount-input" required>
                <span class="currency-symbol">€</span>
            </div>

            <!-- Title -->
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

            <!-- Category (if not transfer) -->
            <div v-if="transactionType !== 'transfer'" class="input-group">
                <label for="category">{{ $t('transactions.category') }}</label>
                <select id="category" v-model="form.categoryId" class="input-field">
                    <option :value="null">{{ $t('transactions.noCategory') }}</option>
                    <option v-for="cat in flatCategories" :key="cat.id" :value="cat.id">
                        {{ cat.indent }}{{ cat.title }}
                    </option>
                </select>
            </div>

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

            <!-- Frequency -->
            <div class="input-group">
                <label for="frequency">{{ $t('schedules.frequency') }} *</label>
                <select id="frequency" v-model="form.frequency" class="input-field" required>
                    <option value="" disabled>{{ $t('schedules.selectFrequency') }}</option>
                    <option value="DAILY">{{ $t('schedules.daily') }}</option>
                    <option value="WEEKLY">{{ $t('schedules.weekly') }}</option>
                    <option value="BIWEEKLY">{{ $t('schedules.biweekly') }}</option>
                    <option value="MONTHLY">{{ $t('schedules.monthly') }}</option>
                    <option value="BIMONTHLY">{{ $t('schedules.bimonthly') }}</option>
                    <option value="QUARTERLY">{{ $t('schedules.quarterly') }}</option>
                    <option value="SEMIANNUAL">{{ $t('schedules.semiannual') }}</option>
                    <option value="YEARLY">{{ $t('schedules.yearly') }}</option>
                </select>
            </div>

            <!-- Start Date -->
            <div class="input-group">
                <label for="startDate">{{ $t('schedules.startDate') }} *</label>
                <input id="startDate" v-model="form.startDate" type="datetime-local" class="input-field" required>
            </div>

            <!-- Next Transaction Date -->
            <div class="input-group">
                <label for="nextDate">{{ $t('schedules.nextExecution') }} *</label>
                <input id="nextDate" v-model="form.nextTransactionDate" type="datetime-local" class="input-field"
                    required>
            </div>

            <!-- End Date -->
            <div class="input-group">
                <label for="endDate">{{ $t('schedules.endDateOptional') }}</label>
                <input id="endDate" v-model="form.endDate" type="datetime-local" class="input-field">
            </div>

            <!-- Project -->
            <div class="input-group">
                <label for="project">{{ $t('transactions.project') }}</label>
                <select id="project" v-model="form.projectId" class="input-field">
                    <option :value="null">{{ $t('transactions.noProject') }}</option>
                    <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.title }}</option>
                </select>
            </div>

            <!-- Payee -->
            <div class="input-group">
                <label for="payee">{{ $t('transactions.payee') }}</label>
                <select id="payee" v-model="form.payeeId" class="input-field">
                    <option :value="null">{{ $t('transactions.noPayee') }}</option>
                    <option v-for="p in payees" :key="p.id" :value="p.id">{{ p.title }}</option>
                </select>
            </div>

            <!-- Active -->
            <div class="checkbox-row">
                <label class="checkbox-label">
                    <input type="checkbox" v-model="form.isActive">
                    <span>{{ $t('schedules.activeStatus') }}</span>
                </label>
            </div>

            <!-- Notes -->
            <div class="input-group">
                <label for="notes">{{ $t('common.notes') }}</label>
                <textarea id="notes" v-model="form.notes" class="input-field" rows="2"></textarea>
            </div>

            <!-- Error -->
            <div v-if="formError" class="form-error">{{ formError }}</div>

            <!-- Actions -->
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" @click="goBack">{{ $t('common.cancel') }}</button>
                <button type="submit" class="btn btn-primary" :disabled="saving">
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

interface Account { id: number; title: string }
interface Category { id: number; title: string; parentId: number | null; isAutomotive: boolean }
interface FlatCategory { id: number; title: string; indent: string }
interface Payee { id: number; title: string }
interface Project { id: number; title: string }

const router = useRouter()

const accounts = ref<Account[]>([])
const categories = ref<Category[]>([])
const payees = ref<Payee[]>([])
const projects = ref<Project[]>([])

const transactionType = ref<'expense' | 'income' | 'transfer'>('expense')
const formError = ref('')
const saving = ref(false)

const nowDate = new Date()
const now = new Date(nowDate.getTime() - nowDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

const form = ref({
    title: '',
    amount: null as number | null,
    fromAccountId: null as number | null,
    toAccountId: null as number | null,
    categoryId: null as number | null,
    payeeId: null as number | null,
    projectId: null as number | null,
    frequency: '',
    startDate: now,
    nextTransactionDate: now,
    endDate: '',
    notes: '',
    isActive: true
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

    function flatten(items: (Category & { children?: any[] })[], level = 0) {
        for (const cat of items) {
            const prefix = level > 0 ? '└' + '─'.repeat(level) + ' ' : ''
            result.push({ id: cat.id, title: cat.title, indent: prefix })
            if (cat.children && cat.children.length > 0) {
                flatten(cat.children, level + 1)
            }
        }
    }

    flatten(rootCategories)
    return result
})

function goBack() {
    router.push('/schedules')
}

async function handleSubmit() {
    if (!form.value.title || !form.value.amount || !form.value.fromAccountId || !form.value.startDate || !form.value.frequency || !form.value.nextTransactionDate) {
        formError.value = t('common.required')
        return
    }

    if (transactionType.value === 'transfer' && !form.value.toAccountId) {
        formError.value = t('transactions.selectDestination')
        return
    }

    saving.value = true
    formError.value = ''

    try {
        const isExpense = transactionType.value === 'expense'
        const isTransfer = transactionType.value === 'transfer'
        const amountFrom = (isExpense || isTransfer) ? -Math.abs(form.value.amount) : Math.abs(form.value.amount)

        await $fetch('/api/schedules', {
            method: 'POST',
            body: {
                title: form.value.title,
                amountFrom,
                amountTo: isTransfer ? Math.abs(form.value.amount) : null,
                fromAccountId: form.value.fromAccountId,
                toAccountId: isTransfer ? form.value.toAccountId : null,
                categoryId: isTransfer ? -3 : (form.value.categoryId || -2),
                payeeId: form.value.payeeId,
                projectId: form.value.projectId,
                currencyId: 1,
                startDate: form.value.startDate,
                endDate: form.value.endDate || null,
                frequency: form.value.frequency,
                nextTransactionDate: form.value.nextTransactionDate,
                notes: form.value.notes,
                isTransfer,
                isAutomotive: false,
                isActive: form.value.isActive
            }
        })

        router.push('/schedules')
    } catch (error: any) {
        formError.value = error?.data?.message || t('common.saveError')
    } finally {
        saving.value = false
    }
}

async function loadDropdownData() {
    try {
        const [accountsData, categoriesData, payeesData, projectsData] = await Promise.all([
            $fetch<{ accounts: Account[] }>('/api/accounts'),
            $fetch<{ categories: Category[] }>('/api/categories'),
            $fetch<{ payees: Payee[] }>('/api/payees'),
            $fetch<{ projects: Project[] }>('/api/projects')
        ])
        accounts.value = accountsData.accounts || []
        categories.value = categoriesData.categories || []
        payees.value = payeesData.payees || []
        projects.value = projectsData.projects || []
    } catch (error) {
        console.error('Failed to load dropdown data:', error)
    }
}

onMounted(() => loadDropdownData())
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
</style>
