<template>
  <div class="projects-page">
    <div class="page-header-row">
      <h1 class="page-title">{{ $t('projects.title') }}</h1>
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
    <div v-else-if="filteredProjects.length === 0" class="empty-state">
      <div class="empty-icon">📁</div>
      <h2>{{ $t('projects.noProjects') }}</h2>
      <p>{{ $t('projects.addFirst') }}</p>
    </div>

    <!-- Projects list -->
    <div v-else class="projects-grid">
      <div v-for="project in filteredProjects" :key="project.id" class="project-card glass-card"
        :class="{ inactive: !project.isActive }" @click="goToProject(project.id)">
        <div class="project-header">
          <div class="project-icon">📁</div>
          <div class="header-right">
            <div v-if="!project.isActive" class="inactive-badge">{{ $t('common.inactive') }}</div>
            <button class="edit-btn" @click.stop="editProject(project)" :title="$t('common.edit')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>
        </div>

        <div class="project-title">{{ project.title || $t('projects.untitled') }}</div>

        <div v-if="project.budget && project.budget > 0" class="project-budget">
          <div class="budget-header">
            <span class="budget-label">{{ $t('projects.budget') }}</span>
            <span class="budget-amount">€ {{ formatAmount(project.budget) }}</span>
          </div>
          <div class="budget-progress">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: getSpentPercent(project) + '%' }"
                :class="getProgressClass(project)"></div>
            </div>
            <div class="progress-info">
              <span>{{ $t('projects.spent') }}: € {{ formatAmount(project.spent) }}</span>
              <span>{{ $t('projects.remaining') }}: € {{ formatAmount(getRemaining(project)) }}</span>
            </div>
          </div>
        </div>
        <div v-else class="no-budget">
          <span v-if="project.spent > 0">{{ $t('projects.spent') }}: € {{ formatAmount(project.spent) }}</span>
          <span v-else>{{ $t('projects.noBudget') }}</span>
        </div>
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
          <h2>{{ editingId ? $t('projects.edit') : $t('projects.new') }}</h2>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <form @submit.prevent="saveProject" class="modal-form">
          <div class="input-group">
            <label for="title">{{ $t('projects.projectName') }} *</label>
            <input id="title" v-model="form.title" type="text" class="input-field" required>
          </div>

          <div class="input-group">
            <label for="budget">{{ $t('projects.budget') }} (€)</label>
            <input id="budget" v-model.number="form.budget" type="number" step="0.01" min="0" class="input-field"
              :placeholder="$t('projects.noBudgetPlaceholder')">
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
              {{ editingId ? $t('common.saveChanges') : $t('projects.createProject') }}
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

const { t, locale } = useI18n()
const router = useRouter()

interface Project {
  id: number
  title: string | null
  isActive: boolean
  sortOrder: number
  budget: number | null
  spent: number
}

const projects = ref<Project[]>([])
const loading = ref(true)
const showActiveOnly = ref(true)

const filteredProjects = computed(() => {
  if (showActiveOnly.value) return projects.value.filter(p => p.isActive)
  return projects.value
})
const showModal = ref(false)
const saving = ref(false)
const formError = ref('')
const editingId = ref<number | null>(null)

const form = ref({
  title: '',
  budget: null as number | null,
  isActive: true
})

onMounted(async () => {
  await loadProjects()
})

async function loadProjects() {
  loading.value = true
  try {
    const data = await $fetch<{ projects: Project[] }>('/api/projects')
    projects.value = data.projects
  } catch (error) {
    console.error('Failed to load projects:', error)
  } finally {
    loading.value = false
  }
}

function goToProject(id: number) {
  router.push(`/projects/${id}`)
}

function openModal() {
  editingId.value = null
  form.value = { title: '', budget: null, isActive: true }
  showModal.value = true
  formError.value = ''
}

function editProject(project: Project) {
  editingId.value = project.id
  form.value = {
    title: project.title || '',
    budget: project.budget && project.budget > 0 ? project.budget : null,
    isActive: project.isActive
  }
  showModal.value = true
  formError.value = ''
}

function closeModal() {
  showModal.value = false
  editingId.value = null
  form.value = { title: '', budget: null, isActive: true }
}

async function saveProject() {
  if (!form.value.title) {
    formError.value = t('projects.nameRequired')
    return
  }

  saving.value = true
  formError.value = ''

  try {
    if (editingId.value) {
      // Update existing
      await $fetch(`/api/projects/${editingId.value}`, {
        method: 'PUT',
        body: {
          title: form.value.title,
          budget: form.value.budget || -1,
          isActive: form.value.isActive
        }
      })
    } else {
      // Create new
      await $fetch('/api/projects', {
        method: 'POST',
        body: {
          title: form.value.title,
          budget: form.value.budget || -1,
          isActive: form.value.isActive
        }
      })
    }
    closeModal()
    await loadProjects()
  } catch (error: any) {
    formError.value = error.data?.message || t('common.saveError')
  } finally {
    saving.value = false
  }
}

function formatAmount(amount: number): string {
  return amount.toLocaleString(locale.value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function getSpentPercent(project: Project): number {
  if (!project.budget || project.budget <= 0) return 0
  return Math.min(100, (project.spent / project.budget) * 100)
}

function getRemaining(project: Project): number {
  if (!project.budget) return 0
  return Math.max(0, project.budget - project.spent)
}

function getProgressClass(project: Project): string {
  const percent = getSpentPercent(project)
  if (percent >= 100) return 'over'
  if (percent >= 80) return 'warning'
  return 'safe'
}
</script>

<style scoped>
.projects-page {
  padding: var(--space-lg);
}

.page-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
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
  min-height: 50vh;
  text-align: center;
  color: var(--color-text-secondary);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: var(--space-lg);
}

.empty-state h2 {
  font-size: 1.25rem;
  margin-bottom: var(--space-sm);
  color: var(--color-text-primary);
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--space-lg);
}

.project-card {
  padding: var(--space-lg);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.project-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.project-card.inactive {
  opacity: 0.6;
}

.project-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.project-icon {
  font-size: 2rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.edit-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-glass);
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.edit-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-bg);
}

.inactive-badge {
  background: var(--color-error-bg);
  color: var(--color-error);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  font-weight: 500;
}

.project-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: var(--space-md);
}

.project-budget {
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.budget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-sm);
}

.budget-progress {
  margin-top: var(--space-sm);
}

.progress-bar {
  height: 8px;
  background: var(--color-bg-glass);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: var(--space-xs);
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}

.progress-fill.safe {
  background: linear-gradient(90deg, var(--color-success), var(--color-success-light));
}

.progress-fill.warning {
  background: linear-gradient(90deg, var(--color-warning), var(--color-warning-light));
}

.progress-fill.over {
  background: linear-gradient(90deg, var(--color-error), var(--color-error-light));
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.budget-label {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.budget-amount {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-accent);
}

.no-budget {
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
  font-size: 0.85rem;
  color: var(--color-text-muted);
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
  max-width: 400px;
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
