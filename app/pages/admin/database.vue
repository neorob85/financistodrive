<template>
    <div class="admin-subpage">
        <header class="subpage-header">
            <NuxtLink to="/admin" class="back-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
            </NuxtLink>
            <h1>{{ $t('admin.databaseManagement') }}</h1>
            <div class="header-spacer"></div>
        </header>

        <div class="page-content">
            <div v-if="loading" class="loading-state">
                <div class="spinner-lg"></div>
            </div>

            <template v-else>
                <!-- Database Connection Config -->
                <section class="section">
                    <h2 class="section-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <ellipse cx="12" cy="5" rx="9" ry="3" />
                            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                        </svg>
                        {{ $t('admin.dbConnection') }}
                    </h2>
                    <div class="glass-card section-card">
                        <form @submit.prevent="saveConfig" class="db-form">
                            <div class="form-grid">
                                <div class="input-group full-width">
                                    <label for="host">{{ $t('admin.host') }}</label>
                                    <input id="host" v-model="form.host" type="text" class="input-field"
                                        placeholder="es. localhost o 192.168.1.100" required>
                                </div>
                                <div class="input-group">
                                    <label for="port">{{ $t('admin.port') }}</label>
                                    <input id="port" v-model="form.port" type="number" class="input-field"
                                        placeholder="3306" required>
                                </div>
                                <div class="input-group">
                                    <label for="user">{{ $t('settings.username') }}</label>
                                    <input id="user" v-model="form.user" type="text" class="input-field"
                                        placeholder="root" required>
                                </div>
                                <div class="input-group full-width">
                                    <label for="password">{{ $t('settings.currentPassword') }}</label>
                                    <input id="password" v-model="form.password" type="password" class="input-field"
                                        placeholder="••••••••">
                                </div>
                            </div>

                            <div v-if="configMessage" :class="['alert', configMessage.type === 'success' ? 'alert-success' : 'alert-error']">
                                {{ configMessage.text }}
                            </div>

                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" :disabled="configLoading"
                                    @click="handleTestConnection">
                                    <span v-if="testing" class="spinner"></span>
                                    {{ $t('admin.testConnection') }}
                                </button>
                                <button type="submit" class="btn btn-primary" :disabled="configLoading">
                                    <span v-if="savingConfig" class="spinner"></span>
                                    {{ $t('admin.saveParams') }}
                                </button>
                            </div>
                        </form>
                    </div>
                </section>

                <!-- Backup & Restore -->
                <section class="section">
                    <h2 class="section-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        {{ $t('admin.backupRestore') }}
                    </h2>
                    <div class="glass-card section-card">
                        <p class="section-desc">
                            {{ $t('admin.backupRestoreDesc') }}
                        </p>

                        <div class="backup-row">
                            <div class="backup-info">
                                <strong>{{ $t('admin.fullBackup') }}</strong>
                                <span class="backup-hint">{{ $t('admin.fullBackupHint') }}</span>
                            </div>
                            <button class="btn btn-primary" @click="handleAdminBackup" :disabled="backingUp">
                                <span v-if="backingUp" class="spinner"></span>
                                {{ $t('admin.downloadFullBackup') }}
                            </button>
                        </div>

                        <div class="backup-row last">
                            <div class="backup-info">
                                <strong>{{ $t('admin.fullRestore') }}</strong>
                                <span class="backup-hint">{{ $t('admin.fullRestoreHint') }}</span>
                            </div>
                            <label class="btn btn-warning btn-file" :class="{ disabled: restoring }">
                                <span v-if="restoring" class="spinner"></span>
                                {{ $t('admin.uploadFullRestore') }}
                                <input type="file" accept=".zip" @change="handleAdminRestore" :disabled="restoring"
                                    style="display: none">
                            </label>
                        </div>

                        <div v-if="backupMessage"
                            :class="['alert', backupMessage.type === 'success' ? 'alert-success' : 'alert-error']">
                            {{ backupMessage.text }}
                        </div>
                    </div>
                </section>

                <!-- Database Reset -->
                <section class="section">
                    <h2 class="section-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        {{ $t('admin.resetDatabase') }}
                    </h2>
                    <div class="glass-card section-card danger-zone">
                        <p class="section-desc danger-text">
                            {{ $t('admin.resetDbWarning') }}
                            <strong>{{ $t('admin.dataLossWarning') }}</strong>
                        </p>
                        <div v-if="resetMessage" :class="['alert', resetMessage.type === 'success' ? 'alert-success' : 'alert-error']">
                            {{ resetMessage.text }}
                        </div>
                        <button class="btn btn-danger" :disabled="resettingDb" @click="confirmResetDb">
                            <span v-if="resettingDb" class="spinner"></span>
                            {{ $t('admin.deleteAndRecreate') }}
                        </button>
                    </div>
                </section>
            </template>
        </div>

        <!-- Database Reset Confirmation -->
        <div v-if="showDbResetConfirm" class="modal-overlay" @click.self="showDbResetConfirm = false">
            <div class="modal glass-card modal-sm">
                <div class="modal-header">
                    <h2>{{ $t('admin.resetDbConfirm') }}</h2>
                    <button class="close-btn" @click="showDbResetConfirm = false">&times;</button>
                </div>
                <p class="confirm-text danger-text">
                    {{ $t('admin.resetDbConfirmText') }}
                </p>
                <div class="input-group">
                    <label for="confirmText" v-html="$t('admin.typeDeleteToConfirm')"></label>
                    <input id="confirmText" v-model="confirmText" type="text" class="input-field"
                        placeholder="ELIMINA" autocomplete="off">
                </div>
                <div class="modal-actions">
                    <div class="actions-right">
                        <button class="btn btn-secondary" @click="showDbResetConfirm = false">{{ $t('common.cancel') }}</button>
                        <button class="btn btn-danger" @click="resetDatabase"
                            :disabled="resettingDb || confirmText !== 'ELIMINA'">
                            <span v-if="resettingDb" class="spinner"></span>
                            {{ $t('admin.deleteAll') }}
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
const router = useRouter()

interface DbConfig {
    host: string
    port: number
    user: string
    password: string
}

const loading = ref(true)
const testing = ref(false)
const savingConfig = ref(false)
const resettingDb = ref(false)
const backingUp = ref(false)
const restoring = ref(false)

const configMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const resetMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const backupMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

const showDbResetConfirm = ref(false)
const confirmText = ref('')

const form = ref<DbConfig>({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: ''
})

const configLoading = computed(() => testing.value || savingConfig.value)

async function loadConfig() {
    loading.value = true
    try {
        const data = await $fetch<{ config: DbConfig | null }>('/api/admin/database/config')
        if (data.config) {
            form.value = data.config
        }
    } catch (error) {
        console.error('Failed to load config:', error)
    } finally {
        loading.value = false
    }
}

async function handleTestConnection() {
    configMessage.value = null
    testing.value = true

    try {
        const result = await $fetch<{ success: boolean; error?: string }>('/api/admin/database/test', {
            method: 'POST',
            body: form.value
        })

        if (result.success) {
            configMessage.value = { type: 'success', text: t('admin.connectionSuccess') }
        } else {
            configMessage.value = { type: 'error', text: `${t('admin.connectionFailed')} ${result.error}` }
        }
    } catch (error: any) {
        configMessage.value = {
            type: 'error',
            text: error.data?.message || t('admin.connectionTestError')
        }
    } finally {
        testing.value = false
    }
}

async function saveConfig() {
    configMessage.value = null
    savingConfig.value = true

    try {
        await $fetch('/api/admin/database/config', {
            method: 'PUT',
            body: form.value
        })
        configMessage.value = { type: 'success', text: t('admin.paramsSaved') }
    } catch (error: any) {
        configMessage.value = {
            type: 'error',
            text: error.data?.message || t('admin.paramsSaveError')
        }
    } finally {
        savingConfig.value = false
    }
}

function confirmResetDb() {
    resetMessage.value = null
    confirmText.value = ''
    showDbResetConfirm.value = true
}

async function resetDatabase() {
    if (confirmText.value !== 'ELIMINA') return

    resettingDb.value = true
    resetMessage.value = null

    try {
        await $fetch('/api/admin/database/reset', { method: 'POST' })
        showDbResetConfirm.value = false
        router.push('/setup')
    } catch (error: any) {
        resetMessage.value = {
            type: 'error',
            text: error.data?.message || t('admin.dbResetError')
        }
    } finally {
        resettingDb.value = false
    }
}

async function handleAdminBackup() {
    backingUp.value = true
    backupMessage.value = null

    try {
        const response = await $fetch.raw('/api/admin/database/backup', { responseType: 'blob' })
        const blob = response._data as Blob
        const disposition = response.headers.get('content-disposition') || ''
        const match = disposition.match(/filename="?([^"]+)"?/)
        const filename = match ? match[1] : `admin_backup_${new Date().toISOString().slice(0, 10)}.zip`

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        backupMessage.value = { type: 'success', text: t('admin.backupSuccess') }
    } catch (error: any) {
        backupMessage.value = {
            type: 'error',
            text: error.data?.message || t('admin.backupError')
        }
    } finally {
        backingUp.value = false
    }
}

async function handleAdminRestore(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    input.value = ''

    if (!confirm(t('admin.restoreConfirm'))) return

    restoring.value = true
    backupMessage.value = null

    try {
        const formData = new FormData()
        formData.append('file', file)

        await $fetch('/api/admin/database/restore', {
            method: 'POST',
            body: formData
        })

        backupMessage.value = { type: 'success', text: t('admin.restoreSuccess') }
    } catch (error: any) {
        backupMessage.value = {
            type: 'error',
            text: error.data?.message || t('admin.restoreError')
        }
    } finally {
        restoring.value = false
    }
}

onMounted(() => loadConfig())
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

.loading-state { display: flex; justify-content: center; padding: var(--space-xl); }

.section { margin-bottom: var(--space-xl); }

.section-title {
    display: flex; align-items: center; gap: var(--space-sm);
    font-size: 1rem; font-weight: 600; margin-bottom: var(--space-md);
    color: var(--color-text-primary);
}

.section-card { padding: var(--space-lg); }

.section-desc {
    font-size: 0.9rem; color: var(--color-text-secondary);
    line-height: 1.5; margin-bottom: var(--space-lg);
}

.db-form { display: flex; flex-direction: column; gap: var(--space-lg); }

.form-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);
}
.full-width { grid-column: 1 / -1; }

.input-group { display: flex; flex-direction: column; gap: var(--space-xs); }
.input-group label { font-size: 0.85rem; color: var(--color-text-secondary); font-weight: 500; }

.form-actions { display: flex; gap: var(--space-md); }

.alert {
    padding: var(--space-sm) var(--space-md); border-radius: var(--radius-sm);
    font-size: 0.85rem;
}
.alert-success {
    background: var(--color-success-bg); color: var(--color-success);
    border: 1px solid var(--color-success);
}
.alert-error {
    background: var(--color-error-bg); color: var(--color-error);
    border: 1px solid var(--color-error-bg);
}

.danger-zone { border: 1px solid var(--color-error); }
.danger-text { color: var(--color-error) !important; }

.btn {
    padding: var(--space-sm) var(--space-lg); border-radius: var(--radius-sm);
    font-weight: 500; cursor: pointer; transition: all 0.2s;
    display: flex; align-items: center; gap: var(--space-sm);
    font-family: inherit; font-size: 0.9rem;
}
.btn-primary { background: linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary)); border: none; color: var(--color-text-on-accent); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary { background: var(--color-bg-elevated); border: 1px solid var(--color-border); color: var(--color-text-secondary); }
.btn-warning { background: var(--color-warning-bg); border: 1px solid var(--color-warning-border); color: var(--color-warning); }
.btn-warning:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-danger { background: var(--color-error-bg); border: 1px solid var(--color-error); color: var(--color-error); }
.btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }

.modal-overlay {
    position: fixed; inset: 0; background: var(--color-modal-overlay);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000; padding: var(--space-lg); backdrop-filter: blur(4px);
}
.modal { width: 100%; max-width: 500px; padding: var(--space-xl); max-height: 90vh; overflow-y: auto; }
.modal-sm { max-width: 450px; }

.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg); }
.modal-header h2 { font-size: 1.25rem; font-weight: 600; }
.close-btn { background: none; border: none; font-size: 1.5rem; color: var(--color-text-muted); cursor: pointer; }

.confirm-text { color: var(--color-text-secondary); font-size: 0.95rem; margin-bottom: var(--space-lg); }

.modal-actions { display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-md); }
.actions-right { display: flex; gap: var(--space-md); margin-left: auto; }

.spinner-lg { width: 40px; height: 40px; border: 3px solid var(--color-spinner-border); border-top-color: var(--color-spinner-active); border-radius: 50%; animation: spin 0.8s linear infinite; }
.spinner { width: 16px; height: 16px; border: 2px solid var(--color-spinner-border); border-top-color: var(--color-spinner-active); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.backup-row {
    display: flex; align-items: center; justify-content: space-between; gap: var(--space-md);
    padding-bottom: var(--space-md); margin-bottom: var(--space-md);
    border-bottom: 1px solid var(--color-border);
}
.backup-row.last { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
.backup-info { display: flex; flex-direction: column; gap: var(--space-xs); }
.backup-hint { font-size: 0.8rem; color: var(--color-text-muted); }
.btn-file { cursor: pointer; box-sizing: border-box; line-height: 1.4; white-space: nowrap; }
.btn-file.disabled { opacity: 0.6; pointer-events: none; }

@media (max-width: 500px) {
    .form-grid { grid-template-columns: 1fr; }
    .form-actions { flex-direction: column; }
    .backup-row { flex-direction: column; align-items: stretch; }
}
</style>
