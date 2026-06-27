import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@nuxtjs/supabase','@nuxt/icon'],

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
