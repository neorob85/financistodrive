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
          <p class="subtitle">{{ $t('setup.subtitle') }}</p>
        </div>

        <!-- Alert Messages -->
        <div v-if="message" :class="['alert', message.type === 'success' ? 'alert-success' : 'alert-error']">
          {{ message.text }}
        </div>

        <!-- Form -->
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
              <span v-else>🔌</span>
              {{ $t('setup.testConnection') }}
            </button>

            <button
              type="submit"
              class="btn btn-primary"
              :disabled="loading"
            >
              <span v-if="initializing" class="spinner"></span>
              <span v-else>🚀</span>
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()
const appName = config.public.appName as string

const { t } = useI18n()
const router = useRouter()

const form = ref({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: ''
})

const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const testingConnection = ref(false)
const initializing = ref(false)

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
      message.value = { type: 'success', text: '✓ ' + t('setup.connectionSuccess') }
    } else {
      message.value = { type: 'error', text: `✗ ${result.error}` }
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

    message.value = { type: 'success', text: '✓ ' + t('setup.initSuccess') }

    // Redirect to home after a short delay
    setTimeout(() => {
      router.push('/')
    }, 1500)
  } catch (error: any) {
    message.value = {
      type: 'error',
      text: error.data?.message || t('setup.initError')
    }
  } finally {
    initializing.value = false
  }
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

.setup-info code {
  font-family: var(--font-mono);
  background: var(--color-bg-glass);
  padding: 0.15em 0.4em;
  border-radius: var(--radius-sm);
  font-size: 0.9em;
  color: var(--color-accent);
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
