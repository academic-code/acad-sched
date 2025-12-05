// server/plugins/01.supabase.server.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  var $supabase: SupabaseClient | undefined;
  var $supabaseAdmin: SupabaseClient | undefined;
}

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig();

  const supabaseUrl = String(config.public.supabaseUrl);
  const anonKey = String(config.public.supabaseAnon);
  const serviceRoleKey = String(config.supabaseServiceRoleKey);

  if (!supabaseUrl || !anonKey) {
    console.error("❌ Missing Supabase public keys in runtimeConfig");
  }

  if (!serviceRoleKey) {
    console.error("❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env");
  }

  globalThis.$supabase ??= createClient(supabaseUrl, anonKey);
  globalThis.$supabaseAdmin ??= createClient(supabaseUrl, serviceRoleKey);

  console.log("✅ Supabase server plugin loaded");
});
