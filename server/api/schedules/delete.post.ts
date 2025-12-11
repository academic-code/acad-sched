// server/api/schedules/delete.post.ts
import { readBody, createError } from "h3"
import { extractBearerToken, getAppUserRecord } from "./_helpers"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody<{ id?: string }>(event)

  const scheduleId = body?.id
  if (!scheduleId)
    throw createError({ statusCode: 400, message: "Schedule ID is required." })

  // ------------------------- AUTH -------------------------
  const token = extractBearerToken(event)
  if (!token) throw createError({ statusCode: 401, message: "Missing auth token." })

  const { userRecord } = await getAppUserRecord(supabase, token)
  const userRole = (userRecord.role || "").toUpperCase()
  const userDepartmentId = userRecord.department_id

  // ------------------------- LOAD SCHEDULE -------------------------
  const { data: scheduleRow, error: loadErr } = await supabase
    .from("schedules")
    .select("*")
    .eq("id", scheduleId)
    .maybeSingle()

  if (loadErr || !scheduleRow)
    throw createError({ statusCode: 404, message: "Schedule not found." })

  // ------------------------- PERMISSIONS -------------------------
  if (userRole === "FACULTY")
    throw createError({ statusCode: 403, message: "Faculty cannot delete schedules." })

  if (userRole === "DEAN") {
    if (!userDepartmentId)
      throw createError({ statusCode: 403, message: "Dean has no department assigned." })

    if (scheduleRow.department_id !== userDepartmentId)
      throw createError({
        statusCode: 403,
        message: "Dean can only delete schedules inside own department."
      })
  }

  if (userRole === "GENED") {
    const { data: subj } = await supabase
      .from("subjects")
      .select("is_gened")
      .eq("id", scheduleRow.subject_id)
      .maybeSingle()

    if (!subj?.is_gened)
      throw createError({
        statusCode: 403,
        message: "GenEd dean can only delete GenEd schedules."
      })
  }

  // ------------------------- SOFT DELETE -------------------------
  const nowIso = new Date().toISOString()

  const { error: delErr } = await supabase
    .from("schedules")
    .update({ is_deleted: true, updated_at: nowIso })
    .eq("id", scheduleId)

  if (delErr)
    throw createError({ statusCode: 500, message: delErr.message })

  // ------------------------- HISTORY -------------------------
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
