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
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    
  public: {
    supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL,
    supabaseAnon: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY,
    siteUrl: process.env.NUXT_PUBLIC_SITE_URL || "http://localhost:3000"
    }
  }
})
