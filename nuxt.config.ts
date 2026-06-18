// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/supabase', '@nuxtjs/tailwindcss'],

  supabase: {
    types: false, //disable for now TS types
    redirect:false //disable for now login redirect
  }

})
