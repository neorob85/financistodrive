self.addEventListener('push', function (event) {
    if (!event.data) return;

    let data;
    try {
        data = event.data.json();
    } catch (e) {
        console.error('Push: invalid JSON payload', e);
        return;
    }

    // Fallback title — update if you rename the app in nuxt.config.ts
    const title = data.title || 'Financisto Drive';
    const options = {
        body: data.body || 'Nuova notifica',
        icon: data.icon || '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: data.tag || 'default',
        data: { url: data.url || '/' }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    const urlPath = event.notification.data && event.notification.data.url
        ? event.notification.data.url
        : '/';

    // Validate URL: only allow same-origin paths
    let targetUrl;
    try {
        targetUrl = new URL(urlPath, self.location.origin);
        if (targetUrl.origin !== self.location.origin) {
            targetUrl = new URL('/', self.location.origin);
        }
    } catch (e) {
        targetUrl = new URL('/', self.location.origin);
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            // Focus existing window if already open
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                try {
                    var clientUrl = new URL(client.url);
                    if (clientUrl.origin === self.location.origin && 'focus' in client) {
                        client.navigate(targetUrl.href);
                        return client.focus();
                    }
                } catch (e) {
                    // skip invalid client
                }
            }
            // No existing window, open new one
            return clients.openWindow(targetUrl.href);
        })
    );
});
