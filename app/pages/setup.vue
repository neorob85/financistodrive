<template>
  <div class="setup-page">
    <!-- Background decoration -->
    <div class="bg-glow"></div>
    <div class="bg-glow bg-glow-2"></div>

    <div class="setup-container animate-fade-in">
      <div class="glass-card setup-card">
        <!-- Header -->
        <div class="setup-header">
          <div class="logo">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2" opacity="0.3"/>
              <circle cx="24" cy="24" r="12" fill="url(#grad)"/>
              <path d="M20 24h8M24 20v8" stroke="white" stroke-width="2" stroke-linecap="round"/>
              <defs>
                <linearGradient id="grad" x1="12" y1="12" x2="36" y2="36">
                  <stop offset="0%" stop-color="#6366f1"/>
                  <stop offset="100%" stop-color="#8b5cf6"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1>{{ appName }}</h1>
          <p class="subtitle">{{ step === 1 ? $t('setup.subtitle') : $t('setup.restoreSubtitle') }}</p>
        </div>

        <!-- Alert Messages -->
        <div v-if="message" :class="['alert', message.type === 'success' ? 'alert-success' : 'alert-error']">
          {{ message.text }}
        </div>

        <!-- Step 1: Database Configuration -->
        <template v-if="step === 1">
          <form @submit.prevent="handleInitialize" class="setup-form">
            <div class="form-grid">
              <div class="input-group">
                <label for="host">{{ $t('setup.host') }}</label>
                <input
                  id="host"
                  v-model="form.host"
                  type="text"
                  class="input-field"
                  :placeholder="$t('setup.hostPlaceholder')"
                  required
                />
              </div>

              <div class="input-group">
                <label for="port">{{ $t('setup.port') }}</label>
                <input
                  id="port"
                  v-model="form.port"
                  type="number"
                  class="input-field"
                  placeholder="3306"
                  required
                />
              </div>

              <div class="input-group">
                <label for="user">{{ $t('setup.username') }}</label>
                <input
                  id="user"
                  v-model="form.user"
                  type="text"
                  class="input-field"
                  placeholder="root"
                  required
                />
              </div>

              <div class="input-group">
                <label for="password">{{ $t('setup.password') }}</label>
                <input
                  id="password"
                  v-model="form.password"
                  type="password"
                  class="input-field"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div class="form-actions">
              <button
                type="button"
                class="btn btn-secondary"
                :disabled="loading"
                @click="handleTestConnection"
              >
                <span v-if="testingConnection" class="spinner"></span>
                {{ $t('setup.testConnection') }}
              </button>

              <button
                type="submit"
                class="btn btn-primary"
                :disabled="loading"
              >
                <span v-if="initializing" class="spinner"></span>
                {{ $t('setup.initializeDatabase') }}
              </button>
            </div>
          </form>

          <!-- Info -->
          <div class="setup-info">
            <p>
              <strong>{{ $t('setup.note') }}</strong> {{ $t('setup.noteText') }}
            </p>
          </div>
        </template>

        <!-- Step 2: Restore Options -->
        <template v-if="step === 2">
          <div class="restore-options">
            <div class="restore-option glass-card" @click="handleFullRestore">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
              <div class="restore-option-text">
                <strong>{{ $t('setup.fullBackupOption') }}</strong>
                <span>{{ $t('setup.fullBackupOptionDesc') }}</span>
              </div>
              <input ref="fullRestoreInput" type="file" accept=".zip" @change="onFullRestoreFile" style="display: none">
            </div>

            <div class="restore-option glass-card" @click="goToApp">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <div class="restore-option-text">
                <strong>{{ $t('setup.userBackupOption') }}</strong>
                <span>{{ $t('setup.userBackupOptionDesc') }}</span>
              </div>
            </div>

            <div class="restore-option glass-card" @click="goToApp">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <div class="restore-option-text">
                <strong>{{ $t('setup.noBackupOption') }}</strong>
                <span>{{ $t('setup.noBackupOptionDesc') }}</span>
              </div>
            </div>
          </div>

          <!-- Restore progress -->
          <div v-if="restoring" class="restore-progress">
            <span class="spinner"></span>
            {{ $t('setup.restoring') }}
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()
const appName = config.public.appName as string

const { t } = useI18n()
const router = useRouter()

const step = ref(1)

const form = ref({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: ''
})

const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const testingConnection = ref(false)
const initializing = ref(false)
const restoring = ref(false)
const fullRestoreInput = ref<HTMLInputElement | null>(null)

const loading = computed(() => testingConnection.value || initializing.value)

async function handleTestConnection() {
  message.value = null
  testingConnection.value = true

  try {
    const result = await $fetch<{ success: boolean; error?: string }>('/api/setup/test-connection', {
      method: 'POST',
      body: form.value
    })

    if (result.success) {
      message.value = { type: 'success', text: t('setup.connectionSuccess') }
    } else {
      message.value = { type: 'error', text: result.error || t('setup.connectionError') }
    }
  } catch (error: any) {
    message.value = {
      type: 'error',
      text: error.data?.message || t('setup.connectionError')
    }
  } finally {
    testingConnection.value = false
  }
}

async function handleInitialize() {
  message.value = null
  initializing.value = true

  try {
    await $fetch('/api/setup/initialize', {
      method: 'POST',
      body: form.value
    })

    message.value = { type: 'success', text: t('setup.initSuccess') }

    setTimeout(() => {
      message.value = null
      step.value = 2
    }, 1000)
  } catch (error: any) {
    message.value = {
      type: 'error',
      text: error.data?.message || t('setup.initError')
    }
  } finally {
    initializing.value = false
  }
}

function handleFullRestore() {
  if (restoring.value) return
  fullRestoreInput.value?.click()
}

async function onFullRestoreFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = ''

  restoring.value = true
  message.value = null

  try {
    const formData = new FormData()
    formData.append('file', file)

    await $fetch('/api/setup/restore', {
      method: 'POST',
      body: formData
    })

    message.value = { type: 'success', text: t('setup.restoreSuccess') }

    setTimeout(() => {
      router.push('/')
    }, 1500)
  } catch (error: any) {
    message.value = {
      type: 'error',
      text: error.data?.message || t('setup.restoreError')
    }
  } finally {
    restoring.value = false
  }
}

function goToApp() {
  router.push('/')
}
</script>

<style scoped>
.setup-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
  position: relative;
  overflow: hidden;
}

.bg-glow {
  position: absolute;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--color-accent-glow), transparent 70%);
  filter: blur(80px);
  top: -200px;
  right: -200px;
  pointer-events: none;
}

.bg-glow-2 {
  background: radial-gradient(circle, var(--color-accent-glow), transparent 70%);
  top: auto;
  right: auto;
  bottom: -300px;
  left: -200px;
}

.setup-container {
  width: 100%;
  max-width: 480px;
  position: relative;
  z-index: 1;
}

.setup-card {
  padding: var(--space-2xl);
}

.setup-header {
  text-align: center;
  margin-bottom: var(--space-xl);
}

.logo {
  color: var(--color-accent);
  margin-bottom: var(--space-md);
}

.setup-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: var(--space-xs);
}

.subtitle {
  color: var(--color-text-secondary);
  font-size: 0.95rem;
}

.alert {
  margin-bottom: var(--space-lg);
}

.setup-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-lg);
}

.form-grid .input-group:first-child {
  grid-column: 1 / -1;
}

.form-actions {
  display: flex;
  gap: var(--space-md);
}

.form-actions .btn {
  flex: 1;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.setup-info {
  margin-top: var(--space-xl);
  padding-top: var(--space-lg);
  border-top: 1px solid var(--color-border);
}

.setup-info p {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}

/* Step 2: Restore Options */
.restore-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.restore-option {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-lg);
  cursor: pointer;
  transition: all 0.2s;
}

.restore-option:hover {
  border-color: var(--color-accent);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.restore-option svg {
  flex-shrink: 0;
  color: var(--color-accent);
}

.restore-option-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.restore-option-text strong {
  font-size: 0.95rem;
}

.restore-option-text span {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.restore-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

@media (max-width: 500px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-actions {
    flex-direction: column;
  }

  .setup-card {
    padding: var(--space-xl);
  }
}
</style>
