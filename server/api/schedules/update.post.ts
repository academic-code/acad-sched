// server/api/schedules/update.post.ts
import { readBody, createError } from "h3"
import { extractBearerToken, getAppUserRecord } from "./_helpers"

/** safe ranges overlap (inclusive) */
function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart <= bEnd && bStart <= aEnd
}

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody<any>(event)

  const {
    id,
    class_id,
    subject_id,
    faculty_id,
    room_id,
    day,
    period_start_id,
    period_end_id,
    mode = "F2F",
    academic_term_id: termOverride,
    force = false
  } = body || {}

  // ---------- basic validation ----------
  if (!id) throw createError({ statusCode: 400, message: "Schedule ID is required." })
  if (!class_id) throw createError({ statusCode: 400, message: "class_id is required." })
  if (!subject_id) throw createError({ statusCode: 400, message: "subject_id is required." })
  if (!day) throw createError({ statusCode: 400, message: "day is required." })
  if (!period_start_id || !period_end_id)
    throw createError({ statusCode: 400, message: "Both period_start_id and period_end_id are required." })

  // ---------- auth ----------
  const token = extractBearerToken(event)
  if (!token) throw createError({ statusCode: 401, message: "Missing auth token." })
  const { userRecord } = await getAppUserRecord(supabase, token)

  let userRole = (userRecord.role || "").toUpperCase()
  const userDepartmentId = userRecord.department_id

  // detect GENED dean
  if (userRole === "DEAN" && userDepartmentId) {
    const { data: dept } = await supabase
      .from("departments")
      .select("type")
      .eq("id", userDepartmentId)
      .maybeSingle()
    if (dept?.type === "GENED") userRole = "GENED"
  }

  // ---------- load existing schedule ----------
  const { data: oldRow, error: loadErr } = await supabase
    .from("schedules")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (loadErr || !oldRow) throw createError({ statusCode: 404, message: "Schedule not found." })

  // ---------- load class ----------
  const { data: classRow, error: classErr } = await supabase
    .from("classes")
    .select("id, department_id, academic_term_id")
    .eq("id", class_id)
    .maybeSingle()
  if (classErr || !classRow) throw createError({ statusCode: 400, message: "Class not found." })

  const scheduleDepartmentId = classRow.department_id
  const academic_term_id = termOverride || classRow.academic_term_id
  if (!academic_term_id) throw createError({ statusCode: 400, message: "Missing academic_term_id." })

  // ---------- load term ----------
  const { data: termRow, error: termErr } = await supabase
    .from("academic_terms")
    .select("id, is_active")
    .eq("id", academic_term_id)
    .maybeSingle()
  if (termErr || !termRow) throw createError({ statusCode: 400, message: "Academic term not found." })
  if (!termRow.is_active) throw createError({ statusCode: 400, message: "Cannot update schedules in an inactive term." })

  // ---------- load subject ----------
  const { data: subjectRow, error: subjErr } = await supabase
    .from("subjects")
    .select("id, department_id, is_gened")
    .eq("id", subject_id)
    .maybeSingle()
  if (subjErr || !subjectRow) throw createError({ statusCode: 400, message: "Subject not found." })

  // ---------- permissions ----------
  if (userRole === "FACULTY") throw createError({ statusCode: 403, message: "Faculty cannot update schedules." })

  if (userRole === "DEAN") {
    if (!userDepartmentId) throw createError({ statusCode: 403, message: "Dean has no department assigned." })
    if (scheduleDepartmentId !== userDepartmentId)
      throw createError({ statusCode: 403, message: "Dean can only update schedules inside their own department." })
    if (subjectRow.department_id !== userDepartmentId)
      throw createError({ statusCode: 403, message: "Dean can only schedule subjects from their department." })
    if (subjectRow.is_gened)
      throw createError({ statusCode: 403, message: "Program deans cannot update GenEd subjects." })
  }

  if (userRole === "GENED" && !subjectRow.is_gened)
    throw createError({ statusCode: 403, message: "GenEd dean can only update GenEd subjects." })

  // ---------- load periods and build safe map ----------
  const { data: periodRowsRaw, error: periodErr } = await supabase
    .from("periods")
    .select("id, slot_index")
    .order("slot_index", { ascending: true }) // keep order deterministic

  if (periodErr) throw createError({ statusCode: 500, message: periodErr.message || "Failed to load periods." })
  const periodRows: { id: string; slot_index: number }[] = Array.isArray(periodRowsRaw)
    ? periodRowsRaw.map((r: any) => ({ id: String(r.id), slot_index: Number(r.slot_index) }))
    : []

  if (periodRows.length === 0) throw createError({ statusCode: 500, message: "Periods table empty." })

  const startP = periodRows.find((p) => p.id === period_start_id)
  const endP = periodRows.find((p) => p.id === period_end_id)
  if (!startP || !endP) throw createError({ statusCode: 400, message: "Invalid period selected." })

  const startSlot = Math.min(startP.slot_index, endP.slot_index)
  const endSlot = Math.max(startP.slot_index, endP.slot_index)

  // ---------- helper: load conflicts and normalize slot numbers ----------
  async function loadConflicts(filter: Record<string, any>) {
    let req = supabase
      .from("schedules")
      .select(`
        id,
        day,
        period_start:period_start_id(slot_index),
        period_end:period_end_id(slot_index)
      `)
      .eq("academic_term_id", academic_term_id)
      .eq("is_deleted", false)
      .eq("day", day)
      .neq("id", id) // exclude this schedule (we're updating it)

    // apply filters like { class_id } | { faculty_id } | { room_id }
    for (const key of Object.keys(filter)) req = req.eq(key, filter[key])

    const { data, error } = await req
    if (error) throw createError({ statusCode: 500, message: error.message || "Failed to load conflicts." })

    // normalize returned rows to ensure we have numeric slot indexes in top-level fields
    const rows = (data || []).map((r: any) => {
      // period_start/period_end might be object or array depending on PostgREST/Supabase response.
      // Try to extract slot_index robustly.
      const getSlot = (x: any) => {
        if (x == null) return null
        if (Array.isArray(x)) return x[0]?.slot_index ?? null
        if (typeof x === "object") return x.slot_index ?? null
        return null
      }

      return {
        id: r.id,
        day: r.day,
        period_start_slot: Number(getSlot(r.period_start) ?? -1),
        period_end_slot: Number(getSlot(r.period_end) ?? -1),
        raw: r // keep raw for debugging/history if needed
      }
    })

    return rows
  }

  // ---------- HARD conflict: class ----------
  const classConf = await loadConflicts({ class_id })
  for (const c of classConf) {
    // skip invalid slot rows defensively
    if (c.period_start_slot < 0 || c.period_end_slot < 0) continue
    if (rangesOverlap(startSlot, endSlot, c.period_start_slot, c.period_end_slot)) {
      throw createError({ statusCode: 409, message: "Class already has a schedule at this time." })
    }
  }

  // ---------- SOFT conflict: faculty ----------
  let facultyConflicts: any[] = []
  if (faculty_id) {
    const list = await loadConflicts({ faculty_id })
    facultyConflicts = list.filter((c) => {
      if (c.period_start_slot < 0 || c.period_end_slot < 0) return false
      return rangesOverlap(startSlot, endSlot, c.period_start_slot, c.period_end_slot)
    })

    if (facultyConflicts.length > 0 && !force) {
      throw createError({
        statusCode: 409,
        message: "Teacher already booked at this time.",
        data: { type: "FACULTY_CONFLICT", conflicts: facultyConflicts.map((f) => f.id) }
      })
    }
  }

  // ---------- SOFT conflict: room ----------
  let roomConflicts: any[] = []
  if (room_id) {
    const list = await loadConflicts({ room_id })
    roomConflicts = list.filter((c) => {
      if (c.period_start_slot < 0 || c.period_end_slot < 0) return false
      return rangesOverlap(startSlot, endSlot, c.period_start_slot, c.period_end_slot)
    })

    if (roomConflicts.length > 0 && !force) {
      throw createError({
        statusCode: 409,
        message: "Room already in use at this time.",
        data: { type: "ROOM_CONFLICT", conflicts: roomConflicts.map((r) => r.id) }
      })
    }
  }

  // ---------- if force, soft-delete conflicting schedules (faculty/room) ----------
  const conflictsToDelete = [
    ...facultyConflicts.map((c) => c.id),
    ...roomConflicts.map((c) => c.id)
  ].filter(Boolean)

  if (force && conflictsToDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("schedules")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .in("id", conflictsToDelete)
    if (delErr) throw createError({ statusCode: 500, message: delErr.message })
    // write history for each replaced (optional: you can add here)
    for (const cid of conflictsToDelete) {
      await supabase.from("schedule_history").insert({
        schedule_id: cid,
        action: "FORCE_REPLACE",
        old_data: null,
        new_data: null,
        performed_by: userRecord.id
      })
    }
  }

  // ---------- update schedule ----------
  const nowIso = new Date().toISOString()
  const updatedPayload = {
    class_id,
    subject_id,
    faculty_id: faculty_id || null,
    room_id: room_id || null,
    day,
    mode,
    department_id: scheduleDepartmentId,
    period_start_id,
    period_end_id,
    academic_term_id,
    updated_at: nowIso
  }

  const { error: updErr } = await supabase.from("schedules").update(updatedPayload).eq("id", id)
  if (updErr) throw createError({ statusCode: 500, message: updErr.message })

  // ---------- rebuild schedule_periods ----------
  // remove existing
  await supabase.from("schedule_periods").delete().eq("schedule_id", id)

  // compute range using periodRows (safe typed array)
  const rangeRows = periodRows
    .filter((p) => p.slot_index >= startSlot && p.slot_index <= endSlot)
    .map((p) => ({ schedule_id: id, day, period_id: p.id }))

  if (rangeRows.length > 0) {
    const { error: spErr } = await supabase.from("schedule_periods").insert(rangeRows)
    if (spErr) throw createError({ statusCode: 500, message: spErr.message })
  }

  // ---------- write history ----------
  await supabase.from("schedule_history").insert({
    schedule_id: id,
    action: "UPDATE",
    old_data: oldRow,
    new_data: updatedPayload,
    performed_by: userRecord.id,
    performed_at: nowIso
  })

  return {
    success: true,
    id,
    replaced: force && conflictsToDelete.length > 0,
    faculty_conflicts: facultyConflicts.map((f) => f.id),
    room_conflicts: roomConflicts.map((r) => r.id)
  }
})
