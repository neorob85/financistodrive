<template>
    <div class="admin-subpage">
        <header class="subpage-header">
            <NuxtLink to="/admin" class="back-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
            </NuxtLink>
            <h1>{{ $t('admin.usersManagement') }}</h1>
            <div class="header-spacer"></div>
        </header>

        <div class="page-content">
            <!-- Loading state -->
            <div v-if="loading" class="loading-state">
                <div class="spinner-lg"></div>
            </div>

            <!-- Empty state -->
            <div v-else-if="users.length === 0" class="empty-state">
                <h2>{{ $t('admin.noUsers') }}</h2>
            </div>

            <!-- Users list -->
            <div v-else class="users-list">
                <div v-for="user in users" :key="user.id" class="user-card"
                    :class="{ inactive: !user.isActive }" @click="editUser(user)">
                    <div class="user-avatar-small">{{ user.username.charAt(0).toUpperCase() }}</div>
                    <div class="user-info">
                        <span class="user-username">{{ user.username }}</span>
                        <span v-if="user.name || user.surname" class="user-fullname">
                            {{ [user.name, user.surname].filter(Boolean).join(' ') }}
                        </span>
                    </div>
                    <div class="user-badges">
                        <span v-if="user.isAdmin" class="badge badge-admin">Admin</span>
                        <span v-if="!user.isActive" class="badge badge-inactive">{{ $t('common.inactive') }}</span>
                    </div>
                </div>
            </div>

            <!-- FAB Button -->
            <button class="fab" @click="openCreateModal">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            </button>
        </div>

        <!-- Modal -->
        <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
            <div class="modal glass-card">
                <div class="modal-header">
                    <h2>{{ editingId ? $t('admin.editUser') : $t('admin.newUser') }}</h2>
                    <button class="close-btn" @click="closeModal">&times;</button>
                </div>
                <form @submit.prevent="saveUser" class="modal-form">
                    <div class="form-row">
                        <div class="input-group">
                            <label for="username">{{ $t('settings.username') }} *</label>
                            <input id="username" v-model="form.username" type="text" class="input-field" required>
                        </div>
                        <div class="input-group">
                            <label for="email">{{ $t('settings.email') }}</label>
                            <input id="email" v-model="form.email" type="email" class="input-field">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="input-group">
                            <label for="name">{{ $t('settings.name') }}</label>
                            <input id="name" v-model="form.name" type="text" class="input-field">
                        </div>
                        <div class="input-group">
                            <label for="surname">{{ $t('settings.surname') }}</label>
                            <input id="surname" v-model="form.surname" type="text" class="input-field">
                        </div>
                    </div>

                    <div class="input-group">
                        <label for="password">{{ editingId ? $t('admin.passwordHint') : $t('login.password') + ' *' }}</label>
                        <input id="password" v-model="form.password" type="password" class="input-field"
                            :required="!editingId" minlength="6">
                    </div>

                    <div class="checkbox-row">
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="form.isActive">
                            <span>{{ $t('common.active') }}</span>
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="form.isAdmin">
                            <span>{{ $t('admin.administrator') }}</span>
                        </label>
                    </div>

                    <div v-if="formError" class="form-error">{{ formError }}</div>

                    <div class="modal-actions">
                        <button v-if="editingId" type="button" class="btn btn-danger" @click="confirmDelete"
                            :disabled="saving">
                            {{ $t('common.delete') }}
                        </button>
                        <div class="actions-right">
                            <button type="button" class="btn btn-secondary" @click="closeModal">{{ $t('common.cancel') }}</button>
                            <button type="submit" class="btn btn-primary" :disabled="saving">
                                <span v-if="saving" class="spinner"></span>
                                {{ editingId ? $t('common.saveChanges') : $t('admin.createUser') }}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>

        <!-- Delete confirmation modal -->
        <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
            <div class="modal glass-card modal-sm">
                <div class="modal-header">
                    <h2>{{ $t('admin.deleteConfirm') }}</h2>
                    <button class="close-btn" @click="showDeleteConfirm = false">&times;</button>
                </div>
                <p class="confirm-text">{{ $t('admin.deleteUserConfirm') }} <strong>{{ form.username }}</strong>?</p>
                <div v-if="deleteError" class="form-error">{{ deleteError }}</div>
                <div class="modal-actions">
                    <div class="actions-right">
                        <button class="btn btn-secondary" @click="showDeleteConfirm = false">{{ $t('common.cancel') }}</button>
                        <button class="btn btn-danger" @click="deleteUser" :disabled="deleting">
                            <span v-if="deleting" class="spinner"></span>
                            {{ $t('common.delete') }}
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

interface User {
    id: number
    name: string | null
    surname: string | null
    username: string
    email: string | null
    isActive: boolean
    isAdmin: boolean
    lastLogin: string | null
}

const users = ref<User[]>([])
const loading = ref(true)
const showModal = ref(false)
const showDeleteConfirm = ref(false)
const saving = ref(false)
const deleting = ref(false)
const formError = ref('')
const deleteError = ref('')
const editingId = ref<number | null>(null)

const form = ref({
    username: '',
    email: '',
    name: '',
    surname: '',
    password: '',
    isActive: true,
    isAdmin: false
})

async function loadUsers() {
    loading.value = true
    try {
        const data = await $fetch<{ users: User[] }>('/api/admin/users')
        users.value = data.users
    } catch (error) {
        console.error('Failed to load users:', error)
    } finally {
        loading.value = false
    }
}

function openCreateModal() {
    editingId.value = null
    form.value = { username: '', email: '', name: '', surname: '', password: '', isActive: true, isAdmin: false }
    formError.value = ''
    showModal.value = true
}

function editUser(user: User) {
    editingId.value = user.id
    form.value = {
        username: user.username,
        email: user.email || '',
        name: user.name || '',
        surname: user.surname || '',
        password: '',
        isActive: user.isActive,
        isAdmin: user.isAdmin
    }
    formError.value = ''
    showModal.value = true
}

function closeModal() {
    showModal.value = false
    editingId.value = null
}

async function saveUser() {
    if (!form.value.username) {
        formError.value = t('admin.usernameRequired')
        return
    }

    if (!editingId.value && !form.value.password) {
        formError.value = t('admin.passwordRequired')
        return
    }

    if (form.value.password && form.value.password.length < 6) {
        formError.value = t('admin.passwordLength')
        return
    }

    saving.value = true
    formError.value = ''

    try {
        const body: any = {
            username: form.value.username,
            email: form.value.email || null,
            name: form.value.name || null,
            surname: form.value.surname || null,
            isActive: form.value.isActive,
            isAdmin: form.value.isAdmin
        }

        if (form.value.password) {
            body.password = form.value.password
        }

        if (editingId.value) {
            await $fetch(`/api/admin/users/${editingId.value}`, { method: 'PUT', body })
        } else {
            await $fetch('/api/admin/users', { method: 'POST', body })
        }

        closeModal()
        await loadUsers()
    } catch (error: any) {
        formError.value = error.data?.message || t('common.saveError')
    } finally {
        saving.value = false
    }
}

function confirmDelete() {
    deleteError.value = ''
    showDeleteConfirm.value = true
}

async function deleteUser() {
    if (!editingId.value) return

    deleting.value = true
    deleteError.value = ''

    try {
        await $fetch(`/api/admin/users/${editingId.value}`, { method: 'DELETE' })
        showDeleteConfirm.value = false
        closeModal()
        await loadUsers()
    } catch (error: any) {
        deleteError.value = error.data?.message || t('admin.deleteError')
    } finally {
        deleting.value = false
    }
}

onMounted(async () => {
    await loadUsers()
})
</script>

<style scoped>
.admin-subpage {
    min-height: 100vh;
}

.subpage-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) var(--space-lg);
    background: var(--color-bg-elevated);
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    z-index: 10;
}

.subpage-header h1 {
    font-size: 1.1rem;
    font-weight: 600;
}

.back-btn {
    color: var(--color-text-primary);
    padding: var(--space-xs);
}

.header-spacer {
    width: 32px;
}

.page-content {
    padding: var(--space-lg);
    max-width: 800px;
    margin: 0 auto;
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

.empty-state h2 {
    font-size: 1.25rem;
    color: var(--color-text-primary);
}

/* Users list */
.users-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.user-card {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: var(--color-bg-card);
    backdrop-filter: blur(20px);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
}

.user-card:hover {
    transform: translateX(4px);
    box-shadow: var(--shadow-lg);
}

.user-card.inactive {
    opacity: 0.6;
}

.user-avatar-small {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-accent);
    border-radius: 50%;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text-on-accent);
    flex-shrink: 0;
}

.user-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.user-username {
    font-weight: 600;
    font-size: 0.95rem;
}

.user-fullname {
    font-size: 0.8rem;
    color: var(--color-text-muted);
}

.user-badges {
    display: flex;
    gap: var(--space-xs);
    flex-shrink: 0;
}

.badge {
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    font-size: 0.7rem;
    font-weight: 500;
}

.badge-admin {
    background: var(--color-accent-bg);
    color: var(--color-accent);
}

.badge-inactive {
    background: var(--color-error-bg);
    color: var(--color-error);
}

/* FAB */
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
    z-index: 50;
}

.fab:hover {
    transform: scale(1.1);
    box-shadow: var(--shadow-glow);
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
    max-width: 500px;
    padding: var(--space-xl);
    max-height: 90vh;
    overflow-y: auto;
}

.modal-sm {
    max-width: 400px;
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
}

.modal-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
}

.form-row {
    display: flex;
    gap: var(--space-md);
}

.form-row .input-group {
    flex: 1;
}

.input-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
}

.input-group label {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    font-weight: 500;
}

.checkbox-row {
    display: flex;
    gap: var(--space-lg);
    padding: var(--space-sm) 0;
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    cursor: pointer;
    font-size: 0.9rem;
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

.confirm-text {
    color: var(--color-text-secondary);
    font-size: 0.95rem;
    margin-bottom: var(--space-lg);
}

.modal-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--space-md);
}

.actions-right {
    display: flex;
    gap: var(--space-md);
    margin-left: auto;
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
    font-family: inherit;
    font-size: 0.9rem;
}

.btn-primary {
    background: linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary));
    border: none;
    color: var(--color-text-on-accent);
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

.btn-danger {
    background: var(--color-error-bg);
    border: 1px solid var(--color-error);
    color: var(--color-error);
}

.btn-danger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.spinner-lg {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

.spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-spinner-border);
    border-top-color: var(--color-spinner-active);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

@media (max-width: 500px) {
    .form-row {
        flex-direction: column;
    }
}
</style>
