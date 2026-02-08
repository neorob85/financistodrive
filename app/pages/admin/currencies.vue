<template>
    <div class="admin-subpage">
        <header class="subpage-header">
            <NuxtLink to="/admin" class="back-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
            </NuxtLink>
            <h1>{{ $t('admin.currenciesManagement') }}</h1>
            <div class="header-spacer"></div>
        </header>

        <div class="page-content">
            <div v-if="loading" class="loading-state">
                <div class="spinner-lg"></div>
            </div>

            <div v-else-if="currencies.length === 0" class="empty-state">
                <h2>{{ $t('admin.noCurrencies') }}</h2>
            </div>

            <div v-else class="items-list">
                <div v-for="currency in currencies" :key="currency.id" class="item-card" @click="editItem(currency)">
                    <span class="currency-symbol-badge">{{ currency.symbol }}</span>
                    <div class="currency-info">
                        <span class="currency-title">{{ currency.title }}</span>
                        <span class="currency-abbr">{{ currency.abbreviation }}</span>
                    </div>
                    <div class="currency-badges">
                        <span v-if="currency.isDefault" class="badge badge-default">Default</span>
                        <span class="badge badge-order">{{ currency.sortOrder }}</span>
                    </div>
                </div>
            </div>

            <button class="fab" @click="openCreateModal">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            </button>
        </div>

        <!-- Modal -->
        <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
            <div class="modal glass-card">
                <div class="modal-header">
                    <h2>{{ editingId ? $t('admin.editCurrency') : $t('admin.newCurrency') }}</h2>
                    <button class="close-btn" @click="closeModal">&times;</button>
                </div>
                <form @submit.prevent="saveItem" class="modal-form">
                    <div class="input-group">
                        <label for="title">{{ $t('admin.currencyName') }} *</label>
                        <input id="title" v-model="form.title" type="text" class="input-field" required
                            placeholder="Euro">
                    </div>
                    <div class="form-row">
                        <div class="input-group">
                            <label for="abbreviation">{{ $t('admin.abbreviation') }} *</label>
                            <input id="abbreviation" v-model="form.abbreviation" type="text" class="input-field"
                                required placeholder="EUR">
                        </div>
                        <div class="input-group">
                            <label for="symbol">{{ $t('admin.symbol') }} *</label>
                            <input id="symbol" v-model="form.symbol" type="text" class="input-field" required
                                placeholder="€" maxlength="10">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="input-group">
                            <label for="sortOrder">{{ $t('categories.sortOrder') }}</label>
                            <input id="sortOrder" v-model.number="form.sortOrder" type="number" class="input-field"
                                min="0">
                        </div>
                        <div class="input-group checkbox-group">
                            <label class="checkbox-label">
                                <input type="checkbox" v-model="form.isDefault">
                                <span>{{ $t('admin.defaultCurrency') }}</span>
                            </label>
                        </div>
                    </div>

                    <div v-if="formError" class="form-error">{{ formError }}</div>

                    <div class="modal-actions">
                        <button v-if="editingId" type="button" class="btn btn-danger" @click="confirmDelete"
                            :disabled="saving">
                            {{ $t('common.delete') }}
                        </button>
                        <div class="actions-right">
                            <button type="button" class="btn btn-secondary" @click="closeModal">{{ $t('common.cancel') }}</button>
                            <button type="submit" class="btn btn-primary" :disabled="saving">
                                <span v-if="saving" class="spinner"></span>
                                {{ editingId ? $t('common.save') : $t('common.create') }}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>

        <!-- Delete confirmation -->
        <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
            <div class="modal glass-card modal-sm">
                <div class="modal-header">
                    <h2>{{ $t('admin.deleteConfirm') }}</h2>
                    <button class="close-btn" @click="showDeleteConfirm = false">&times;</button>
                </div>
                <p class="confirm-text">{{ $t('admin.deleteCurrencyConfirm') }} <strong>{{ form.title }}</strong>?</p>
                <div v-if="deleteError" class="form-error">{{ deleteError }}</div>
                <div class="modal-actions">
                    <div class="actions-right">
                        <button class="btn btn-secondary" @click="showDeleteConfirm = false">{{ $t('common.cancel') }}</button>
                        <button class="btn btn-danger" @click="deleteItem" :disabled="deleting">
                            <span v-if="deleting" class="spinner"></span>
                            {{ $t('common.delete') }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
definePageMeta({
    layout: 'default',
    middleware: 'admin'
})

const { t } = useI18n()

interface Currency {
    id: number
    title: string
    abbreviation: string
    symbol: string
    sortOrder: number
    isDefault: boolean
}

const currencies = ref<Currency[]>([])
const loading = ref(true)
const showModal = ref(false)
const showDeleteConfirm = ref(false)
const saving = ref(false)
const deleting = ref(false)
const formError = ref('')
const deleteError = ref('')
const editingId = ref<number | null>(null)

const form = ref({
    title: '',
    abbreviation: '',
    symbol: '',
    sortOrder: 0,
    isDefault: false
})

async function loadItems() {
    loading.value = true
    try {
        const data = await $fetch<{ currencies: Currency[] }>('/api/admin/currencies')
        currencies.value = data.currencies
    } catch (error) {
        console.error('Failed to load currencies:', error)
    } finally {
        loading.value = false
    }
}

function openCreateModal() {
    editingId.value = null
    form.value = { title: '', abbreviation: '', symbol: '', sortOrder: 0, isDefault: false }
    formError.value = ''
    showModal.value = true
}

function editItem(currency: Currency) {
    editingId.value = currency.id
    form.value = {
        title: currency.title,
        abbreviation: currency.abbreviation,
        symbol: currency.symbol,
        sortOrder: currency.sortOrder,
        isDefault: currency.isDefault
    }
    formError.value = ''
    showModal.value = true
}

function closeModal() {
    showModal.value = false
    editingId.value = null
}

async function saveItem() {
    if (!form.value.title || !form.value.abbreviation || !form.value.symbol) {
        formError.value = t('admin.currencyFieldsRequired')
        return
    }

    saving.value = true
    formError.value = ''

    try {
        const body = {
            title: form.value.title,
            abbreviation: form.value.abbreviation,
            symbol: form.value.symbol,
            sortOrder: form.value.sortOrder,
            isDefault: form.value.isDefault
        }

        if (editingId.value) {
            await $fetch(`/api/admin/currencies/${editingId.value}`, { method: 'PUT', body })
        } else {
            await $fetch('/api/admin/currencies', { method: 'POST', body })
        }

        closeModal()
        await loadItems()
    } catch (error: any) {
        formError.value = error.data?.message || t('common.saveError')
    } finally {
        saving.value = false
    }
}

function confirmDelete() {
    deleteError.value = ''
    showDeleteConfirm.value = true
}

async function deleteItem() {
    if (!editingId.value) return
    deleting.value = true
    deleteError.value = ''
    try {
        await $fetch(`/api/admin/currencies/${editingId.value}`, { method: 'DELETE' })
        showDeleteConfirm.value = false
        closeModal()
        await loadItems()
    } catch (error: any) {
        deleteError.value = error.data?.message || t('common.deleteError')
    } finally {
        deleting.value = false
    }
}

onMounted(() => loadItems())
</script>

<style scoped>
.admin-subpage { min-height: 100vh; }

.subpage-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: var(--space-md) var(--space-lg);
    background: var(--color-bg-elevated); border-bottom: 1px solid var(--color-border);
    position: sticky; top: 0; z-index: 10;
}
.subpage-header h1 { font-size: 1.1rem; font-weight: 600; }
.back-btn { color: var(--color-text-primary); padding: var(--space-xs); }
.header-spacer { width: 32px; }

.page-content { padding: var(--space-lg); max-width: 800px; margin: 0 auto; }

.loading-state { display: flex; justify-content: center; padding: var(--space-xl); }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 40vh; color: var(--color-text-secondary); }
.empty-state h2 { font-size: 1.25rem; color: var(--color-text-primary); }

.items-list { display: flex; flex-direction: column; gap: var(--space-sm); }

.item-card {
    display: flex; align-items: center; gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: var(--color-bg-card); backdrop-filter: blur(20px);
    border: 1px solid var(--color-border); border-radius: var(--radius-xl);
    cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;
}
.item-card:hover { transform: translateX(4px); box-shadow: var(--shadow-lg); }

.currency-symbol-badge {
    width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
    background: var(--color-accent-bg); border-radius: 50%;
    font-size: 1.1rem; font-weight: 700; color: var(--color-accent); flex-shrink: 0;
}

.currency-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.currency-title { font-weight: 600; font-size: 0.95rem; }
.currency-abbr { font-size: 0.8rem; color: var(--color-text-muted); font-family: monospace; }

.currency-badges { display: flex; gap: var(--space-xs); flex-shrink: 0; }
.badge { padding: 2px 8px; border-radius: var(--radius-sm); font-size: 0.7rem; font-weight: 500; }
.badge-default { background: var(--color-success-bg); color: var(--color-success); }
.badge-order { background: var(--color-bg-elevated); color: var(--color-text-muted); }

.fab {
    position: fixed; bottom: calc(70px + var(--space-lg)); right: var(--space-lg);
    width: 56px; height: 56px; border-radius: 50%;
    background: linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary));
    border: none; color: white; display: flex; align-items: center; justify-content: center;
    cursor: pointer; box-shadow: var(--shadow-glow);
    transition: transform 0.2s, box-shadow 0.2s; z-index: 50;
}
.fab:hover { transform: scale(1.1); box-shadow: var(--shadow-glow); }

.modal-overlay {
    position: fixed; inset: 0; background: var(--color-modal-overlay);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000; padding: var(--space-lg); backdrop-filter: blur(4px);
}
.modal { width: 100%; max-width: 500px; padding: var(--space-xl); max-height: 90vh; overflow-y: auto; }
.modal-sm { max-width: 400px; }

.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg); }
.modal-header h2 { font-size: 1.25rem; font-weight: 600; }
.close-btn { background: none; border: none; font-size: 1.5rem; color: var(--color-text-muted); cursor: pointer; }

.modal-form { display: flex; flex-direction: column; gap: var(--space-md); }
.form-row { display: flex; gap: var(--space-md); }
.form-row .input-group { flex: 1; }
.input-group { display: flex; flex-direction: column; gap: var(--space-xs); }
.input-group label { font-size: 0.85rem; color: var(--color-text-secondary); font-weight: 500; }

.checkbox-group { justify-content: flex-end; }
.checkbox-label {
    display: flex; align-items: center; gap: var(--space-sm);
    cursor: pointer; font-size: 0.9rem; color: var(--color-text-secondary);
}
.checkbox-label input { width: 18px; height: 18px; accent-color: var(--color-accent); }

.form-error { background: var(--color-error-bg); color: var(--color-error); padding: var(--space-sm) var(--space-md); border-radius: var(--radius-sm); font-size: 0.85rem; }
.confirm-text { color: var(--color-text-secondary); font-size: 0.95rem; margin-bottom: var(--space-lg); }

.modal-actions { display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-md); }
.actions-right { display: flex; gap: var(--space-md); margin-left: auto; }

.btn {
    padding: var(--space-sm) var(--space-lg); border-radius: var(--radius-sm);
    font-weight: 500; cursor: pointer; transition: all 0.2s;
    display: flex; align-items: center; gap: var(--space-sm);
    font-family: inherit; font-size: 0.9rem;
}
.btn-primary { background: linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary)); border: none; color: white; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary { background: var(--color-bg-elevated); border: 1px solid var(--color-border); color: var(--color-text-secondary); }
.btn-danger { background: var(--color-error-bg); border: 1px solid var(--color-error); color: var(--color-error); }
.btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }

.spinner-lg { width: 40px; height: 40px; border: 3px solid var(--color-spinner-border); border-top-color: var(--color-spinner-active); border-radius: 50%; animation: spin 0.8s linear infinite; }
.spinner { width: 16px; height: 16px; border: 2px solid var(--color-spinner-border); border-top-color: var(--color-spinner-active); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 500px) {
    .form-row { flex-direction: column; }
}
</style>
