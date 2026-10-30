<template>
    <div class="payees-page">
        <div class="page-header-row">
            <h1 class="page-title">{{ $t('payees.title') }}</h1>
            <button class="filter-chip" :class="{ active: showActiveOnly }" @click="showActiveOnly = !showActiveOnly">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
                {{ $t('common.activeOnly') }}
            </button>
        </div>

        <!-- Loading state -->
        <div v-if="loading" class="loading-state">
            <div class="spinner-lg"></div>
        </div>

        <!-- Empty state -->
        <div v-else-if="filteredPayees.length === 0" class="empty-state">
            <div class="empty-icon">👥</div>
            <h2>{{ $t('payees.noPayees') }}</h2>
            <p>{{ $t('payees.addFirst') }}</p>
        </div>

        <!-- Payees list -->
        <div v-else class="payees-list">
            <div v-for="payee in filteredPayees" :key="payee.id" class="payee-card"
                :class="{ inactive: !payee.isActive }" @click="editPayee(payee)">
                <div class="payee-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                </div>
                <span class="payee-title">{{ payee.title }}</span>
                <span v-if="!payee.isActive" class="inactive-badge">{{ $t('common.inactive') }}</span>
                <div class="card-arrow">&rsaquo;</div>
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
                    <h2>{{ editingId ? $t('payees.edit') : $t('payees.new') }}</h2>
                    <button class="close-btn" @click="closeModal">×</button>
                </div>
                <form @submit.prevent="savePayee" class="modal-form">
                    <div class="input-group">
                        <label for="title">{{ $t('payees.name') }} *</label>
                        <input id="title" v-model="form.title" type="text" class="input-field" required>
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
                            {{ editingId ? $t('common.saveChanges') : $t('payees.createPayee') }}
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

interface Payee {
    id: number
    title: string
    sortOrder: number
    isActive: boolean
}

const payees = ref<Payee[]>([])
const loading = ref(true)
const showActiveOnly = ref(true)

const filteredPayees = computed(() => {
    if (showActiveOnly.value) return payees.value.filter(p => p.isActive)
    return payees.value
})
const showModal = ref(false)
const saving = ref(false)
const formError = ref('')
const editingId = ref<number | null>(null)

const form = ref({
    title: '',
    isActive: true
})

async function loadPayees() {
    loading.value = true
    try {
        const data = await $fetch<{ payees: Payee[] }>('/api/payees')
        payees.value = data.payees
    } catch (error) {
        console.error('Failed to load payees:', error)
    } finally {
        loading.value = false
    }
}

function openModal() {
    editingId.value = null
    form.value = { title: '', isActive: true }
    showModal.value = true
    formError.value = ''
}

function editPayee(payee: Payee) {
    editingId.value = payee.id
    form.value = {
        title: payee.title,
        isActive: payee.isActive
    }
    showModal.value = true
    formError.value = ''
}

function closeModal() {
    showModal.value = false
    editingId.value = null
}

async function savePayee() {
    if (!form.value.title) {
        formError.value = t('payees.nameRequired')
        return
    }

    saving.value = true
    formError.value = ''

    try {
        const body = {
            title: form.value.title,
            isActive: form.value.isActive
        }

        if (editingId.value) {
            await $fetch(`/api/payees/${editingId.value}`, {
                method: 'PUT',
                body
            })
        } else {
            await $fetch('/api/payees', {
                method: 'POST',
                body
            })
        }
        closeModal()
        await loadPayees()
    } catch (error: any) {
        formError.value = error.data?.message || t('common.saveError')
    } finally {
        saving.value = false
    }
}

onMounted(async () => {
    await loadPayees()
})
</script>

<style scoped>
.payees-page {
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

.payees-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.payee-card {
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

.payee-card:hover {
    transform: translateX(4px);
    box-shadow: var(--shadow-lg);
}

.payee-card.inactive {
    opacity: 0.6;
}

.payee-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-glass);
    color: var(--color-text-muted);
    flex-shrink: 0;
}

.payee-title {
    flex: 1;
    font-weight: 500;
    font-size: 1rem;
}

.inactive-badge {
    background: var(--color-error-bg);
    color: var(--color-error);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    font-size: 0.7rem;
    font-weight: 500;
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
    max-width: 400px;
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
