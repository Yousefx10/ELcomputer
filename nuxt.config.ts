import process from 'node:process'
import { DEFAULT_SITE_URL } from './app/utils/seo.js'
import tailwindcss from "@tailwindcss/vite";

const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey = process.env.NUXT_PUBLIC_SUPABASE_KEY
  || process.env.NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || process.env.SUPABASE_KEY
  || ''

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@nuxtjs/supabase', '@nuxt/icon', '@nuxtjs/i18n', '@nuxtjs/color-mode'],
  i18n: {
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    detectBrowserLanguage: false,
    langDir: 'locales',
    locales: [
      { code: 'en', language: 'en-US', name: 'English', dir: 'ltr', file: 'en.json' },
      { code: 'ar', language: 'ar-EG', name: 'العربية', dir: 'rtl', file: 'ar.json' }
    ]
  },
  colorMode: {
    preference: 'system',
    fallback: 'light',
    classSuffix: '',
    dataValue: 'theme',
    storage: 'cookie',
    storageKey: 'elcomputer-color-mode',
    cookieAttrs: { maxAge: 31536000, path: '/', sameSite: 'lax' }
  },
  runtimeConfig: {
    aiSearchAllowed: true,
    aiTrainingAllowed: true,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY || '',
    daftraAccountUrl: process.env.DAFTRA_ACCOUNT_URL || '',
    daftraApiKey: process.env.DAFTRA_API_KEY || '',
    daftraClientId: process.env.DAFTRA_CLIENT_ID || '',
    credentialsEncryptionKey: process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.SHIPPING_CREDENTIALS_ENCRYPTION_KEY || '',
    shippingCredentialsEncryptionKey: process.env.SHIPPING_CREDENTIALS_ENCRYPTION_KEY || '',
    shippingLiveRequestsEnabled: process.env.PDC_LIVE_REQUESTS_ENABLED === 'true',
    shippingWorkerSecret: process.env.SHIPPING_WORKER_SECRET || '',
    uploadsDir: process.env.UPLOADS_DIR || 'storage/uploads',
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL,
      supabaseUrl,
      supabase: {
        url: supabaseUrl,
        key: supabaseKey
      }
    }
  },

  supabase: {
    types: false, //disable for now TS types
    redirect:false //disable for now login redirect
  },

    sourcemap: false,

  css:['~/assets/css/main.css'],
  vite:{
    plugins:[
      tailwindcss(),
    ],
    build: {
      sourcemap: false
    }
  }

})
