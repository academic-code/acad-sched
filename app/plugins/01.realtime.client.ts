import { defineNuxtPlugin } from "#app"
import type { SupabaseClient } from "@supabase/supabase-js"

declare global {
  interface Window { __REALTIME_INIT__?: boolean }
}

export default defineNuxtPlugin((nuxtApp) => {
  if (!process.client) return

  const supabase = nuxtApp.$supabase as SupabaseClient
  if (!supabase) return console.warn("⚠ Supabase not ready")

  if (window.__REALTIME_INIT__) return
  window.__REALTIME_INIT__ = true

  const tables = [
    "academic_terms", "departments", "faculty", "users",
    "subjects", "classes", "class_subjects",
    "schedules", "rooms"
  ]

  const channel = supabase.channel("global-sync")

  tables.forEach(table => {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      (payload) => {
        console.log(`📡 [Realtime] Change on table: ${table}`, payload)
        window.dispatchEvent(new CustomEvent("db:update", { detail: { table, payload }}))
      }
    )
  })

  channel.subscribe(status => {
    if (status === "SUBSCRIBED") console.log("🔗 Global realtime active")
  })
})
