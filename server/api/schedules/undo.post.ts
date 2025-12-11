// server/api/schedules/undo.post.ts
import { readBody, createError } from "h3"
import { extractBearerToken, getAppUserRecord } from "./_helpers"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody<{ id?: string }>(event)

  const id = body?.id
  if (!id) {
    throw createError({ statusCode: 400, message: "Undo ID is required." })
  }

  // ------------------------- AUTH -------------------------
  const token = extractBearerToken(event)
  if (!token) {
    throw createError({ statusCode: 401, message: "Missing auth token." })
  }

  await getAppUserRecord(supabase, token)

  // ------------------------- LOAD SCHEDULE -------------------------
  const { data: scheduleRow, error: scheduleErr } = await supabase
    .from("schedules")
    .select("id, created_at, is_deleted")
    .eq("id", id)
    .maybeSingle()

  if (scheduleErr || !scheduleRow) {
    throw createError({ statusCode: 404, message: "Schedule not found." })
  }

  // Already deleted → nothing to undo
  if (scheduleRow.is_deleted) {
    throw createError({
      statusCode: 400,
      message: "Schedule already deleted. Nothing to undo."
    })
  }

  // ------------------------- UNDO TIME WINDOW -------------------------
  const createdAtMs = new Date(scheduleRow.created_at).getTime()
  const nowMs = Date.now()

  // You may change this (default: 10 seconds)
  const UNDO_WINDOW_MS = 10_000

  if (nowMs - createdAtMs > UNDO_WINDOW_MS) {
    throw createError({
      statusCode: 400,
      message: "Undo window expired."
    })
  }

  // ------------------------- MARK AS DELETED -------------------------
  const { error: delErr } = await supabase
    .from("schedules")
    .update({
      is_deleted: true,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)

  if (delErr) {
    throw createError({ statusCode: 500, message: delErr.message })
  }

  // ------------------------- WRITE HISTORY -------------------------
  await supabase.from("schedule_history").insert({
    schedule_id: id,
    action: "UNDO_CREATE",
    old_data: scheduleRow,
    new_data: null,
    performed_by: null, // system-level undo
    performed_at: new Date().toISOString()
  })

  // ------------------------- RESPONSE -------------------------
  return {
    success: true,
    undone: true,
    id
  }
})
