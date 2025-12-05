// app/plugins/supabase.client.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()

  const supabaseUrl = String(config.public.supabaseUrl)
  const supabaseAnon = String(config.public.supabaseAnon)

  // Public (browser) client
  const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnon)

  nuxtApp.provide("supabase", supabase)
})
