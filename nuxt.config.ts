export default defineNuxtConfig({
  ssr: false,

  nitro: {
    preset: 'vercel',
  },

  imports: {
    dirs: ['types']
  },

  css: [
    "vuetify/styles",
    "@mdi/font/css/materialdesignicons.css"
  ],

  build: {
    transpile: ["vuetify"]
  },

  devtools: { enabled: true },

  runtimeConfig: {
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL,
      supabaseAnon: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY
    }
  }
})
