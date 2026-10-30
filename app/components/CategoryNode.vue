<template>
  <div class="category-node" :class="{ 'is-root': depth === 0 }">
    <div class="category-card" :class="{
      inactive: !category.isActive,
      'drag-over': isDragOver,
      'drop-above': dropPosition === 'above',
      'drop-below': dropPosition === 'below',
      'drop-inside': dropPosition === 'inside',
      'has-children': category.children.length > 0
    }" draggable="true" @dragstart="onDragStart" @dragend="onDragEnd" @dragover.prevent="onDragOver"
      @dragleave="onDragLeave" @drop="onDrop">

      <!-- Drag handle -->
      <div class="drag-handle">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </div>

      <!-- Icon badge -->
      <div class="cat-icon-badge" :class="{ automotive: category.isAutomotive }">
        <span>{{ category.isAutomotive ? '🚗' : '📁' }}</span>
      </div>

      <!-- Category info -->
      <div class="cat-info" @click.stop="$emit('edit', category.id)">
        <div class="cat-title">{{ category.title }}</div>
        <div class="cat-meta">
          <span v-if="category.children.length > 0" class="cat-badge children-count">
            {{ category.children.length }} {{ category.children.length === 1 ? 'sub' : 'sub' }}
          </span>
          <span v-if="!category.isActive" class="cat-badge inactive-badge">{{ $t('common.inactive') || 'Inattiva' }}</span>
        </div>
      </div>

      <!-- Expand toggle -->
      <button v-if="category.children.length > 0" class="expand-toggle" @click.stop="$emit('toggle', category.id)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          :class="{ rotated: isExpanded }">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>

    <!-- Children -->
    <div v-if="isExpanded && category.children.length > 0" class="children">
      <CategoryNode v-for="child in category.children" :key="child.id" :category="child" :expanded-ids="expandedIds"
        :depth="depth + 1" @toggle="$emit('toggle', $event)" @edit="$emit('edit', $event)"
        @reorder="$emit('reorder', $event)" @dragstart-id="$emit('dragstart-id', $event)"
        @dragend-id="$emit('dragend-id')" />
    </div>
  </div>
</template>

<script setup lang="ts">
interface TreeNode {
  id: number
  title: string
  isActive: boolean
  isAutomotive: boolean
  parentId: number | null
  children: TreeNode[]
}

const props = withDefaults(defineProps<{
  category: TreeNode
  expandedIds: Set<number>
  depth?: number
}>(), {
  depth: 0
})

const emit = defineEmits<{
  toggle: [id: number]
  edit: [id: number]
  reorder: [payload: { dragId: number; targetId: number; position: 'above' | 'below' | 'inside' }]
  'dragstart-id': [id: number]
  'dragend-id': []
}>()

const isExpanded = computed(() => props.expandedIds.has(props.category.id))
const isDragOver = ref(false)
const dropPosition = ref<'above' | 'below' | 'inside' | null>(null)

// Global drag state (shared via window)
function getDraggingId(): number | null {
  return (window as any).__categoryDraggingId ?? null
}

function setDraggingId(id: number | null) {
  (window as any).__categoryDraggingId = id
}

function onDragStart(e: DragEvent) {
  e.stopPropagation()
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(props.category.id))
  }
  setDraggingId(props.category.id)
  emit('dragstart-id', props.category.id)
}

function onDragEnd(e: DragEvent) {
  e.stopPropagation()
  isDragOver.value = false
  dropPosition.value = null
  setDraggingId(null)
  emit('dragend-id')
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()

  const dragId = getDraggingId()
  if (!dragId || dragId === props.category.id) {
    dropPosition.value = null
    return
  }

  isDragOver.value = true

  // Determine drop position based on mouse Y position
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const y = e.clientY - rect.top
  const height = rect.height

  if (y < height * 0.25) {
    dropPosition.value = 'above'
  } else if (y > height * 0.75) {
    dropPosition.value = 'below'
  } else {
    dropPosition.value = 'inside'
  }
}

function onDragLeave(e: DragEvent) {
  e.stopPropagation()
  isDragOver.value = false
  dropPosition.value = null
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()

  const dragId = getDraggingId() || parseInt(e.dataTransfer?.getData('text/plain') || '0')
  if (!dragId || dragId === props.category.id) return

  if (dropPosition.value) {
    emit('reorder', {
      dragId,
      targetId: props.category.id,
      position: dropPosition.value
    })
  }

  isDragOver.value = false
  dropPosition.value = null
  setDraggingId(null)
}
</script>

<style scoped>
.category-node {
  font-size: 0.95rem;
}

.category-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  background: var(--color-bg-card);
  backdrop-filter: blur(20px);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
  margin-bottom: var(--space-sm);
}

.category-card:hover {
  transform: translateX(4px);
  box-shadow: var(--shadow-lg);
}

.category-card.inactive {
  opacity: 0.5;
}

.category-card.drop-above {
  border-top: 3px solid var(--color-accent);
}

.category-card.drop-below {
  border-bottom: 3px solid var(--color-accent);
}

.category-card.drop-inside {
  background: var(--color-accent-bg);
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-glow);
}

.drag-handle {
  cursor: grab;
  color: var(--color-text-muted);
  flex-shrink: 0;
  padding: var(--space-xs);
  opacity: 0.5;
  transition: opacity 0.2s;
}

.category-card:hover .drag-handle {
  opacity: 1;
}

.drag-handle:active {
  cursor: grabbing;
}

.cat-icon-badge {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--color-bg-glass);
  font-size: 1.1rem;
}

.cat-icon-badge.automotive {
  background: var(--color-accent-bg);
}

.cat-info {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.cat-title {
  font-weight: 500;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.cat-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.cat-badge {
  background: var(--color-bg-glass);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
}

.cat-badge.inactive-badge {
  background: var(--color-error-bg);
  color: var(--color-error);
}

.cat-badge.children-count {
  background: var(--color-accent-bg);
  color: var(--color-accent);
}

.expand-toggle {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-glass);
  border: none;
  border-radius: 50%;
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;
}

.expand-toggle:hover {
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
}

.expand-toggle svg {
  transition: transform 0.2s;
}

.expand-toggle svg.rotated {
  transform: rotate(180deg);
}

.children {
  margin-left: 20px;
  padding-left: var(--space-md);
  border-left: 2px solid var(--color-border);
}

@media (max-width: 400px) {
  .category-card {
    padding: var(--space-sm) var(--space-md);
    gap: var(--space-sm);
  }

  .cat-icon-badge {
    width: 34px;
    height: 34px;
    font-size: 0.95rem;
  }

  .cat-meta {
    font-size: 0.7rem;
  }
}
</style>
