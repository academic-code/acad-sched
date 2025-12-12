// FILE: server/api/schedules/undo.post.ts
import { readBody, createError } from "h3"
import {
  extractBearerToken,
  getAppUserRecord,
  resolveNormalizedRole
} from "./_helpers"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody<{ id?: string }>(event)

  const id = body?.id
  if (!id) {
    throw createError({ statusCode: 400, message: "Undo ID is required." })
  }

  // ---------------- AUTH ----------------
  const token = extractBearerToken(event)
  if (!token) throw createError({ statusCode: 401, message: "Missing auth token." })

  const { userRecord } = await getAppUserRecord(supabase, token)
  await resolveNormalizedRole(supabase, userRecord) // not used for permissions, but consistent

  // ---------------- LOAD SCHEDULE ----------------
  const { data: scheduleRow, error: scheduleErr } = await supabase
    .from("schedules")
    .select("id, created_at, is_deleted")
    .eq("id", id)
    .maybeSingle()

  if (scheduleErr) throw createError({ statusCode: 500, message: scheduleErr.message })
  if (!scheduleRow) throw createError({ statusCode: 404, message: "Schedule not found." })

  // If already deleted → nothing to undo
  if (scheduleRow.is_deleted) {
    throw createError({
      statusCode: 400,
      message: "Schedule already deleted. Nothing to undo."
    })
  }

  // ---------------- UNDO WINDOW ----------------
  const createdAtMs = new Date(scheduleRow.created_at).getTime()
  const nowMs = Date.now()

  const UNDO_WINDOW_MS = 10_000 // 10 seconds

  if (nowMs - createdAtMs > UNDO_WINDOW_MS) {
    throw createError({
      statusCode: 400,
      message: "Undo window expired."
    })
  }

  // ---------------- MARK SCHEDULE AS DELETED ----------------
  const nowIso = new Date().toISOString()

  const { error: delErr } = await supabase
    .from("schedules")
    .update({
      is_deleted: true,
      updated_at: nowIso
    })
    .eq("id", id)

  if (delErr) {
    throw createError({ statusCode: 500, message: delErr.message })
  }

  // ---------------- CLEAN schedule_periods (for consistency with delete.post.ts) ----------------
  const { error: spErr } = await supabase
    .from("schedule_periods")
    .delete()
    .eq("schedule_id", id)

  if (spErr) {
    console.error("Failed to delete schedule_periods during undo:", spErr)
  }

  // ---------------- HISTORY ENTRY ----------------
  await supabase.from("schedule_history").insert({
    schedule_id: id,
    action: "UNDO_CREATE",
    old_data: scheduleRow,
    new_data: null,
    performed_by: null, // system-level undo
    performed_at: nowIso
  })

  return {
    success: true,
    undone: true,
    id
  }
})
