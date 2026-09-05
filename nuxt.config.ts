import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@nuxtjs/supabase','@nuxt/icon'],
  runtimeConfig: {
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY || '',
    shippingCredentialsEncryptionKey: process.env.SHIPPING_CREDENTIALS_ENCRYPTION_KEY || '',
    shippingLiveRequestsEnabled: process.env.PDC_LIVE_REQUESTS_ENABLED === 'true',
    shippingWorkerSecret: process.env.SHIPPING_WORKER_SECRET || '',
    uploadsDir: process.env.UPLOADS_DIR || 'storage/uploads',
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || ''
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
