// /types/runtime.d.ts
export {}

import type { SupabaseClient } from "@supabase/supabase-js";

declare module "nuxt/schema" {
  interface PublicRuntimeConfig {
    supabaseUrl: string
    supabaseAnon: string
  }
}

declare module "#app" {
  interface NuxtApp {
    $supabase: SupabaseClient
  }
}

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    $supabase: SupabaseClient
  }
}

// ---- SERVER SIDE GLOBALS (Fixes TS errors in API routes) ----
declare global {
  var $supabase: SupabaseClient
  var $supabaseAdmin: SupabaseClient
}
