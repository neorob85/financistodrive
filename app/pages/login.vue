<template>
  <div class="login-page">
    <!-- Background decoration -->
    <div class="bg-glow"></div>
    <div class="bg-glow bg-glow-2"></div>
    
    <div class="login-container animate-fade-in">
      <div class="glass-card login-card">
        <!-- Header -->
        <div class="login-header">
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
          <p class="subtitle">{{ $t('login.subtitle') }}</p>
        </div>

        <!-- Alert Messages -->
        <div v-if="error" class="alert alert-error">
          {{ error }}
        </div>

        <!-- Form -->
        <form @submit.prevent="handleLogin" class="login-form">
          <div class="input-group">
            <label for="username">{{ $t('login.username') }}</label>
            <input
              id="username"
              v-model="form.username"
              type="text"
              class="input-field"
              :placeholder="$t('login.usernamePlaceholder')"
              required
              autocomplete="username"
            />
          </div>

          <div class="input-group">
            <label for="password">{{ $t('login.password') }}</label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              class="input-field"
              placeholder="••••••••"
              required
              autocomplete="current-password"
            />
          </div>

          <button
            type="submit"
            class="btn btn-primary btn-full"
            :disabled="loading"
          >
            <span v-if="loading" class="spinner"></span>
            <span v-else>🔐</span>
            {{ $t('login.submit') }}
          </button>
        </form>

        <!-- Default credentials info -->
        <div class="login-info">
          <p>
            <strong>{{ $t('login.defaultCredentials') }}</strong><br>
            Username: <code>admin</code> | Password: <code>password</code>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false
})

const { t } = useI18n()
const config = useRuntimeConfig()
const appName = config.public.appName as string
const router = useRouter()

const form = ref({
  username: '',
  password: ''
})

const error = ref<string | null>(null)
const loading = ref(false)

async function handleLogin() {
  error.value = null
  loading.value = true

  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: form.value
    })

    // Redirect to home on success
    router.push('/')
  } catch (err: any) {
    error.value = err.data?.message || t('login.error')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
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

.login-container {
  width: 100%;
  max-width: 400px;
  position: relative;
  z-index: 1;
}

.login-card {
  padding: var(--space-2xl);
}

.login-header {
  text-align: center;
  margin-bottom: var(--space-xl);
}

.logo {
  color: var(--color-accent);
  margin-bottom: var(--space-md);
}

.login-header h1 {
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

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.btn-full {
  width: 100%;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.login-info {
  margin-top: var(--space-xl);
  padding-top: var(--space-lg);
  border-top: 1px solid var(--color-border);
  text-align: center;
}

.login-info p {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  line-height: 1.6;
}

.login-info code {
  font-family: var(--font-mono);
  background: var(--color-bg-glass);
  padding: 0.15em 0.4em;
  border-radius: var(--radius-sm);
  font-size: 0.9em;
  color: var(--color-accent);
}

@media (max-width: 500px) {
  .login-card {
    padding: var(--space-xl);
  }
}
</style>
