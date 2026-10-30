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

// Legge l'utente già caricato dal middleware (evita chiamata duplicata a /api/auth/me)
const user = useState<User | null>('current-user', () => null)
const { loadLanguage } = useLanguage()
const { loadTheme } = useTheme()

onMounted(async () => {
  if (user.value) {
    // Carica lingua e tema in parallelo
    await Promise.all([loadLanguage(), loadTheme()])
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
