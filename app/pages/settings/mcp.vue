<template>
  <div class="settings-subpage">
    <header class="subpage-header">
      <NuxtLink to="/settings" class="back-btn">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </NuxtLink>
      <h1>{{ $t('settings.mcp.title') }}</h1>
      <div class="header-spacer"></div>
    </header>

    <div class="page-content">
      <!-- Intro + server URL -->
      <section class="section">
        <div class="glass-card section-card">
          <p class="section-desc">{{ $t('settings.mcp.intro') }}</p>
          <label class="field-label">{{ $t('settings.mcp.serverUrl') }}</label>
          <div class="copy-row">
            <code class="code-inline">{{ serverUrl }}</code>
            <button class="btn btn-secondary btn-copy" @click="copy(serverUrl, 'url')">
              {{ copied === 'url' ? $t('settings.mcp.copied') : $t('settings.mcp.copy') }}
            </button>
          </div>
        </div>
      </section>

      <!-- Create token -->
      <section class="section">
        <h2 class="section-title">{{ $t('settings.mcp.newToken') }}</h2>
        <div class="glass-card section-card">
          <form class="token-form" @submit.prevent="createToken">
            <div class="form-row">
              <div class="input-group">
                <label for="tokenName">{{ $t('settings.mcp.tokenName') }}</label>
                <input id="tokenName" v-model="form.name" type="text" class="input-field" maxlength="100" required
                  :placeholder="$t('settings.mcp.tokenNamePlaceholder')">
              </div>
              <div class="input-group">
                <label for="tokenExpiry">{{ $t('settings.mcp.expiresIn') }}</label>
                <select id="tokenExpiry" v-model.number="form.expiresInDays" class="input-field">
                  <option v-for="days in [30, 90, 180, 365]" :key="days" :value="days">
                    {{ $t('settings.mcp.days', { n: days }) }}
                  </option>
                </select>
              </div>
            </div>
            <label class="checkbox-row">
              <input v-model="form.canWrite" type="checkbox">
              <span>
                <strong>{{ $t('settings.mcp.canWrite') }}</strong>
                <span class="hint">{{ $t('settings.mcp.canWriteHint') }}</span>
              </span>
            </label>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary" :disabled="creating">
                <span v-if="creating" class="spinner"></span>
                {{ $t('settings.mcp.generate') }}
              </button>
            </div>
          </form>

          <div v-if="createError" class="alert alert-error">{{ createError }}</div>

          <div v-if="newToken" class="new-token">
            <div class="alert alert-success">{{ $t('settings.mcp.tokenCreated') }}</div>
            <div class="copy-row">
              <code class="code-inline token-value">{{ newToken }}</code>
              <button class="btn btn-secondary btn-copy" @click="copy(newToken, 'token')">
                {{ copied === 'token' ? $t('settings.mcp.copied') : $t('settings.mcp.copy') }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Token list -->
      <section class="section">
        <h2 class="section-title">{{ $t('settings.apiTokens') }}</h2>
        <div class="glass-card section-card">
          <div v-if="loadingTokens" class="loading-state">
            <div class="spinner"></div>
          </div>
          <div v-else-if="tokens.length === 0" class="empty-tokens">
            <p>{{ $t('settings.noTokens') }}</p>
          </div>
          <div v-else class="tokens-list">
            <div v-for="token in tokens" :key="token.id" class="token-item"
              :class="{ revoked: token.isRevoked || isExpired(token) }">
              <div class="token-info">
                <div class="token-name">
                  {{ token.name || $t('settings.unnamedToken') }}
                  <span v-if="token.isOauth" class="token-scope">OAuth</span>
                  <span class="token-scope" :class="{ write: token.canWrite }">
                    {{ token.canWrite ? $t('settings.mcp.scopeWrite') : $t('settings.mcp.scopeRead') }}
                  </span>
                </div>
                <div class="token-meta">
                  <span>{{ $t('settings.created') }}: {{ formatDate(token.createdAt) }}</span>
                  <span v-if="token.lastUsedAt">• {{ $t('settings.lastUsed') }}: {{ formatDate(token.lastUsedAt) }}</span>
                  <span>• {{ $t('settings.expires') }}: {{ formatDate(token.expiresAt) }}</span>
                </div>
                <div v-if="isExpired(token)" class="token-status revoked">{{ $t('settings.mcp.expired') }}</div>
                <div v-else-if="token.isRevoked" class="token-status revoked">{{ $t('settings.disabled') }}</div>
                <div v-else class="token-status active">{{ $t('common.active') }}</div>
              </div>
              <div class="token-actions">
                <button class="btn-sm" :class="token.isRevoked ? 'btn-success' : 'btn-warning'"
                  @click="toggleToken(token.id)" :disabled="togglingToken === token.id">
                  {{ token.isRevoked ? $t('common.activate') : $t('common.deactivate') }}
                </button>
                <button class="btn-sm btn-danger" @click="deleteToken(token.id)"
                  :disabled="deletingToken === token.id">
                  {{ $t('common.delete') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Instructions -->
      <section class="section">
        <h2 class="section-title">{{ $t('settings.mcp.howTo') }}</h2>
        <div class="glass-card section-card instructions">
          <h3>{{ $t('settings.mcp.claudeAi') }}</h3>
          <p class="section-desc">{{ $t('settings.mcp.claudeAiDesc') }}</p>
          <ol class="steps">
            <li v-for="i in 4" :key="i">{{ $t(`settings.mcp.claudeAiStep${i}`) }}</li>
          </ol>
          <div class="copy-row">
            <code class="code-inline">{{ serverUrl }}</code>
            <button class="btn btn-secondary btn-copy" @click="copy(serverUrl, 'url-ai')">
              {{ copied === 'url-ai' ? $t('settings.mcp.copied') : $t('settings.mcp.copy') }}
            </button>
          </div>
          <p class="hint">{{ $t('settings.mcp.claudeAiMobile') }}</p>

          <h3>Claude Code</h3>
          <p v-if="!newToken" class="section-desc">{{ $t('settings.mcp.replaceToken') }}</p>
          <p class="section-desc">{{ $t('settings.mcp.claudeCodeDesc') }}</p>
          <div class="code-block">
            <pre>{{ claudeCodeCommand }}</pre>
            <button class="btn btn-secondary btn-copy" @click="copy(claudeCodeCommand, 'code')">
              {{ copied === 'code' ? $t('settings.mcp.copied') : $t('settings.mcp.copy') }}
            </button>
          </div>
          <p class="hint">{{ $t('settings.mcp.claudeCodeVerify') }}</p>

          <h3>Claude Desktop</h3>
          <p class="section-desc">{{ $t('settings.mcp.claudeDesktopDesc') }}</p>
          <div class="code-block">
            <pre>{{ claudeDesktopConfig }}</pre>
            <button class="btn btn-secondary btn-copy" @click="copy(claudeDesktopConfig, 'desktop')">
              {{ copied === 'desktop' ? $t('settings.mcp.copied') : $t('settings.mcp.copy') }}
            </button>
          </div>
          <p class="hint">{{ $t('settings.mcp.claudeDesktopRestart') }}</p>

          <h3>{{ $t('settings.mcp.otherClients') }}</h3>
          <p class="section-desc">{{ $t('settings.mcp.otherClientsDesc') }}</p>

          <h3>{{ $t('settings.mcp.examples') }}</h3>
          <ul class="examples">
            <li v-for="i in 4" :key="i">{{ $t(`settings.mcp.example${i}`) }}</li>
          </ul>

          <h3>{{ $t('settings.mcp.security') }}</h3>
          <p class="section-desc">{{ $t('settings.mcp.securityDesc') }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const { t, locale } = useI18n()

interface Token {
  id: number
  name: string | null
  lastUsedAt: string | null
  expiresAt: string
  createdAt: string
  isRevoked: boolean
  canWrite: boolean
  isOauth: boolean
}

// The browser origin is the public one, also behind a reverse proxy
const origin = ref(useRequestURL({ xForwardedHost: true, xForwardedProto: true }).origin)
const serverUrl = computed(() => `${origin.value}/api/mcp`)

const tokens = ref<Token[]>([])
const loadingTokens = ref(true)
const togglingToken = ref<number | null>(null)
const deletingToken = ref<number | null>(null)

const form = ref({ name: 'Claude', expiresInDays: 90, canWrite: false })
const creating = ref(false)
const createError = ref('')
// Shown once, right after creation: the server keeps only its hash
const newToken = ref('')

const copied = ref<string | null>(null)

const tokenForSnippets = computed(() => newToken.value || 'YOUR_TOKEN')

const claudeCodeCommand = computed(() =>
  `claude mcp add --transport http financistodrive ${serverUrl.value} --header "Authorization: Bearer ${tokenForSnippets.value}"`
)

const claudeDesktopConfig = computed(() => JSON.stringify({
  mcpServers: {
    financistodrive: {
      command: 'npx',
      args: ['-y', 'mcp-remote', serverUrl.value, '--header', 'Authorization:${AUTH_HEADER}'],
      env: { AUTH_HEADER: `Bearer ${tokenForSnippets.value}` }
    }
  }
}, null, 2))

onMounted(() => {
  origin.value = window.location.origin
  loadTokens()
})

async function loadTokens() {
  loadingTokens.value = true
  try {
    const data = await $fetch<{ tokens: Token[] }>('/api/tokens')
    tokens.value = data.tokens
  } catch {
    // Tokens loading failed silently
  } finally {
    loadingTokens.value = false
  }
}

async function createToken() {
  creating.value = true
  createError.value = ''
  newToken.value = ''
  try {
    const data = await $fetch<{ token: string }>('/api/tokens', {
      method: 'POST',
      body: form.value
    })
    newToken.value = data.token
    await loadTokens()
  } catch (error: any) {
    createError.value = error.data?.message || t('settings.mcp.createError')
  } finally {
    creating.value = false
  }
}

async function toggleToken(id: number) {
  togglingToken.value = id
  try {
    await $fetch(`/api/tokens/${id}/toggle`, { method: 'POST' })
    await loadTokens()
  } catch {
    // Error handling
  } finally {
    togglingToken.value = null
  }
}

async function deleteToken(id: number) {
  if (!confirm(t('settings.deleteTokenConfirm'))) return

  deletingToken.value = id
  try {
    await $fetch(`/api/tokens/${id}`, { method: 'DELETE' })
    tokens.value = tokens.value.filter(t => t.id !== id)
  } catch {
    // Error handling
  } finally {
    deletingToken.value = null
  }
}

async function copy(text: string, key: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = key
    setTimeout(() => {
      if (copied.value === key) copied.value = null
    }, 2000)
  } catch {
    // Clipboard unavailable (e.g. not a secure context): the text stays selectable
  }
}

function isExpired(token: Token): boolean {
  return new Date(token.expiresAt).getTime() < Date.now()
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  const localeMap: Record<string, string> = { it: 'it-IT', en: 'en-US' }
  return new Date(dateStr).toLocaleDateString(localeMap[locale.value] || 'it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}
</script>

<style scoped>
.settings-subpage { min-height: 100vh; }

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

.section { margin-bottom: var(--space-xl); }

.section-title {
  font-size: 1rem; font-weight: 600; margin-bottom: var(--space-md);
  color: var(--color-text-secondary);
}

.section-card { padding: var(--space-lg); }

.section-desc {
  font-size: 0.9rem; color: var(--color-text-secondary);
  line-height: 1.5; margin-bottom: var(--space-md);
}

.hint {
  display: block;
  font-size: 0.8rem; color: var(--color-text-muted);
  line-height: 1.4;
}

.field-label {
  display: block;
  font-weight: 500; font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-xs);
}

.copy-row {
  display: flex; align-items: center; gap: var(--space-sm);
}

.code-inline {
  flex: 1; min-width: 0;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-elevated); border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  overflow-wrap: anywhere;
  user-select: all;
}

.btn-copy { flex-shrink: 0; }

.token-form {
  display: flex; flex-direction: column; gap: var(--space-md);
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-md);
}

.checkbox-row {
  display: flex; align-items: flex-start; gap: var(--space-sm);
  cursor: pointer;
}
.checkbox-row input { margin-top: 3px; }
.checkbox-row > span { display: flex; flex-direction: column; gap: 2px; font-size: 0.9rem; }

.form-actions { display: flex; justify-content: flex-end; }

.alert { margin-top: var(--space-md); }

.new-token { margin-top: var(--space-md); }
.new-token .alert { margin-bottom: var(--space-sm); }

.loading-state { display: flex; justify-content: center; padding: var(--space-xl); }

.empty-tokens { text-align: center; padding: var(--space-lg); color: var(--color-text-muted); }

.tokens-list { display: flex; flex-direction: column; gap: var(--space-sm); }

.token-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: var(--space-md) var(--space-lg);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-xl); border: 1px solid var(--color-border);
}
.token-item.revoked { opacity: 0.6; }

.token-info { flex: 1; min-width: 0; }

.token-name {
  display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap;
  font-weight: 600; font-size: 0.95rem; margin-bottom: var(--space-xs);
}

.token-scope {
  font-size: 0.7rem; font-weight: 600;
  padding: 1px var(--space-sm); border-radius: var(--radius-sm);
  background: var(--color-bg-elevated); border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}
.token-scope.write {
  background: var(--color-warning-bg); border-color: var(--color-warning-border);
  color: var(--color-warning);
}

.token-meta {
  font-size: 0.75rem; color: var(--color-text-muted);
  display: flex; flex-wrap: wrap; gap: var(--space-xs);
}

.token-status { font-size: 0.75rem; font-weight: 500; margin-top: var(--space-xs); }
.token-status.active { color: var(--color-success); }
.token-status.revoked { color: var(--color-error); }

.token-actions {
  display: flex; gap: var(--space-sm); flex-shrink: 0; margin-left: var(--space-md);
}

.btn-sm {
  padding: var(--space-xs) var(--space-md);
  font-size: 0.8rem; border-radius: var(--radius-sm); border: none;
  color: var(--color-text-on-accent); cursor: pointer;
  font-family: inherit; font-weight: 500; transition: opacity 0.2s;
}
.btn-sm:hover { opacity: 0.85; }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-warning { background: linear-gradient(135deg, var(--color-warning), var(--color-warning-light)); }
.btn-success { background: linear-gradient(135deg, var(--color-success), var(--color-success-light)); }
.btn-danger { background: linear-gradient(135deg, var(--color-error), var(--color-error-light)); }

.instructions h3 {
  font-size: 0.95rem; font-weight: 600;
  margin: var(--space-lg) 0 var(--space-sm);
}
.instructions h3:first-of-type { margin-top: 0; }

.code-block {
  position: relative;
  display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}
.code-block pre {
  width: 100%; box-sizing: border-box;
  margin: 0; padding: var(--space-md);
  background: var(--color-bg-elevated); border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.8rem; line-height: 1.5;
  white-space: pre-wrap; overflow-wrap: anywhere;
}

.steps {
  margin: 0 0 var(--space-md); padding-left: var(--space-lg);
  font-size: 0.9rem; color: var(--color-text-secondary); line-height: 1.7;
}

.instructions .copy-row { margin-bottom: var(--space-sm); }

.examples {
  margin: 0; padding-left: var(--space-lg);
  font-size: 0.9rem; color: var(--color-text-secondary); line-height: 1.7;
}

.spinner {
  width: 16px; height: 16px;
  border: 2px solid var(--color-spinner-border); border-top-color: var(--color-spinner-active);
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 500px) {
  .token-item { flex-direction: column; align-items: flex-start; gap: var(--space-md); }
  .token-actions { width: 100%; margin-left: 0; }
  .token-actions .btn-sm { flex: 1; }
  .copy-row { flex-direction: column; align-items: stretch; }
}
</style>
