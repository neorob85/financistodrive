import { getPool } from '../utils/db'
import { loadSql } from '../utils/sql'
import { sendPushNotification } from '../utils/push'

export default defineNitroPlugin((nitroApp) => {
    // Run every hour to check if 24h have passed for any user
    const CHECK_INTERVAL = 60 * 60 * 1000 // 1 hour

    const checkAndSendNotifications = async () => {
        try {
            const pool = await getPool()
            // We use a custom query (or load from file)
            // Implementation: Select subscriptions that haven't been notified in > 24h AND have pending alerts
            const sql = await loadSql('maintenance_alerts/get_pending_push_subscriptions.sql')
            const rows = await pool.query(sql)

            if (rows.length === 0) return

            console.log(`Found ${rows.length} subscriptions to notify.`)

            const payload = {
                title: 'Manutenzione in scadenza',
                body: 'Hai una o più manutenzioni in scadenza o scadute. Controlla l\'app.',
                url: '/alerts',
                icon: '/pwa-192x192.png'
            }

            for (const row of rows) {
                const subscription = {
                    endpoint: row.endpoint,
                    keys: {
                        p256dh: row.keys_p256dh,
                        auth: row.keys_auth
                    }
                }

                try {
                    const result = await sendPushNotification(subscription, payload)
                    if (result.success) {
                        await pool.query('UPDATE push_subscriptions SET last_notification_sent_at = NOW() WHERE endpoint = ? AND user_id = ?', [row.endpoint, row.user_id])
                    } else if (result.error) {
                        const statusCode = (result.error as any).statusCode || (result.error as any).status
                        if (statusCode === 410 || statusCode === 404) {
                            // Subscription expired/gone, remove it
                            await pool.query('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?', [row.endpoint, row.user_id])
                        }
                    }
                } catch (err) {
                    console.error(`Failed to notify ${row.endpoint}`, err)
                }
            }

        } catch (error) {
            console.error('Error in push notification scheduler:', error)
        }
    }

    // Run initially after strict startup delay (e.g. 1 min)
    setTimeout(checkAndSendNotifications, 60 * 1000)

    // Schedule periodic check
    setInterval(checkAndSendNotifications, CHECK_INTERVAL)
})
