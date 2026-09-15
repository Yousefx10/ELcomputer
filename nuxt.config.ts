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
  modules: ['@nuxtjs/supabase','@nuxt/icon'],
  runtimeConfig: {
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
