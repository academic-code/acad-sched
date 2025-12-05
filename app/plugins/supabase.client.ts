import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()

  const supabaseUrl = String(config.public.supabaseUrl)
  const supabaseAnon = String(config.public.supabaseAnon)

  const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnon)

  // ❗ Only ONE injection is needed
  return {
    provide: {
      supabase
    }
  }
})
