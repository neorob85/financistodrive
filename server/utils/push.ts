import webpush from 'web-push'
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'

interface PushNotificationPayload {
    title: string
    body: string
    icon?: string
    url?: string
    tag?: string
}

const SECRET_FILE = join(process.cwd(), 'server', 'data', 'vapid.secret')

let initialized = false
let vapidPublicKey = ''
let vapidPrivateKey = ''

function loadOrGenerateKeys(): { publicKey: string; privateKey: string } {
    // Try to load from file
    if (existsSync(SECRET_FILE)) {
        try {
            const data = JSON.parse(readFileSync(SECRET_FILE, 'utf-8'))
            if (data.publicKey && data.privateKey) {
                return data
            }
        } catch {
            // Corrupted file, regenerate
        }
    }

    // Generate new keys and save
    const keys = webpush.generateVAPIDKeys()
    const dir = dirname(SECRET_FILE)
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
    }
    writeFileSync(SECRET_FILE, JSON.stringify({
        publicKey: keys.publicKey,
        privateKey: keys.privateKey
    }), 'utf-8')

    console.log('VAPID keys generated and saved to vapid.secret')
    return keys
}

const ensureInitialized = () => {
    if (initialized) return

    const keys = loadOrGenerateKeys()
    vapidPublicKey = keys.publicKey
    vapidPrivateKey = keys.privateKey

    webpush.setVapidDetails(
        'mailto:admin@simplemoney.app',
        vapidPublicKey,
        vapidPrivateKey
    )

    initialized = true
}

export const getVapidPublicKey = (): string => {
    ensureInitialized()
    return vapidPublicKey
}

export const resetVapidKeys = () => {
    try {
        if (existsSync(SECRET_FILE)) {
            unlinkSync(SECRET_FILE)
        }
    } catch {
        // File doesn't exist, that's fine
    }
    vapidPublicKey = ''
    vapidPrivateKey = ''
    initialized = false
}

export const regenerateVapidKeys = () => {
    const keys = webpush.generateVAPIDKeys()

    const dir = dirname(SECRET_FILE)
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
    }
    writeFileSync(SECRET_FILE, JSON.stringify({
        publicKey: keys.publicKey,
        privateKey: keys.privateKey
    }), 'utf-8')

    vapidPublicKey = keys.publicKey
    vapidPrivateKey = keys.privateKey

    webpush.setVapidDetails(
        'mailto:admin@simplemoney.app',
        vapidPublicKey,
        vapidPrivateKey
    )

    initialized = true
}

export const sendPushNotification = async (subscription: webpush.PushSubscription, payload: PushNotificationPayload) => {
    ensureInitialized()

    try {
        await webpush.sendNotification(subscription, JSON.stringify(payload))
        return { success: true }
    } catch (error) {
        console.error('Error sending push notification:', error)
        return { success: false, error }
    }
}
