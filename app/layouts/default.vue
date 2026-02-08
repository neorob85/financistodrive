<template>
  <div class="app-layout">
    <TopBar :user="user" />
    <main class="main-content">
      <slot />
    </main>
    <BottomBar />
  </div>
</template>

<script setup lang="ts">
interface User {
  id: number
  username: string
  name?: string
  surname?: string
  isAdmin: boolean
}

const user = ref<User | null>(null)
const { loadLanguage } = useLanguage()
const { loadTheme } = useTheme()

// Fetch user info and language on mount
onMounted(async () => {
  try {
    const result = await $fetch<{ authenticated: boolean; user?: User }>('/api/auth/me')
    if (result.authenticated && result.user) {
      user.value = result.user
      // Load user's preferred language
      await loadLanguage()
      // Load user's preferred theme
      await loadTheme()
    }
  } catch {
    // User info not available
  }
})
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  padding-top: 60px;
  /* TopBar height */
  padding-bottom: 70px;
  /* BottomBar height */
  overflow-y: auto;
}
</style>
