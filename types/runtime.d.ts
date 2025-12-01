// /types/runtime.d.ts
export {}

declare module "nuxt/schema" {
  interface PublicRuntimeConfig {
    supabaseUrl: string
    supabaseAnon: string
  }
}

declare module "#app" {
  interface NuxtApp {
    $supabase: import("@supabase/supabase-js").SupabaseClient
  }
}

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    $supabase: import("@supabase/supabase-js").SupabaseClient
  }
}

