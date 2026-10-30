<script setup lang="ts">
useHead({
  link: [
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    { rel: 'manifest', href: '/manifest.webmanifest' }
  ],
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
  ]
})

const { checkSupport, checkSubscription } = usePushNotifications()

onMounted(() => {
  checkSupport()
  // Silently sync existing subscription if already granted (no permission request)
  checkSubscription()
})
</script>

<template>
  <div class="app-main">
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>