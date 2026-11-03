import process from 'node:process'
import {createRequire} from 'node:module'
import {dirname,join} from 'node:path'
const pdfRoot=dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'))
const pdfVersion=createRequire(import.meta.url)('pdfjs-dist/package.json').version
import { DEFAULT_SITE_URL } from './app/utils/seo.js'
import { paymobFrameCsp } from './app/utils/paymobFramePolicy.js'
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
  routeRules: { '/paymob-pixel/1.2.8/**': { headers: { 'Content-Security-Policy': paymobFrameCsp, 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'public, max-age=31536000, immutable' } }, ...Object.fromEntries(['/favicon.ico', '/favicon-16x16.png', '/favicon-32x32.png', '/favicon-48x48.png', '/favicon-96x96.png', '/apple-touch-icon.png', '/android-chrome-192x192.png', '/android-chrome-512x512.png', '/site.webmanifest'].map(path => [path, { headers: { 'cache-control': 'public, max-age=86400' } }])) },
  nitro: {
    publicAssets: [{dir:join(pdfRoot,'standard_fonts'),baseURL:`/_nuxt/pdfjs-${pdfVersion}/standard_fonts`,maxAge:31536000}],
    externals: {
      // Text-only PDF validation uses JS DOMMatrix; no native canvas is required.
      traceInclude: ['node_modules/pdfjs-dist/legacy/build/pdf.mjs', 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs', 'node_modules/@thednp/dommatrix/dist/dommatrix.mjs'],
      traceOptions: {ignore: ['**/node_modules/@napi-rs/canvas/**', '**/node_modules/@napi-rs/canvas-*/**']}
    }
  },
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
    paymentMonitorReportPath: '',
    smsWorkerSecret: '',
    emailWorkerSecret: '',
    commerceWorkerSecret: '',
    paymobPixelEnabled: false,
    paymobPixelCustomerIds: '[]',
    paymobRedirectFallbackEnabled: true,
    paymentFirstEnabled: false,
    manualTransferEnabled: false,
    transferDocumentsDir: '',
    paymobEnabled: false,
    paymobLiveRequestsEnabled: false,
    paymobMode: 'test',
    paymobSecretKey: '',
    paymobPublicKey: '',
    paymobHmacSecret: '',
    paymobCardIntegrationId: '',
    paymobCardIntegrationMode: 'test',
    paymobIntegrationIds: '{}',
    controlledPurchase: '{}',
    betaPurchasePolicy: '{}',
    aiSearchAllowed: true,
    aiTrainingAllowed: true,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY || '',
    daftraAccountUrl: process.env.DAFTRA_ACCOUNT_URL || '',
    daftraApiKey: process.env.DAFTRA_API_KEY || '',
    daftraClientId: process.env.DAFTRA_CLIENT_ID || '',
    credentialsEncryptionKey: process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.SHIPPING_CREDENTIALS_ENCRYPTION_KEY || '',
    shippingCredentialsEncryptionKey: process.env.SHIPPING_CREDENTIALS_ENCRYPTION_KEY || '',
    shippingLiveRequestsEnabled: process.env.PDC_LIVE_REQUESTS_ENABLED === 'true',
    pdcManualCodEnabled: false,
    pdcTrackingRequestsEnabled: false,
    pdcTrackingWorkerEnabled: false,
    pdcTrackingWorkerSecret: '',
    pdcWebhookEnabled: false,
    shippingWorkerSecret: process.env.SHIPPING_WORKER_SECRET || '',
    erpWorkerSecret: process.env.ERP_WORKER_SECRET || '',
    uploadsDir: process.env.UPLOADS_DIR || 'storage/uploads',
    packingVideosDir: '',
    shippingDocumentsDir: '',
    packingVideoProbePath: 'ffprobe',
    public: {
      // Display only. Auth settings determine whether registration is available.
      returningCustomerNoticeEnabled: false,
      authCaptchaProvider: '',
      turnstileSiteKey: '',
      // Presentation only. Checkout/provider authorization remains authoritative.
      paymentFirstEnabled: false,
      purchasingEnabled: false,
      betaPurchasingEnabled: false,
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
