import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/supabase'],

  supabase: {
    types: false, //disable for now TS types
    redirect:false //disable for now login redirect
  },

  css:['./app/assets/css/main.css'],
  vite:{
    plugins:[
      tailwindcss(),
    ],
  }

})
