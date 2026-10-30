<template>
    <div class="ca-page">
        <div class="page-header-row">
            <h1 class="page-title">{{ $t('categoryAttributes.title') }}</h1>
        </div>

        <!-- Loading state -->
        <div v-if="loading" class="loading-state">
            <div class="spinner-lg"></div>
        </div>

        <!-- Empty state -->
        <div v-else-if="attributes.length === 0" class="empty-state">
            <div class="empty-icon">🏷️</div>
            <h2>{{ $t('categoryAttributes.noAttributes') }}</h2>
            <p>{{ $t('categoryAttributes.addFirst') }}</p>
        </div>

        <!-- Attributes grouped by category -->
        <div v-else class="groups">
            <div v-for="group in groupedAttributes" :key="group.categoryId" class="category-group">
                <div class="group-header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M6 3v18M6 7h6M12 5h8a1 1 0 010 4h-8M6 12h10M16 10h6a1 1 0 010 4h-6M6 17h4M10 15h10a1 1 0 010 4H10" />
                    </svg>
                    {{ group.categoryTitle }}
                </div>
                <div class="attr-list">
                    <div
                        v-for="attr in group.items"
                        :key="attr.id"
                        class="attr-card"
                        @click="editAttribute(attr)"
                    >
                        <div class="attr-type-badge" :class="`type-${attr.type.toLowerCase()}`">
                            {{ $t(`categoryAttributes.types.${attr.type}`) }}
                        </div>
                        <div class="attr-info">
                            <span class="attr-title">{{ attr.title }}</span>
                            <span v-if="attr.unit" class="attr-unit">{{ attr.unit }}</span>
                            <span v-if="attr.isRequired" class="attr-required">*</span>
                        </div>
                        <div class="card-arrow">&rsaquo;</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- FAB -->
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
                    <h2>{{ editingId ? $t('categoryAttributes.edit') : $t('categoryAttributes.new') }}</h2>
                    <button class="close-btn" @click="closeModal">×</button>
                </div>

                <form @submit.prevent="saveAttribute" class="modal-form">
                    <!-- Category -->
                    <div class="input-group">
                        <label>{{ $t('categoryAttributes.category') }} *</label>
                        <select v-model="form.categoryId" class="input-field" required>
                            <option value="">{{ $t('common.select') }}</option>
                            <option v-for="cat in userCategories" :key="cat.id" :value="cat.id">
                                {{ cat.title }}
                            </option>
                        </select>
                    </div>

                    <!-- Name -->
                    <div class="input-group">
                        <label>{{ $t('categoryAttributes.name') }} *</label>
                        <input v-model="form.title" type="text" class="input-field" required />
                    </div>

                    <!-- Type -->
                    <div class="input-group">
                        <label>{{ $t('categoryAttributes.type') }}</label>
                        <select v-model="form.type" class="input-field">
                            <option value="TEXT">{{ $t('categoryAttributes.types.TEXT') }}</option>
                            <option value="NUMBER">{{ $t('categoryAttributes.types.NUMBER') }}</option>
                            <option value="BOOLEAN">{{ $t('categoryAttributes.types.BOOLEAN') }}</option>
                            <option value="DATE">{{ $t('categoryAttributes.types.DATE') }}</option>
                            <option value="LIST">{{ $t('categoryAttributes.types.LIST') }}</option>
                        </select>
                    </div>

                    <!-- List values (only when type=LIST) -->
                    <div v-if="form.type === 'LIST'" class="input-group">
                        <label>{{ $t('categoryAttributes.listValues') }}</label>
                        <textarea
                            v-model="listValuesText"
                            class="input-field"
                            rows="4"
                            :placeholder="$t('categoryAttributes.listValuesPlaceholder')"
                        ></textarea>
                    </div>

                    <!-- Unit -->
                    <div class="input-group">
                        <label>{{ $t('categoryAttributes.unit') }}</label>
                        <input v-model="form.unit" type="text" class="input-field" placeholder="km, L, €, %" />
                    </div>

                    <!-- Default value -->
                    <div class="input-group">
                        <label>{{ $t('categoryAttributes.defaultValue') }}</label>
                        <input v-model="form.defaultValue" type="text" class="input-field" />
                    </div>

                    <!-- Required -->
                    <div class="checkbox-row">
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="form.isRequired" />
                            <span>{{ $t('categoryAttributes.required') }}</span>
                        </label>
                    </div>

                    <div v-if="formError" class="form-error">{{ formError }}</div>

                    <div class="modal-actions">
                        <button
                            v-if="editingId"
                            type="button"
                            class="btn btn-danger"
                            :disabled="saving"
                            @click="deleteAttribute"
                        >
                            {{ $t('common.delete') }}
                        </button>
                        <button type="button" class="btn btn-secondary" @click="closeModal">
                            {{ $t('common.cancel') }}
                        </button>
                        <button type="submit" class="btn btn-primary" :disabled="saving">
                            <span v-if="saving" class="spinner"></span>
                            {{ editingId ? $t('common.saveChanges') : $t('categoryAttributes.createAttribute') }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { t } = useI18n()

interface CategoryAttribute {
    id: number
    categoryId: number
    categoryTitle: string
    title: string
    type: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'LIST'
    listValues: string | null
    defaultValue: string | null
    unit: string | null
    isRequired: boolean
    sortOrder: number
}

interface Category {
    id: number
    title: string
    parentId: number | null
}

const attributes = ref<CategoryAttribute[]>([])
const categories = ref<Category[]>([])
const loading = ref(true)
const showModal = ref(false)
const saving = ref(false)
const formError = ref('')
const editingId = ref<number | null>(null)

const form = ref({
    categoryId: '' as number | '',
    title: '',
    type: 'TEXT' as CategoryAttribute['type'],
    unit: '',
    defaultValue: '',
    isRequired: false
})

// Editable textarea for list values (one per line)
const listValuesText = ref('')

// Only user-owned categories (no system ones with negative id)
const userCategories = computed(() =>
    categories.value.filter(c => c.id > 0)
)

// Group attributes by category
const groupedAttributes = computed(() => {
    const map = new Map<number, { categoryId: number; categoryTitle: string; items: CategoryAttribute[] }>()
    for (const attr of attributes.value) {
        if (!map.has(attr.categoryId)) {
            map.set(attr.categoryId, { categoryId: attr.categoryId, categoryTitle: attr.categoryTitle, items: [] })
        }
        map.get(attr.categoryId)!.items.push(attr)
    }
    return Array.from(map.values())
})

async function loadData() {
    loading.value = true
    try {
        const [attrData, catData] = await Promise.all([
            $fetch<{ attributes: CategoryAttribute[] }>('/api/category_attributes'),
            $fetch<{ categories: Category[] }>('/api/categories')
        ])
        attributes.value = attrData.attributes
        categories.value = catData.categories
    } catch (e) {
        console.error('Failed to load data:', e)
    } finally {
        loading.value = false
    }
}

function openModal() {
    editingId.value = null
    form.value = { categoryId: '', title: '', type: 'TEXT', unit: '', defaultValue: '', isRequired: false }
    listValuesText.value = ''
    formError.value = ''
    showModal.value = true
}

function editAttribute(attr: CategoryAttribute) {
    editingId.value = attr.id
    form.value = {
        categoryId: attr.categoryId,
        title: attr.title,
        type: attr.type,
        unit: attr.unit ?? '',
        defaultValue: attr.defaultValue ?? '',
        isRequired: attr.isRequired
    }
    // Convert JSON array to one-per-line text
    try {
        const parsed = attr.listValues ? JSON.parse(attr.listValues) : []
        listValuesText.value = Array.isArray(parsed) ? parsed.join('\n') : ''
    } catch {
        listValuesText.value = attr.listValues ?? ''
    }
    formError.value = ''
    showModal.value = true
}

function closeModal() {
    showModal.value = false
    editingId.value = null
}

function buildListValues(): string | null {
    if (form.value.type !== 'LIST') return null
    const lines = listValuesText.value.split('\n').map(l => l.trim()).filter(Boolean)
    return lines.length ? JSON.stringify(lines) : null
}

async function saveAttribute() {
    if (!form.value.categoryId || !form.value.title) {
        formError.value = t('common.required')
        return
    }

    saving.value = true
    formError.value = ''

    const body = {
        categoryId: form.value.categoryId,
        title: form.value.title,
        type: form.value.type,
        listValues: buildListValues(),
        defaultValue: form.value.defaultValue || null,
        unit: form.value.unit || null,
        isRequired: form.value.isRequired,
        sortOrder: 0
    }

    try {
        if (editingId.value) {
            await $fetch(`/api/category_attributes/${editingId.value}`, { method: 'PUT', body })
        } else {
            await $fetch('/api/category_attributes', { method: 'POST', body })
        }
        closeModal()
        await loadData()
    } catch (error: any) {
        formError.value = error.data?.message || t('common.saveError')
    } finally {
        saving.value = false
    }
}

async function deleteAttribute() {
    if (!editingId.value) return
    if (!confirm(t('categoryAttributes.deleteConfirm'))) return

    saving.value = true
    try {
        await $fetch(`/api/category_attributes/${editingId.value}`, { method: 'DELETE' })
        closeModal()
        await loadData()
    } catch (error: any) {
        formError.value = error.data?.message || t('common.saveError')
    } finally {
        saving.value = false
    }
}

onMounted(loadData)
</script>

<style scoped>
.ca-page {
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

/* Groups */
.groups {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
}

.category-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.group-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    padding: 0 var(--space-sm);
}

.attr-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.attr-card {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
}

.attr-card:hover {
    transform: translateX(4px);
    box-shadow: var(--shadow-lg);
}

.attr-type-badge {
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    flex-shrink: 0;
}

.type-text    { background: var(--color-bg-glass); color: var(--color-text-muted); }
.type-number  { background: #e0f2fe; color: #0369a1; }
.type-boolean { background: #dcfce7; color: #166534; }
.type-date    { background: #fef9c3; color: #854d0e; }
.type-list    { background: #f3e8ff; color: #6b21a8; }

.attr-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
}

.attr-title {
    font-weight: 500;
    font-size: 1rem;
}

.attr-unit {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    background: var(--color-bg-glass);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
}

.attr-required {
    color: var(--color-error);
    font-weight: 700;
    font-size: 1.1rem;
}

.card-arrow {
    font-size: 1.5rem;
    color: var(--color-text-muted);
    font-weight: 300;
}

/* FAB */
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
    max-width: 460px;
    padding: var(--space-xl);
    max-height: 90vh;
    overflow-y: auto;
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
    flex-wrap: wrap;
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
    font-family: inherit;
    font-size: 0.9rem;
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

.btn-danger {
    background: var(--color-error-bg);
    border: 1px solid var(--color-error);
    color: var(--color-error);
    margin-right: auto;
}

.btn-danger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.spinner-lg {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

.spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-spinner-border);
    border-top-color: var(--color-spinner-active);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
</style>
