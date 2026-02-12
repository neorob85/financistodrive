<template>
  <header class="top-bar">
    <div class="top-bar-content">
      <!-- Left group: Dashboard + User menu -->
      <div class="top-bar-left">
        <!-- Dashboard link -->
        <NuxtLink to="/" class="dashboard-link" :title="$t('nav.dashboard')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </NuxtLink>

        <!-- User menu trigger -->
        <div class="user-menu-container">
          <button class="user-trigger" @click="toggleUserMenu">
            <span class="user-avatar">{{ userInitial }}</span>
            <span class="user-name">{{ user?.username || $t('user.defaultName') }}</span>
            <svg class="chevron" :class="{ open: userMenuOpen }" width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          <!-- User dropdown menu -->
          <Transition name="dropdown">
            <div v-if="userMenuOpen" class="dropdown-menu">
              <NuxtLink to="/settings" class="menu-item" @click="closeUserMenu">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3" />
                  <path
                    d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
                {{ $t('nav.settings') }}
              </NuxtLink>
              <NuxtLink v-if="user?.isAdmin" to="/admin" class="menu-item" @click="closeUserMenu">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                  <path
                    d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
                {{ $t('nav.admin') }}
              </NuxtLink>
              <button class="menu-item logout" @click="handleLogout">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                {{ $t('nav.logout') }}
              </button>
            </div>
          </Transition>
        </div>
      </div>

      <!-- App title (center) -->
      <h1 class="app-title">{{ appName }}</h1>

      <!-- Right group: Entities menu -->
      <div class="top-bar-right">
        <NuxtLink to="/reports" class="dashboard-link" :title="$t('nav.reports')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 20V10M12 20V4M6 20v-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </NuxtLink>
        <div class="archives-menu-container">
          <button class="archives-trigger" @click="toggleArchivesMenu" :title="$t('nav.entities')">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <!-- Archives dropdown menu -->
          <Transition name="dropdown">
            <div v-if="archivesMenuOpen" class="dropdown-menu dropdown-menu-right">
              <NuxtLink to="/accounts" class="menu-item" @click="closeArchivesMenu">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
                {{ $t('nav.accounts') }}
              </NuxtLink>
              <NuxtLink to="/categories" class="menu-item" @click="closeArchivesMenu">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 3v18" />
                  <path d="M6 7h6" />
                  <rect x="12" y="5" width="8" height="4" rx="1" />
                  <path d="M6 12h10" />
                  <rect x="16" y="10" width="6" height="4" rx="1" />
                  <path d="M6 17h4" />
                  <rect x="10" y="15" width="10" height="4" rx="1" />
                </svg>
                {{ $t('nav.categories') }}
              </NuxtLink>
              <NuxtLink to="/payees" class="menu-item" @click="closeArchivesMenu">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" />
                  <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
                {{ $t('nav.payees') }}
              </NuxtLink>
              <NuxtLink to="/schedules" class="menu-item" @click="closeArchivesMenu">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {{ $t('nav.scheduled') }}
              </NuxtLink>
              <NuxtLink to="/vehicles" class="menu-item" @click="closeArchivesMenu">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 17h14v-6H5z" />
                  <path d="M5 11l2-5h10l2 5" />
                  <circle cx="7.5" cy="17" r="2" />
                  <circle cx="16.5" cy="17" r="2" />
                </svg>
                {{ $t('nav.vehicles') }}
              </NuxtLink>
              <NuxtLink to="/maintenance_types" class="menu-item" @click="closeArchivesMenu">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path
                    d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                </svg>
                {{ $t('nav.maintenance') }}
              </NuxtLink>
              <NuxtLink to="/alerts" class="menu-item" @click="closeArchivesMenu">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {{ $t('nav.alerts') }}
              </NuxtLink>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
interface User {
  id: number
  username: string
  name?: string
  surname?: string
  isAdmin: boolean
}

const props = defineProps<{
  user?: User | null
}>()

const config = useRuntimeConfig()
const appName = config.public.appName as string

const router = useRouter()
const userMenuOpen = ref(false)
const archivesMenuOpen = ref(false)

const userInitial = computed(() => {
  return props.user?.username?.charAt(0).toUpperCase() || 'U'
})

function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value
  archivesMenuOpen.value = false
}

function closeUserMenu() {
  userMenuOpen.value = false
}

function toggleArchivesMenu() {
  archivesMenuOpen.value = !archivesMenuOpen.value
  userMenuOpen.value = false
}

function closeArchivesMenu() {
  archivesMenuOpen.value = false
}

async function handleLogout() {
  closeUserMenu()
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // Continue anyway
  }
  router.push('/login')
}

// Close menus on outside click
onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
})

function handleOutsideClick(e: Event) {
  const userContainer = document.querySelector('.user-menu-container')
  const archivesContainer = document.querySelector('.archives-menu-container')

  if (userContainer && !userContainer.contains(e.target as Node)) {
    userMenuOpen.value = false
  }
  if (archivesContainer && !archivesContainer.contains(e.target as Node)) {
    archivesMenuOpen.value = false
  }
}
</script>

<style scoped>
.top-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: var(--color-bg-card);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--color-border);
  z-index: 100;
}

.top-bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 var(--space-lg);
  max-width: 100%;
}

.top-bar-left,
.top-bar-right {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex: 1;
}

.top-bar-right {
  justify-content: flex-end;
}

.user-menu-container,
.archives-menu-container {
  position: relative;
}

.dashboard-link,
.user-trigger,
.archives-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  height: 42px;
  padding: 0 var(--space-md);
  background: var(--color-bg-glass);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-text-primary);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.9rem;
  text-decoration: none;
  transition: all var(--transition-fast);
}

.dashboard-link:hover,
.user-trigger:hover,
.archives-trigger:hover {
  border-color: var(--color-border-focus);
  background: var(--color-bg-hover);
}

.user-avatar {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent);
  border-radius: 50%;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-on-accent);
}

.user-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron {
  transition: transform var(--transition-fast);
  opacity: 0.6;
}

.chevron.open {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 180px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  z-index: 200;
}

.dropdown-menu-right {
  left: auto;
  right: 0;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  width: 100%;
  padding: var(--space-md) var(--space-lg);
  color: var(--color-text-primary);
  text-decoration: none;
  font-size: 0.9rem;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: background var(--transition-fast);
}

.menu-item:hover {
  background: var(--color-bg-glass);
}

.menu-item.logout {
  color: var(--color-error);
  border-top: 1px solid var(--color-border);
}

.app-title {
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--color-text-secondary);
}

/* Dropdown animation */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 500px) {
  .user-name {
    display: none;
  }

  .app-title {
    display: none;
  }
}
</style>
