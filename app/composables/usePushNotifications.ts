import { urlBase64ToUint8Array } from '~/utils/push'

export function usePushNotifications() {
    const isSupported = ref(false)
    const isSubscribed = ref(false)
    const permission = ref<NotificationPermission>('default')
    const isIOS = ref(false)
    const isStandalone = ref(false)
    const needsInstall = ref(false)
    const loading = ref(false)

    const checkSupport = () => {
        if (import.meta.server) return

        // Detect iOS: includes iPadOS in desktop mode (reports as MacIntel with touch)
        const ua = navigator.userAgent
        isIOS.value =
            /iPad|iPhone|iPod/.test(ua) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

        isStandalone.value =
            window.matchMedia('(display-mode: standalone)').matches ||
            (navigator as any).standalone === true

        isSupported.value =
            'serviceWorker' in navigator &&
            'PushManager' in window &&
            'Notification' in window

        // On iOS, PushManager is only available in standalone mode (installed PWA)
        needsInstall.value = isIOS.value && !isStandalone.value && !isSupported.value

        permission.value = 'Notification' in window
            ? Notification.permission
            : 'denied'
    }

    const checkSubscription = async () => {
        if (!isSupported.value) return

        try {
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.getSubscription()
            isSubscribed.value = !!subscription

            // If already subscribed, sync with backend silently
            if (subscription) {
                await syncSubscription(subscription)
            }
        } catch {
            isSubscribed.value = false
        }
    }

    const syncSubscription = async (subscription: PushSubscription) => {
        try {
            const raw = JSON.parse(JSON.stringify(subscription))
            await $fetch('/api/push/subscribe', {
                method: 'POST',
                body: {
                    endpoint: raw.endpoint,
                    keys: raw.keys
                }
            })
        } catch {
            // Silently fail - user may not be authenticated yet
        }
    }

    const subscribe = async (): Promise<boolean> => {
        if (!isSupported.value || needsInstall.value) return false

        loading.value = true
        try {
            const perm = await Notification.requestPermission()
            permission.value = perm

            if (perm !== 'granted') return false

            const registration = await navigator.serviceWorker.ready
            const { publicKey } = await $fetch<{ publicKey: string }>('/api/push/vapid')

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            })

            await syncSubscription(subscription)
            isSubscribed.value = true
            return true
        } catch {
            return false
        } finally {
            loading.value = false
        }
    }

    const unsubscribe = async (): Promise<boolean> => {
        loading.value = true
        try {
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.getSubscription()

            if (subscription) {
                const raw = JSON.parse(JSON.stringify(subscription))
                await subscription.unsubscribe()

                try {
                    await $fetch('/api/push/unsubscribe', {
                        method: 'POST',
                        body: { endpoint: raw.endpoint }
                    })
                } catch {
                    // Backend cleanup can fail silently
                }
            }

            isSubscribed.value = false
            return true
        } catch {
            return false
        } finally {
            loading.value = false
        }
    }

    return {
        isSupported,
        isSubscribed,
        permission,
        isIOS,
        isStandalone,
        needsInstall,
        loading,
        checkSupport,
        checkSubscription,
        subscribe,
        unsubscribe
    }
}
