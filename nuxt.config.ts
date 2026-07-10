import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@nuxtjs/supabase','@nuxt/icon'],
  runtimeConfig: {
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY || '',
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || ''
    }
  },

  supabase: {
    types: false, //disable for now TS types
    redirect:false //disable for now login redirect
  },

    sourcemap: false,

  css:['./app/assets/css/main.css'],
  vite:{
    plugins:[
      tailwindcss(),
    ],
    build: {
      sourcemap: false
    }
  }

})
