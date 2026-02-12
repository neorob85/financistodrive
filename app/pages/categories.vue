<template>
  <div class="categories-page">
    <h1 class="page-title">{{ $t('categories.title') }}</h1>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab" :class="{ active: activeTab === 'user' }" @click="activeTab = 'user'">
        {{ $t('categories.myCategories') }}
      </button>
      <button class="tab" :class="{ active: activeTab === 'automotive' }" @click="activeTab = 'automotive'">
        {{ $t('categories.automotive') }}
      </button>
      <button class="tab" :class="{ active: activeTab === 'global' }" @click="activeTab = 'global'">
        {{ $t('categories.global') }}
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="loading-state">
      <div class="spinner-lg"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="currentTree.length === 0" class="empty-state">
      <div class="empty-icon">📂</div>
      <h2>{{ $t('categories.noCategories') }}</h2>
    </div>

    <!-- Tree controls -->
    <div v-else>
      <div v-if="hasAnyChildren" class="tree-controls">
        <button class="control-btn" @click="expandAll">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          {{ $t('categories.expandAll') }}
        </button>
        <button class="control-btn" @click="collapseAll">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 15 12 9 18 15" />
          </svg>
          {{ $t('categories.collapseAll') }}
        </button>
      </div>

      <!-- Categories tree -->
      <div class="categories-list">
        <CategoryNode v-for="cat in currentTree" :key="cat.id" :category="cat" :expanded-ids="expandedIds"
          @toggle="toggleExpand" @edit="editCategory" @reorder="handleReorder" />
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
          <h2>{{ editingId ? $t('categories.edit') : $t('categories.new') }}</h2>
          <button class="close-btn" @click="closeModal">×</button>
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

          <div class="form-row">
            <div class="input-group">
              <label for="sortOrder">{{ $t('categories.sortOrder') }}</label>
              <input id="sortOrder" v-model.number="form.sortOrder" type="number" min="0" class="input-field">
            </div>
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
            <button type="button" class="btn btn-secondary" @click="closeModal">{{ $t('common.cancel') }}</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <span v-if="saving" class="spinner"></span>
              {{ editingId ? $t('common.saveChanges') : $t('categories.createCategory') }}
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

interface Category {
  id: number
  parentId: number | null
  title: string
  sortOrder: number
  isActive: boolean
  userId: number | null
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
const activeTab = ref<'user' | 'automotive' | 'global'>('user')
const expandedIds = ref<Set<number>>(new Set())

const showModal = ref(false)
const saving = ref(false)
const formError = ref('')
const editingId = ref<number | null>(null)

const form = ref({
  title: '',
  parentId: null as number | null,
  sortOrder: 0,
  isActive: true,
  isAutomotive: false
})

// Parent options for dropdown (flat list with indentation)
const parentOptions = computed(() => {
  const options: { id: number; label: string }[] = []

  function addOptions(cats: TreeNode[], depth: number) {
    for (const cat of cats) {
      // Don't allow selecting self or descendants when editing
      if (editingId.value === cat.id) continue

      options.push({
        id: cat.id,
        label: '  '.repeat(depth) + cat.title
      })
      addOptions(cat.children, depth + 1)
    }
  }

  // Use full tree (not filtered)
  const fullTree = buildTree(allCategories.value, null)
  addOptions(fullTree, 0)
  return options
})

// Build tree for current tab
const currentTree = computed(() => {
  const cats = allCategories.value

  if (activeTab.value === 'global') {
    // Global categories: user_id is NULL
    const globalCats = cats.filter(c => c.userId === null)
    return buildTree(globalCats, null)
  }

  if (activeTab.value === 'automotive') {
    // Automotive: is_automotive = 1 OR parent has automotive children
    return buildTreeWithFilter(cats, c => c.isAutomotive)
  }

  // User categories: is_automotive = 0
  return buildTreeWithFilter(cats, c => !c.isAutomotive && c.userId !== null)
})

// Build simple tree with cycle protection
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

// Build tree with filter, including parents that have matching children (with cycle protection)
function buildTreeWithFilter(
  categories: Category[],
  filter: (c: Category) => boolean
): TreeNode[] {
  // Find all matching category IDs
  const matchingIds = new Set(
    categories.filter(filter).map(c => c.id)
  )

  // Find all ancestor IDs of matching categories (with cycle protection)
  const ancestorIds = new Set<number>()
  function addAncestors(catId: number | null, visited: Set<number> = new Set()) {
    if (catId === null) return
    if (visited.has(catId)) return // Prevent cycles
    visited.add(catId)
    const cat = categories.find(c => c.id === catId)
    if (cat) {
      ancestorIds.add(cat.id)
      if (cat.parentId) addAncestors(cat.parentId, visited)
    }
  }

  categories.filter(filter).forEach(c => addAncestors(c.parentId, new Set()))

  // Build tree including only matching + ancestors (with cycle protection)
  const relevantIds = new Set([...matchingIds, ...ancestorIds])

  function buildFiltered(parentId: number | null, visited: Set<number> = new Set()): TreeNode[] {
    return categories
      .filter(c => c.parentId === parentId && relevantIds.has(c.id) && !visited.has(c.id))
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
          children: buildFiltered(c.id, newVisited).filter(child =>
            matchingIds.has(child.id) || child.children.length > 0
          )
        }
      })
  }

  return buildFiltered(null)
}

// Check if any category in the current tree has children
const hasAnyChildren = computed(() => {
  function hasChildren(nodes: TreeNode[]): boolean {
    return nodes.some(n => n.children.length > 0)
  }
  return hasChildren(currentTree.value)
})

function toggleExpand(id: number) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
  }
  expandedIds.value = new Set(expandedIds.value)
}

function collectAllIds(nodes: TreeNode[]): number[] {
  const ids: number[] = []
  for (const node of nodes) {
    if (node.children.length > 0) {
      ids.push(node.id)
      ids.push(...collectAllIds(node.children))
    }
  }
  return ids
}

function expandAll() {
  const allIds = collectAllIds(currentTree.value)
  expandedIds.value = new Set(allIds)
}

function collapseAll() {
  expandedIds.value = new Set()
}

async function loadCategories() {
  loading.value = true
  try {
    const data = await $fetch<{ categories: Category[] }>('/api/categories')
    allCategories.value = data.categories
  } catch (error) {
    console.error('Failed to load categories:', error)
  } finally {
    loading.value = false
  }
}

function openModal() {
  editingId.value = null
  form.value = {
    title: '',
    parentId: null,
    sortOrder: 0,
    isActive: true,
    isAutomotive: activeTab.value === 'automotive'
  }
  showModal.value = true
  formError.value = ''
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
  showModal.value = true
  formError.value = ''
}

function closeModal() {
  showModal.value = false
  editingId.value = null
}

async function handleReorder(payload: { dragId: number; targetId: number; position: 'above' | 'below' | 'inside' }) {
  const { dragId, targetId, position } = payload
  const dragCat = allCategories.value.find(c => c.id === dragId)
  const targetCat = allCategories.value.find(c => c.id === targetId)

  if (!dragCat || !targetCat) return

  // Determine new parent
  let newParentId: number | null
  if (position === 'inside') {
    newParentId = targetId
  } else {
    newParentId = targetCat.parentId
  }

  // Cycle check: ensure we're not making a category a child of itself or its descendants
  function isDescendant(parentId: number | null, checkId: number, visited: Set<number> = new Set()): boolean {
    if (parentId === null) return false
    if (parentId === checkId) return true
    if (visited.has(parentId)) return false // Prevent infinite loop
    visited.add(parentId)
    const parent = allCategories.value.find(c => c.id === parentId)
    return parent ? isDescendant(parent.parentId, checkId, visited) : false
  }

  // Check if target (or its parent) is a descendant of the dragged item
  if (newParentId !== null && (newParentId === dragId || isDescendant(newParentId, dragId))) {
    console.warn('Cannot move category into its own descendant')
    return
  }

  // Get siblings at target level
  let siblings = allCategories.value
    .filter(c => c.parentId === newParentId && c.id !== dragId)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  // Insert dragged item at correct position
  const targetIndex = siblings.findIndex(c => c.id === targetId)
  let insertIndex: number

  if (position === 'inside') {
    // Insert as first child
    siblings = allCategories.value
      .filter(c => c.parentId === targetId && c.id !== dragId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    insertIndex = 0
  } else if (position === 'above') {
    insertIndex = targetIndex >= 0 ? targetIndex : 0
  } else {
    insertIndex = targetIndex >= 0 ? targetIndex + 1 : siblings.length
  }

  // Build updates with incremental sort_order
  const updates: { id: number; parentId: number | null; sortOrder: number }[] = []

  // Add dragged item
  updates.push({
    id: dragId,
    parentId: newParentId,
    sortOrder: insertIndex * 10
  })

  // Update all siblings sort_order
  let order = 0
  for (const sib of siblings) {
    if (order === insertIndex) {
      order++ // Skip the slot for dragged item
    }
    updates.push({
      id: sib.id,
      parentId: sib.parentId,
      sortOrder: order * 10
    })
    order++
  }

  // Call API
  try {
    await $fetch('/api/categories/reorder', {
      method: 'POST',
      body: { updates }
    })
    await loadCategories()
  } catch (error) {
    console.error('Failed to reorder:', error)
  }
}

async function saveCategory() {
  if (!form.value.title) {
    formError.value = t('categories.nameRequired')
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
      await $fetch(`/api/categories/${editingId.value}`, {
        method: 'PUT',
        body
      })
    } else {
      await $fetch('/api/categories', {
        method: 'POST',
        body
      })
    }
    closeModal()
    await loadCategories()
  } catch (error: any) {
    formError.value = error.data?.message || t('common.saveError')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await loadCategories()
})
</script>

<style scoped>
.categories-page {
  padding: var(--space-lg);
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: var(--space-lg);
}

.tabs {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-lg);
  background: var(--color-bg-glass);
  padding: var(--space-xs);
  border-radius: var(--radius-md);
}

.tab {
  flex: 1;
  padding: var(--space-sm) var(--space-md);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.tab:hover {
  background: var(--color-bg-elevated);
}

.tab.active {
  background: var(--color-accent);
  color: var(--color-text-on-accent);
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

.tree-controls {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.control-btn {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-md);
  background: var(--color-bg-card);
  backdrop-filter: blur(20px);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.control-btn:hover {
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  border-color: var(--color-accent);
}

.categories-list {
  display: flex;
  flex-direction: column;
}

.spinner-lg {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
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

.fab:active {
  transform: scale(0.95);
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
  max-width: 450px;
  max-height: 90vh;
  overflow-y: auto;
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
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: var(--color-text-primary);
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-md);
}

.checkbox-row {
  display: flex;
  gap: var(--space-lg);
  flex-wrap: wrap;
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

.btn-primary:hover:not(:disabled) {
  box-shadow: var(--shadow-glow);
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

.btn-secondary:hover {
  background: var(--color-bg-glass);
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
