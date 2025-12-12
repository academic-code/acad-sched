// server/api/schedules/delete.post.ts
import { readBody, createError } from "h3"
import {
  extractBearerToken,
  getAppUserRecord,
  resolveNormalizedRole
} from "./_helpers"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody<{ id?: string }>(event)

  const scheduleId = body?.id
  if (!scheduleId) throw createError({ statusCode: 400, message: "Schedule ID is required." })

  // ---------------- AUTH ----------------
  const token = extractBearerToken(event)
  if (!token) throw createError({ statusCode: 401, message: "Missing auth token." })

  const { userRecord } = await getAppUserRecord(supabase, token)
  const normalizedRole = await resolveNormalizedRole(supabase, userRecord)
  const userDeptId = userRecord.department_id

  // ---------------- LOAD SCHEDULE ----------------
  const { data: scheduleRow, error: loadErr } = await supabase
    .from("schedules")
    .select(`
      *,
      subject:subjects(id, is_gened, department_id)
    `)
    .eq("id", scheduleId)
    .maybeSingle()

  if (loadErr) throw createError({ statusCode: 500, message: loadErr.message })
  if (!scheduleRow) throw createError({ statusCode: 404, message: "Schedule not found." })

  // Already deleted
  if (scheduleRow.is_deleted) {
    throw createError({ statusCode: 400, message: "Schedule already deleted." })
  }

  // ---------------- PERMISSIONS ----------------
  if (normalizedRole === "FACULTY") {
    throw createError({ statusCode: 403, message: "Faculty cannot delete schedules." })
  }

  if (normalizedRole === "DEAN") {
    if (!userDeptId) throw createError({ statusCode: 403, message: "Dean has no department." })
    if (scheduleRow.department_id !== userDeptId) {
      throw createError({ statusCode: 403, message: "Dean can only delete schedules inside own department." })
    }
  }

  if (normalizedRole === "GENED") {
    if (!scheduleRow.subject?.is_gened) {
      throw createError({ statusCode: 403, message: "GenEd dean can only delete GenEd schedules." })
    }
  }

  // ---------------- SOFT DELETE ----------------
  const nowIso = new Date().toISOString()

  const { error: delErr } = await supabase
    .from("schedules")
    .update({ is_deleted: true, updated_at: nowIso })
    .eq("id", scheduleId)

  if (delErr) throw createError({ statusCode: 500, message: delErr.message })

  // Clean up schedule_periods for this schedule (per your choice)
  const { error: spErr } = await supabase
    .from("schedule_periods")
    .delete()
    .eq("schedule_id", scheduleId)

  if (spErr) {
    // best-effort: log and continue, but surface a warning
    console.error("Failed to clean schedule_periods:", spErr)
  }

  // ---------------- HISTORY ----------------
  await supabase.from("schedule_history").insert({
    schedule_id: scheduleId,
    action: "DELETE",
    old_data: scheduleRow,
    new_data: null,
    performed_by: userRecord.id,
    performed_at: nowIso
  })

  return {
    success: true,
    id: scheduleId,
    undoAvailable: true,
    message: "Schedule deleted."
  }
})
