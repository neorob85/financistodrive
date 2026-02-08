<template>
    <div class="admin-page">
        <h1 class="page-title">{{ $t('admin.title') }}</h1>

        <div class="admin-grid">
            <NuxtLink to="/admin/users" class="admin-card glass-card">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
                <span class="admin-card-title">{{ $t('admin.usersManagement') }}</span>
            </NuxtLink>

            <NuxtLink to="/admin/configurations" class="admin-card glass-card">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3" />
                    <path
                        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
                <span class="admin-card-title">{{ $t('admin.configurationsManagement') }}</span>
            </NuxtLink>

            <NuxtLink to="/admin/categories" class="admin-card glass-card">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 3v18" />
                    <path d="M6 7h6" />
                    <rect x="12" y="5" width="8" height="4" rx="1" />
                    <path d="M6 12h10" />
                    <rect x="16" y="10" width="6" height="4" rx="1" />
                    <path d="M6 17h4" />
                    <rect x="10" y="15" width="10" height="4" rx="1" />
                </svg>
                <span class="admin-card-title">{{ $t('admin.categoriesManagement') }}</span>
            </NuxtLink>

            <NuxtLink to="/admin/currencies" class="admin-card glass-card">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                </svg>
                <span class="admin-card-title">{{ $t('admin.currenciesManagement') }}</span>
            </NuxtLink>

            <NuxtLink to="/admin/fuels" class="admin-card glass-card">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 22V6a2 2 0 012-2h8a2 2 0 012 2v16" />
                    <path d="M15 10h2a2 2 0 012 2v2a2 2 0 002 2h0" />
                    <path d="M21 10V7l-3-3" />
                    <rect x="6" y="8" width="6" height="5" rx="1" />
                </svg>
                <span class="admin-card-title">{{ $t('admin.fuelsManagement') }}</span>
            </NuxtLink>

            <NuxtLink to="/admin/database" class="admin-card glass-card">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
                <span class="admin-card-title">{{ $t('admin.databaseManagement') }}</span>
            </NuxtLink>
        </div>
    </div>
</template>

<script setup lang="ts">
definePageMeta({
    layout: 'default',
    middleware: 'admin'
})
</script>

<style scoped>
.admin-page {
    padding: var(--space-lg);
    max-width: 800px;
    margin: 0 auto;
}

.page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: var(--space-xl);
    color: var(--color-text-primary);
}

.admin-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--space-md);
}

.admin-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-xl) var(--space-lg);
    text-decoration: none;
    color: var(--color-text-primary);
    border-radius: var(--radius-lg);
    transition: all 0.2s;
    text-align: center;
}

.admin-card:hover {
    border-color: var(--color-accent);
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
}

.admin-card svg {
    color: var(--color-accent);
}

.admin-card-title {
    font-size: 0.95rem;
    font-weight: 600;
}
</style>
