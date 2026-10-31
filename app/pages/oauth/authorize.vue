<template>
  <div class="authorize-page">
    <div class="bg-glow"></div>
    <div class="bg-glow bg-glow-2"></div>

    <div class="authorize-container animate-fade-in">
      <div class="glass-card authorize-card">
        <div class="authorize-header">
          <h1>{{ appName }}</h1>
          <p class="subtitle">{{ $t('oauth.title') }}</p>
        </div>

        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
        </div>

        <div v-else-if="errorText" class="alert alert-error">{{ errorText }}</div>

        <template v-else-if="info">
          <p class="request-text">
            <i18n-t keypath="oauth.request" tag="span">
              <template #client><strong>{{ info.clientName || $t('oauth.unknownClient') }}</strong></template>
              <template #host><strong>{{ info.redirectHost }}</strong></template>
            </i18n-t>
          </p>

          <ul class="permissions">
            <li>{{ $t('oauth.permissionRead') }}</li>
            <li v-if="canWrite">{{ $t('oauth.permissionWrite') }}</li>
          </ul>

          <label class="checkbox-row">
            <input v-model="canWrite" type="checkbox" :disabled="submitting">
            <span>
              <strong>{{ $t('settings.mcp.canWrite') }}</strong>
              <span class="hint">{{ $t('settings.mcp.canWriteHint') }}</span>
            </span>
          </label>

          <p class="hint revoke-hint">{{ $t('oauth.revokeHint') }}</p>

          <div class="actions">
            <button class="btn btn-secondary" :disabled="submitting" @click="submit(false)">
              {{ $t('oauth.deny') }}
            </button>
            <button class="btn btn-primary" :disabled="submitting" @click="submit(true)">
              <span v-if="submitting" class="spinner"></span>
              {{ $t('oauth.allow') }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false
})

const { t } = useI18n()
const route = useRoute()
const appName = useRuntimeConfig().public.appName as string

interface AuthorizeInfo {
  valid: boolean
  clientName?: string | null
  redirectHost?: string
  requestedWrite?: boolean
  redirectTo?: string
  errorDescription?: string
}

const loading = ref(true)
const submitting = ref(false)
const errorText = ref('')
const info = ref<AuthorizeInfo | null>(null)
const canWrite = ref(false)

// OAuth parameters exactly as Claude sent them
const params = computed(() => {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (typeof value === 'string') result[key] = value
  }
  return result
})

onMounted(async () => {
  try {
    const data = await $fetch<AuthorizeInfo>('/api/oauth/authorize', { query: params.value })
    if (data.redirectTo) {
      window.location.href = data.redirectTo
      return
    }
    if (!data.valid) {
      errorText.value = t('oauth.invalidRequest', { reason: data.errorDescription || '' })
      return
    }
    info.value = data
    canWrite.value = !!data.requestedWrite
  } catch {
    errorText.value = t('oauth.loadError')
  } finally {
    loading.value = false
  }
})

async function submit(approve: boolean) {
  submitting.value = true
  try {
    const data = await $fetch<{ redirectTo: string }>('/api/oauth/authorize', {
      method: 'POST',
      body: { params: params.value, approve, canWrite: canWrite.value }
    })
    window.location.href = data.redirectTo
  } catch (error: any) {
    errorText.value = error.data?.message || t('oauth.loadError')
    submitting.value = false
  }
}
</script>

<style scoped>
.authorize-page {
  min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
  padding: var(--space-lg);
  position: relative; overflow: hidden;
}

.bg-glow {
  position: absolute; width: 600px; height: 600px; border-radius: 50%;
  background: radial-gradient(circle, var(--color-accent-glow), transparent 70%);
  filter: blur(80px); top: -200px; right: -200px; pointer-events: none;
}
.bg-glow-2 { top: auto; right: auto; bottom: -300px; left: -200px; }

.authorize-container { width: 100%; max-width: 440px; position: relative; z-index: 1; }

.authorize-card { padding: var(--space-2xl); }

.authorize-header { text-align: center; margin-bottom: var(--space-xl); }
.authorize-header h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; margin-bottom: var(--space-xs); }
.subtitle { color: var(--color-text-secondary); font-size: 0.95rem; }

.request-text { font-size: 0.95rem; line-height: 1.5; margin-bottom: var(--space-md); }

.permissions {
  margin: 0 0 var(--space-lg); padding-left: var(--space-lg);
  font-size: 0.9rem; color: var(--color-text-secondary); line-height: 1.7;
}

.checkbox-row { display: flex; align-items: flex-start; gap: var(--space-sm); cursor: pointer; }
.checkbox-row input { margin-top: 3px; }
.checkbox-row > span { display: flex; flex-direction: column; gap: 2px; font-size: 0.9rem; }

.hint { display: block; font-size: 0.8rem; color: var(--color-text-muted); line-height: 1.4; }
.revoke-hint { margin-top: var(--space-lg); }

.actions { display: flex; justify-content: flex-end; gap: var(--space-md); margin-top: var(--space-xl); }

.loading-state { display: flex; justify-content: center; padding: var(--space-xl); }

.spinner {
  width: 16px; height: 16px;
  border: 2px solid transparent; border-top-color: currentColor;
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 500px) {
  .authorize-card { padding: var(--space-xl); }
  .actions { flex-direction: column-reverse; }
  .actions .btn { width: 100%; justify-content: center; }
}
</style>
