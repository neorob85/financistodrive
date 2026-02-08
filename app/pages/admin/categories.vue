<template>
    <div class="admin-subpage">
        <header class="subpage-header">
            <NuxtLink to="/admin" class="back-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
            </NuxtLink>
            <h1>{{ $t('admin.categoriesManagement') }}</h1>
            <div class="header-spacer"></div>
        </header>

        <div class="page-content">
            <p class="page-subtitle">{{ $t('admin.globalCategoriesDesc') }}</p>

            <div v-if="loading" class="loading-state">
                <div class="spinner-lg"></div>
            </div>

            <div v-else-if="tree.length === 0" class="empty-state">
                <h2>{{ $t('admin.noCategoriesGlobal') }}</h2>
            </div>

            <div v-else class="categories-tree glass-card">
                <CategoryNode v-for="cat in tree" :key="cat.id" :category="cat" :expanded-ids="expandedIds"
                    @toggle="toggleExpand" @edit="editCategory" @reorder="handleReorder" />
            </div>

            <button class="fab" @click="openCreateModal">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            </button>
        </div>

        <!-- Create/Edit Modal -->
        <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
            <div class="modal glass-card">
                <div class="modal-header">
                    <h2>{{ editingId ? $t('categories.edit') : $t('categories.new') }}</h2>
                    <button class="close-btn" @click="closeModal">&times;</button>
                </div>
                <form @submit.prevent="saveCategory" class="modal-form">
                    <div class="input-group">
                        <label for="title">{{ $t('categories.categoryName') }} *</label>
                        <input id="title" v-model="form.title" type="text" class="input-field" required>
                    </div>

                    <div class="input-group">
                        <label for="parentId">{{ $t('categories.parentCategory') }}</label>
                        <select id="parentId" v-model="form.parentId" class="input-field">
                            <option :value="null">{{ $t('categories.noParent') }}</option>
                            <option v-for="opt in parentOptions" :key="opt.id" :value="opt.id">
                                {{ opt.label }}
                            </option>
                        </select>
                    </div>

                    <div class="input-group">
                        <label for="sortOrder">{{ $t('categories.sortOrder') }}</label>
                        <input id="sortOrder" v-model.number="form.sortOrder" type="number" min="0"
                            class="input-field">
                    </div>

                    <div class="checkbox-row">
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="form.isActive">
                            <span>{{ $t('common.active') }}</span>
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="form.isAutomotive">
                            <span>{{ $t('categories.automotive') }}</span>
                        </label>
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
                <p class="confirm-text">{{ $t('admin.deleteCategoryConfirm') }} <strong>{{ form.title }}</strong>?</p>
                <div v-if="deleteError" class="form-error">{{ deleteError }}</div>
                <div class="modal-actions">
                    <div class="actions-right">
                        <button class="btn btn-secondary" @click="showDeleteConfirm = false">{{ $t('common.cancel') }}</button>
                        <button class="btn btn-danger" @click="deleteCategory" :disabled="deleting">
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

interface Category {
    id: number
    parentId: number | null
    title: string
    sortOrder: number
    isActive: boolean
    isAutomotive: boolean
}

interface TreeNode {
    id: number
    title: string
    isActive: boolean
    isAutomotive: boolean
    parentId: number | null
    children: TreeNode[]
}

const allCategories = ref<Category[]>([])
const loading = ref(true)
const expandedIds = ref<Set<number>>(new Set())

const showModal = ref(false)
const showDeleteConfirm = ref(false)
const saving = ref(false)
const deleting = ref(false)
const formError = ref('')
const deleteError = ref('')
const editingId = ref<number | null>(null)

const form = ref({
    title: '',
    parentId: null as number | null,
    sortOrder: 0,
    isActive: true,
    isAutomotive: false
})

const tree = computed(() => buildTree(allCategories.value, null))

const parentOptions = computed(() => {
    const options: { id: number; label: string }[] = []
    function addOptions(cats: TreeNode[], depth: number) {
        for (const cat of cats) {
            if (editingId.value === cat.id) continue
            options.push({ id: cat.id, label: '  '.repeat(depth) + cat.title })
            addOptions(cat.children, depth + 1)
        }
    }
    addOptions(tree.value, 0)
    return options
})

function buildTree(categories: Category[], parentId: number | null, visited: Set<number> = new Set()): TreeNode[] {
    return categories
        .filter(c => c.parentId === parentId && !visited.has(c.id))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
        .map(c => {
            const newVisited = new Set(visited)
            newVisited.add(c.id)
            return {
                id: c.id,
                title: c.title,
                isActive: c.isActive,
                isAutomotive: c.isAutomotive,
                parentId: c.parentId,
                children: buildTree(categories, c.id, newVisited)
            }
        })
}

function toggleExpand(id: number) {
    if (expandedIds.value.has(id)) {
        expandedIds.value.delete(id)
    } else {
        expandedIds.value.add(id)
    }
    expandedIds.value = new Set(expandedIds.value)
}

async function loadCategories() {
    loading.value = true
    try {
        const data = await $fetch<{ categories: Category[] }>('/api/admin/categories')
        allCategories.value = data.categories
    } catch (error) {
        console.error('Failed to load categories:', error)
    } finally {
        loading.value = false
    }
}

function openCreateModal() {
    editingId.value = null
    form.value = { title: '', parentId: null, sortOrder: 0, isActive: true, isAutomotive: false }
    formError.value = ''
    showModal.value = true
}

function editCategory(id: number) {
    const cat = allCategories.value.find(c => c.id === id)
    if (!cat) return
    editingId.value = cat.id
    form.value = {
        title: cat.title,
        parentId: cat.parentId,
        sortOrder: cat.sortOrder,
        isActive: cat.isActive,
        isAutomotive: cat.isAutomotive
    }
    formError.value = ''
    showModal.value = true
}

function closeModal() {
    showModal.value = false
    editingId.value = null
}

async function saveCategory() {
    if (!form.value.title) {
        formError.value = t('admin.categoryNameRequired')
        return
    }

    saving.value = true
    formError.value = ''

    try {
        const body = {
            title: form.value.title,
            parentId: form.value.parentId,
            sortOrder: form.value.sortOrder,
            isActive: form.value.isActive,
            isAutomotive: form.value.isAutomotive
        }

        if (editingId.value) {
            await $fetch(`/api/admin/categories/${editingId.value}`, { method: 'PUT', body })
        } else {
            await $fetch('/api/admin/categories', { method: 'POST', body })
        }

        closeModal()
        await loadCategories()
    } catch (error: any) {
        formError.value = error.data?.message || 'Errore nel salvataggio'
    } finally {
        saving.value = false
    }
}

function confirmDelete() {
    deleteError.value = ''
    showDeleteConfirm.value = true
}

async function deleteCategory() {
    if (!editingId.value) return
    deleting.value = true
    deleteError.value = ''
    try {
        await $fetch(`/api/admin/categories/${editingId.value}`, { method: 'DELETE' })
        showDeleteConfirm.value = false
        closeModal()
        await loadCategories()
    } catch (error: any) {
        deleteError.value = error.data?.message || 'Errore nell\'eliminazione'
    } finally {
        deleting.value = false
    }
}

async function handleReorder(payload: { dragId: number; targetId: number; position: 'above' | 'below' | 'inside' }) {
    const { dragId, targetId, position } = payload
    const dragCat = allCategories.value.find(c => c.id === dragId)
    const targetCat = allCategories.value.find(c => c.id === targetId)
    if (!dragCat || !targetCat) return

    let newParentId: number | null
    if (position === 'inside') {
        newParentId = targetId
    } else {
        newParentId = targetCat.parentId
    }

    // Cycle check
    function isDescendant(parentId: number | null, checkId: number, visited: Set<number> = new Set()): boolean {
        if (parentId === null) return false
        if (parentId === checkId) return true
        if (visited.has(parentId)) return false
        visited.add(parentId)
        const parent = allCategories.value.find(c => c.id === parentId)
        return parent ? isDescendant(parent.parentId, checkId, visited) : false
    }

    if (newParentId !== null && (newParentId === dragId || isDescendant(newParentId, dragId))) {
        return
    }

    // Update via individual PUT calls for the dragged item
    try {
        await $fetch(`/api/admin/categories/${dragId}`, {
            method: 'PUT',
            body: {
                title: dragCat.title,
                parentId: newParentId,
                sortOrder: dragCat.sortOrder,
                isActive: dragCat.isActive,
                isAutomotive: dragCat.isAutomotive
            }
        })
        await loadCategories()
    } catch (error) {
        console.error('Failed to reorder:', error)
    }
}

onMounted(() => loadCategories())
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
.page-subtitle { font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: var(--space-lg); }

.loading-state { display: flex; justify-content: center; padding: var(--space-xl); }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 40vh; color: var(--color-text-secondary); }
.empty-state h2 { font-size: 1.25rem; color: var(--color-text-primary); }

.categories-tree {
    padding: var(--space-lg);
    background: var(--color-bg-card);
    backdrop-filter: blur(20px);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
}

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
.modal { width: 100%; max-width: 450px; padding: var(--space-xl); max-height: 90vh; overflow-y: auto; }
.modal-sm { max-width: 400px; }

.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg); }
.modal-header h2 { font-size: 1.25rem; font-weight: 600; }
.close-btn { background: none; border: none; font-size: 1.5rem; color: var(--color-text-muted); cursor: pointer; }

.modal-form { display: flex; flex-direction: column; gap: var(--space-md); }
.input-group { display: flex; flex-direction: column; gap: var(--space-xs); }
.input-group label { font-size: 0.85rem; color: var(--color-text-secondary); font-weight: 500; }

.checkbox-row { display: flex; gap: var(--space-lg); padding: var(--space-sm) 0; }
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
</style>
