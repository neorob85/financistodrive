import { readFileSync } from 'node:fs'

// App name — change this to rename the app everywhere
const APP_NAME = 'Financisto Drive'
const DB_NAME = 'simplemoney'
// App version — single source of truth is package.json
const APP_VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')).version as string

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  app: {
    head: {
      link: [
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/manifest.webmanifest' } // Explicitly link manifest
      ],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
      ]
    }
  },
  css: ['~/assets/main.css'],
  modules: ['@nuxtjs/i18n', '@vite-pwa/nuxt'],
  pwa: {
    manifest: {
      name: APP_NAME,
      short_name: APP_NAME,
      description: 'Your simple finance and vehicles manager',
      start_url: '/',
      display: 'standalone',
      orientation: 'portrait',
      theme_color: '#4f46e5',
      background_color: '#ffffff',
      icons: [
        {
          src: 'pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    },
    workbox: {
      navigateFallback: '/',
      importScripts: ['/sw-push.js']
    },
    devOptions: {
      enabled: process.env.NODE_ENV !== 'production'
    }
  },
  i18n: {
    locales: [
      { code: 'it', name: 'Italiano', file: 'it.json' },
      { code: 'en', name: 'English', file: 'en.json' }
    ],
    defaultLocale: 'it',
    langDir: 'locales',
    strategy: 'no_prefix',
    detectBrowserLanguage: false
  },
  routeRules: {
    '/**': {
      headers: {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        // HSTS: force HTTPS for 1 year (only effective behind a TLS reverse proxy)
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        // CSP: conservative policy compatible with Nuxt SSR + PWA + service workers
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "connect-src 'self'",
          "media-src 'self'",
          "worker-src 'self' blob:",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'"
        ].join('; ')
      }
    }
  },
  vite: {
    server: {
      allowedHosts: process.env.ALLOWED_HOST ? [process.env.ALLOWED_HOST] : true
    }
  },
  runtimeConfig: {
    dbName: DB_NAME,
    public: {
      appName: APP_NAME,
      appVersion: APP_VERSION
    }
  }
})

