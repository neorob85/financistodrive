<template>
  <nav class="bottom-bar">
    <NuxtLink to="/transactions" class="nav-item" :class="{ active: route.path === '/transactions' }">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
      <span>{{ $t('nav.transactions') }}</span>
    </NuxtLink>

    <NuxtLink to="/accounts" class="nav-item" :class="{ active: route.path.startsWith('/accounts') }">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
      <span>{{ $t('nav.accounts') }}</span>
    </NuxtLink>

    <NuxtLink to="/projects" class="nav-item" :class="{ active: route.path === '/projects' }">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
      </svg>
      <span>{{ $t('nav.projects') }}</span>
    </NuxtLink>

    <NuxtLink to="/vehicles" class="nav-item" :class="{ active: route.path.startsWith('/vehicles') }">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 17h14M5 17a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h8l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2M7 17v1a1 1 0 001 1h1a1 1 0 001-1v-1m4 0v1a1 1 0 001 1h1a1 1 0 001-1v-1" />
      </svg>
      <span>{{ $t('nav.vehicles') }}</span>
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
const route = useRoute()
</script>

<style scoped>
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 70px;
  background: var(--color-bg-card);
  backdrop-filter: blur(20px);
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 0 var(--space-md);
  padding-bottom: env(safe-area-inset-bottom, 0);
  z-index: 100;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: var(--space-sm) var(--space-md);
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 0.7rem;
  font-weight: 500;
  transition: all var(--transition-fast);
  border-radius: var(--radius-md);
  min-width: 60px;
}

.nav-item svg {
  transition: all var(--transition-fast);
}

.nav-item:hover {
  color: var(--color-text-secondary);
}

.nav-item.active {
  color: var(--color-accent);
}

.nav-item.active svg {
  transform: scale(1.1);
}

@media (min-width: 500px) {
  .nav-item {
    flex-direction: row;
    gap: var(--space-sm);
    font-size: 0.85rem;
    min-width: auto;
  }

  .bottom-bar {
    justify-content: center;
    gap: var(--space-xl);
  }
}
</style>
