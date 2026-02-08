<template>
  <div class="settings-page">
    <h1 class="page-title">{{ $t('settings.title') }}</h1>

    <!-- Language Section -->
    <section class="settings-section">
      <h2>{{ $t('settings.language') }}</h2>
      <div class="glass-card">
        <div class="language-selector">
          <label for="language">{{ $t('settings.selectLanguage') }}</label>
          <select id="language" v-model="selectedLanguage" @change="handleLanguageChange" class="input-field"
            :disabled="savingLanguage">
            <option value="it">Italiano</option>
            <option value="en">English</option>
          </select>
          <div v-if="languageMessage" class="message" :class="languageMessage.type">
            {{ languageMessage.text }}
          </div>
        </div>
      </div>
    </section>

    <!-- Appearance Section -->
    <section class="settings-section">
      <h2>{{ $t('settings.appearance') }}</h2>
      <div class="glass-card">
        <div class="language-selector"> <!-- Using same class for styling -->
          <label for="theme">{{ $t('settings.theme') }}</label>
          <select id="theme" v-model="selectedTheme" @change="handleThemeChange" class="input-field"
            :disabled="savingTheme">
            <option value="system">{{ $t('settings.themeSystem') }}</option>
            <option value="light">{{ $t('settings.themeLight') }}</option>
            <option value="dark">{{ $t('settings.themeDark') }}</option>
          </select>
          <div v-if="themeMessage" class="message" :class="themeMessage.type">
            {{ themeMessage.text }}
          </div>
        </div>
      </div>
    </section>

    <!-- Push Notifications Section -->
    <section class="settings-section">
      <h2>{{ $t('settings.pushNotifications') }}</h2>
      <div class="glass-card">
        <div class="push-section">
          <!-- iOS: needs to install PWA first (check before isSupported, because PushManager doesn't exist on iOS Safari outside standalone) -->
          <template v-if="pushState.needsInstall.value">
            <p class="push-status-text muted">{{ $t('settings.pushNeedsInstall') }}</p>
          </template>

          <!-- Not supported -->
          <template v-else-if="!pushState.isSupported.value">
            <p class="push-status-text muted">{{ $t('settings.pushNotSupported') }}</p>
          </template>

          <!-- Permission denied by user -->
          <template v-else-if="pushState.permission.value === 'denied'">
            <p class="push-status-text muted">{{ $t('settings.pushDenied') }}</p>
          </template>

          <!-- Subscribed: show active status + disable button -->
          <template v-else-if="pushState.isSubscribed.value">
            <div class="push-row">
              <span class="push-status-badge active">{{ $t('settings.pushStatusActive') }}</span>
              <button class="btn btn-sm btn-warning" @click="handleDisablePush" :disabled="pushState.loading.value">
                <span v-if="pushState.loading.value" class="spinner"></span>
                {{ $t('settings.pushDisable') }}
              </button>
            </div>
          </template>

          <!-- Not subscribed: show enable button -->
          <template v-else>
            <div class="push-row">
              <span class="push-status-badge inactive">{{ $t('settings.pushStatusInactive') }}</span>
              <button class="btn btn-primary" @click="handleEnablePush" :disabled="pushState.loading.value">
                <span v-if="pushState.loading.value" class="spinner"></span>
                {{ $t('settings.pushEnable') }}
              </button>
            </div>
          </template>

          <div v-if="pushMessage" class="message" :class="pushMessage.type">
            {{ pushMessage.text }}
          </div>
        </div>
      </div>
    </section>

    <!-- Profile Section -->
    <section class="settings-section">
      <h2>{{ $t('settings.profile') }}</h2>
      <div class="glass-card">
        <form @submit.prevent="saveProfile" class="settings-form">
          <div class="form-row">
            <div class="input-group">
              <label for="name">{{ $t('settings.name') }}</label>
              <input id="name" v-model="profile.name" type="text" class="input-field"
                :placeholder="$t('settings.namePlaceholder')">
            </div>
            <div class="input-group">
              <label for="surname">{{ $t('settings.surname') }}</label>
              <input id="surname" v-model="profile.surname" type="text" class="input-field"
                :placeholder="$t('settings.surnamePlaceholder')">
            </div>
          </div>
          <div class="form-row">
            <div class="input-group">
              <label for="username">{{ $t('settings.username') }}</label>
              <input id="username" v-model="profile.username" type="text" class="input-field" disabled>
            </div>
            <div class="input-group">
              <label for="email">{{ $t('settings.email') }}</label>
              <input id="email" v-model="profile.email" type="email" class="input-field"
                :placeholder="$t('settings.emailPlaceholder')">
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" :disabled="savingProfile">
              <span v-if="savingProfile" class="spinner"></span>
              {{ $t('settings.saveProfile') }}
            </button>
          </div>
          <div v-if="profileMessage" class="message" :class="profileMessage.type">
            {{ profileMessage.text }}
          </div>
        </form>
      </div>
    </section>

    <!-- Password Section -->
    <section class="settings-section">
      <h2>{{ $t('settings.changePassword') }}</h2>
      <div class="glass-card">
        <form @submit.prevent="changePassword" class="settings-form">
          <div class="form-row">
            <div class="input-group">
              <label for="currentPassword">{{ $t('settings.currentPassword') }}</label>
              <input id="currentPassword" v-model="passwords.current" type="password" class="input-field" required>
            </div>
          </div>
          <div class="form-row">
            <div class="input-group">
              <label for="newPassword">{{ $t('settings.newPassword') }}</label>
              <input id="newPassword" v-model="passwords.new" type="password" class="input-field" required
                minlength="6">
            </div>
            <div class="input-group">
              <label for="confirmPassword">{{ $t('settings.confirmPassword') }}</label>
              <input id="confirmPassword" v-model="passwords.confirm" type="password" class="input-field" required>
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" :disabled="changingPassword">
              <span v-if="changingPassword" class="spinner"></span>
              {{ $t('settings.changePassword') }}
            </button>
          </div>
          <div v-if="passwordMessage" class="message" :class="passwordMessage.type">
            {{ passwordMessage.text }}
          </div>
        </form>
      </div>
    </section>

    <!-- API Tokens Section -->
    <section class="settings-section">
      <h2>{{ $t('settings.apiTokens') }}</h2>
      <div class="glass-card">
        <div v-if="loadingTokens" class="loading-state">
          <div class="spinner"></div>
        </div>
        <div v-else-if="tokens.length === 0" class="empty-tokens">
          <p>{{ $t('settings.noTokens') }}</p>
        </div>
        <div v-else class="tokens-list">
          <div v-for="token in tokens" :key="token.id" class="token-item" :class="{ revoked: token.isRevoked }">
            <div class="token-info">
              <div class="token-name">{{ token.name || $t('settings.unnamedToken') }}</div>
              <div class="token-meta">
                <span>{{ $t('settings.created') }}: {{ formatDate(token.createdAt) }}</span>
                <span v-if="token.lastUsedAt">• {{ $t('settings.lastUsed') }}: {{ formatDate(token.lastUsedAt) }}</span>
                <span>• {{ $t('settings.expires') }}: {{ formatDate(token.expiresAt) }}</span>
              </div>
              <div v-if="token.isRevoked" class="token-status revoked">{{ $t('settings.disabled') }}</div>
              <div v-else class="token-status active">{{ $t('common.active') }}</div>
            </div>
            <div class="token-actions">
              <button class="btn btn-sm" :class="token.isRevoked ? 'btn-success' : 'btn-warning'"
                @click="toggleToken(token.id)" :disabled="togglingToken === token.id">
                {{ token.isRevoked ? $t('common.activate') : $t('common.deactivate') }}
              </button>
              <button class="btn btn-sm btn-danger" @click="deleteToken(token.id)"
                :disabled="deletingToken === token.id">
                {{ $t('common.delete') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const { t } = useI18n()
const { locale, saveLanguage } = useLanguage()

// Push notifications
const pushState = usePushNotifications()
const pushMessage = ref<Message | null>(null)

async function handleEnablePush() {
  pushMessage.value = null
  const success = await pushState.subscribe()
  if (success) {
    pushMessage.value = { type: 'success', text: t('settings.pushEnabled') }
  } else if (pushState.permission.value === 'denied') {
    pushMessage.value = { type: 'error', text: t('settings.pushDenied') }
  } else {
    pushMessage.value = { type: 'error', text: t('settings.pushError') }
  }
}

async function handleDisablePush() {
  pushMessage.value = null
  const success = await pushState.unsubscribe()
  if (success) {
    pushMessage.value = { type: 'success', text: t('settings.pushDisabled') }
  } else {
    pushMessage.value = { type: 'error', text: t('settings.pushError') }
  }
}

interface Profile {
  name: string | null
  surname: string | null
  username: string
  email: string | null
}

interface Token {
  id: number
  name: string | null
  lastUsedAt: string | null
  expiresAt: string
  createdAt: string
  isRevoked: boolean
}

interface Message {
  type: 'success' | 'error'
  text: string
}

const profile = ref<Profile>({
  name: null,
  surname: null,
  username: '',
  email: null
})

const passwords = ref({
  current: '',
  new: '',
  confirm: ''
})

const tokens = ref<Token[]>([])

const savingProfile = ref(false)
const changingPassword = ref(false)
const loadingTokens = ref(true)
const togglingToken = ref<number | null>(null)
const deletingToken = ref<number | null>(null)
const savingLanguage = ref(false)

const profileMessage = ref<Message | null>(null)
const passwordMessage = ref<Message | null>(null)
const languageMessage = ref<Message | null>(null)

const selectedLanguage = ref(locale.value)

// Load profile on mount
onMounted(async () => {
  selectedLanguage.value = locale.value
  selectedTheme.value = theme.value
  pushState.checkSupport()
  await Promise.all([loadProfile(), loadTokens(), pushState.checkSubscription()])
})

// Watch locale changes
watch(locale, (newLocale) => {
  selectedLanguage.value = newLocale
})

async function handleLanguageChange() {
  savingLanguage.value = true
  languageMessage.value = null

  const success = await saveLanguage(selectedLanguage.value)

  if (success) {
    languageMessage.value = { type: 'success', text: t('settings.languageSaved') }
  } else {
    languageMessage.value = { type: 'error', text: t('settings.languageSaveError') }
    selectedLanguage.value = locale.value
  }

  savingLanguage.value = false
}

const { theme, saveTheme } = useTheme()
const selectedTheme = ref(theme.value)
const savingTheme = ref(false)
const themeMessage = ref<Message | null>(null)

watch(theme, (newTheme) => {
  selectedTheme.value = newTheme
})

async function handleThemeChange() {
  savingTheme.value = true
  themeMessage.value = null

  const success = await saveTheme(selectedTheme.value)

  if (success) {
    themeMessage.value = { type: 'success', text: t('settings.themeSaved') }
  } else {
    themeMessage.value = { type: 'error', text: t('settings.themeSaveError') }
    selectedTheme.value = theme.value
  }

  savingTheme.value = false
}

async function loadProfile() {
  try {
    const data = await $fetch<Profile>('/api/users/profile')
    profile.value = data
  } catch {
    profileMessage.value = { type: 'error', text: t('settings.profileLoadError') }
  }
}

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

async function saveProfile() {
  savingProfile.value = true
  profileMessage.value = null

  try {
    await $fetch('/api/users/profile', {
      method: 'PUT',
      body: {
        name: profile.value.name,
        surname: profile.value.surname,
        email: profile.value.email
      }
    })
    profileMessage.value = { type: 'success', text: t('settings.profileSaved') }
  } catch (error: any) {
    profileMessage.value = { type: 'error', text: error.data?.message || t('settings.profileSaveError') }
  } finally {
    savingProfile.value = false
  }
}

async function changePassword() {
  if (passwords.value.new !== passwords.value.confirm) {
    passwordMessage.value = { type: 'error', text: t('settings.passwordMismatch') }
    return
  }

  changingPassword.value = true
  passwordMessage.value = null

  try {
    await $fetch('/api/users/password', {
      method: 'PUT',
      body: {
        currentPassword: passwords.value.current,
        newPassword: passwords.value.new
      }
    })
    passwordMessage.value = { type: 'success', text: t('settings.passwordChanged') }
    passwords.value = { current: '', new: '', confirm: '' }
  } catch (error: any) {
    passwordMessage.value = { type: 'error', text: error.data?.message || t('settings.passwordChangeError') }
  } finally {
    changingPassword.value = false
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
.settings-page {
  padding: var(--space-lg);
  max-width: 800px;
  margin: 0 auto;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: var(--space-xl);
}

.settings-section {
  margin-bottom: var(--space-xl);
}

.settings-section h2 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: var(--space-md);
  color: var(--color-text-secondary);
}

.settings-section .glass-card {
  padding: var(--space-xl);
}

.language-selector {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.language-selector label {
  font-weight: 500;
  color: var(--color-text-secondary);
}

.language-selector select {
  max-width: 300px;
}

.push-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.push-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}

.push-status-text.muted {
  color: var(--color-text-muted);
  font-size: 0.9rem;
  margin: 0;
}

.push-status-badge {
  font-size: 0.85rem;
  font-weight: 600;
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-sm);
}

.push-status-badge.active {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.push-status-badge.inactive {
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-md);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-sm);
}

.message {
  padding: var(--space-md);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
}

.message.success {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.message.error {
  background: var(--color-error-bg);
  color: var(--color-error);
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: var(--space-xl);
}

.empty-tokens {
  text-align: center;
  padding: var(--space-lg);
  color: var(--color-text-muted);
}

.tokens-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.token-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md) var(--space-lg);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  transition: transform 0.2s, box-shadow 0.2s;
}

.token-item:hover {
  transform: translateX(4px);
  box-shadow: var(--shadow-lg);
}

.token-item.revoked {
  opacity: 0.6;
}

.token-info {
  flex: 1;
  min-width: 0;
}

.token-name {
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: var(--space-xs);
}

.token-meta {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.token-status {
  font-size: 0.75rem;
  font-weight: 500;
  margin-top: var(--space-xs);
}

.token-status.active {
  color: var(--color-success);
}

.token-status.revoked {
  color: var(--color-error);
}

.token-actions {
  display: flex;
  gap: var(--space-sm);
  flex-shrink: 0;
  margin-left: var(--space-md);
}

.btn-sm {
  padding: var(--space-xs) var(--space-md);
  font-size: 0.8rem;
  border-radius: var(--radius-sm);
  border: none;
  color: white;
  cursor: pointer;
  font-family: inherit;
  font-weight: 500;
  transition: opacity 0.2s;
}

.btn-sm:hover {
  opacity: 0.85;
}

.btn-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-warning {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.btn-success {
  background: linear-gradient(135deg, #10b981, #059669);
}

.btn-danger {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-spinner-border);
  border-top-color: var(--color-spinner-active);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: var(--space-sm);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 500px) {
  .token-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-md);
  }

  .token-actions {
    width: 100%;
    margin-left: 0;
  }

  .token-actions .btn {
    flex: 1;
  }
}
</style>
