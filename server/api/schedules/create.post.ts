// server/api/schedules/create.post.ts
import { readBody, createError } from "h3"
import { extractBearerToken, getAppUserRecord } from "./_helpers"

// overlap detection
function overlap(a1: number, a2: number, b1: number, b2: number) {
  return a1 <= b2 && b1 <= a2
}

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody(event)

  const {
    class_id,
    subject_id,
    faculty_id,
    room_id,
    day,
    period_start_id,
    period_end_id,
    academic_term_id: termOverride,
    mode = "F2F",
    force = false
  } = body

  // -----------------------------------------
  // BASIC REQUIRED FIELDS
  // -----------------------------------------
  if (!class_id) throw createError({ statusCode: 400, message: "class_id required" })
  if (!subject_id) throw createError({ statusCode: 400, message: "subject_id required" })
  if (!day) throw createError({ statusCode: 400, message: "day required" })
  if (!period_start_id || !period_end_id)
    throw createError({ statusCode: 400, message: "period range required" })

  // -----------------------------------------
  // AUTHENTICATION
  // -----------------------------------------
  const token = extractBearerToken(event)
  if (!token) throw createError({ statusCode: 401, message: "Missing token" })

  const { userRecord } = await getAppUserRecord(supabase, token)
  let userRole = (userRecord.role || "").toUpperCase()
  const userDepartmentId = userRecord.department_id

  // -----------------------------------------
  // GENED DEAN DETECTION
  // -----------------------------------------
  if (userRole === "DEAN" && userDepartmentId) {
    const { data: dept } = await supabase
      .from("departments")
      .select("type")
      .eq("id", userDepartmentId)
      .maybeSingle()

    if (dept?.type === "GENED") userRole = "GENED"
  }

  // -----------------------------------------
  // LOAD CLASS
  // -----------------------------------------
  const { data: classRow, error: classErr } = await supabase
    .from("classes")
    .select("id, department_id, academic_term_id")
    .eq("id", class_id)
    .maybeSingle()

  if (classErr || !classRow)
    throw createError({ statusCode: 400, message: "Class not found" })

  const scheduleDepartmentId = classRow.department_id
  const academic_term_id = termOverride || classRow.academic_term_id

  if (!academic_term_id)
    throw createError({ statusCode: 400, message: "Missing academic term" })

  const { data: termRow } = await supabase
    .from("academic_terms")
    .select("id, is_active")
    .eq("id", academic_term_id)
    .maybeSingle()

  if (!termRow)
    throw createError({ statusCode: 400, message: "Academic term not found" })

  if (!termRow.is_active)
    throw createError({ statusCode: 400, message: "Term is not active" })

  // -----------------------------------------
  // LOAD SUBJECT
  // -----------------------------------------
  const { data: subjectRow } = await supabase
    .from("subjects")
    .select("id, department_id, is_gened")
    .eq("id", subject_id)
    .maybeSingle()

  if (!subjectRow)
    throw createError({ statusCode: 400, message: "Subject not found" })

  // -----------------------------------------
  // PERMISSION RULES (DEAN / GENED ONLY)
  // -----------------------------------------
  if (userRole === "ADMIN")
    throw createError({ statusCode: 403, message: "Admins cannot create schedules." })

  if (userRole === "FACULTY")
    throw createError({ statusCode: 403, message: "Faculty cannot create schedules." })

  if (userRole === "DEAN") {
    if (scheduleDepartmentId !== userDepartmentId)
      throw createError({
        statusCode: 403,
        message: "Dean can only schedule inside their own department."
      })

    if (subjectRow.is_gened)
      throw createError({
        statusCode: 403,
        message: "Program deans cannot schedule GenEd subjects."
      })

    if (subjectRow.department_id !== userDepartmentId)
      throw createError({
        statusCode: 403,
        message: "Dean cannot schedule subjects from other departments."
      })
  }

  if (userRole === "GENED") {
    if (!subjectRow.is_gened)
      throw createError({
        statusCode: 403,
        message: "GenEd dean can only schedule GenEd subjects."
      })
  }

  // -----------------------------------------
  // LOAD PERIODS
  // -----------------------------------------
  const { data: periodRows } = await supabase
    .from("periods")
    .select("id, slot_index")

  if (!periodRows || periodRows.length === 0)
    throw createError({ statusCode: 500, message: "Periods not configured" })

  const pStart = periodRows.find(p => p.id === period_start_id)
  const pEnd = periodRows.find(p => p.id === period_end_id)

  if (!pStart || !pEnd)
    throw createError({ statusCode: 400, message: "Invalid period" })

  const startSlot = Math.min(pStart.slot_index, pEnd.slot_index)
  const endSlot = Math.max(pStart.slot_index, pEnd.slot_index)

  // -----------------------------------------
  // CONFLICT LOADER
  // -----------------------------------------
  async function loadConflicts(filter: any) {
    let q = supabase
      .from("schedules")
      .select(`
        id,
        day,
        period_start:period_start_id(slot_index),
        period_end:period_end_id(slot_index)
      `)
      .eq("day", day)
      .eq("academic_term_id", academic_term_id)
      .eq("is_deleted", false)

    for (const [k, v] of Object.entries(filter)) q = q.eq(k, v)

    const { data } = await q
    return (data || []) as any[]
  }

  // -----------------------------------------
  // HARD: CLASS CONFLICT
  // -----------------------------------------
  const classConflicts = await loadConflicts({ class_id })
  for (const c of classConflicts) {
    const cs = (c.period_start as any)?.slot_index
    const ce = (c.period_end as any)?.slot_index

    if (overlap(startSlot, endSlot, cs, ce))
      throw createError({ statusCode: 409, message: "Class conflict" })
  }

  // -----------------------------------------
  // SOFT: FACULTY CONFLICT
  // -----------------------------------------
  let facultyConflicts: any[] = []
  if (faculty_id) {
    const fc = await loadConflicts({ faculty_id })
    facultyConflicts = fc.filter(c =>
      overlap(startSlot, endSlot,
        (c.period_start as any)?.slot_index,
        (c.period_end as any)?.slot_index
      )
    )

    if (facultyConflicts.length && !force)
      throw createError({ statusCode: 409, message: "Faculty conflict" })
  }

  // -----------------------------------------
  // SOFT: ROOM CONFLICT
  // -----------------------------------------
  let roomConflicts: any[] = []
  if (room_id) {
    const rc = await loadConflicts({ room_id })
    roomConflicts = rc.filter(c =>
      overlap(startSlot, endSlot,
        (c.period_start as any)?.slot_index,
        (c.period_end as any)?.slot_index
      )
    )

    if (roomConflicts.length && !force)
      throw createError({ statusCode: 409, message: "Room conflict" })
  }

  // -----------------------------------------
  // INSERT SCHEDULE
  // -----------------------------------------
  const now = new Date().toISOString()

  const schedulePayload = {
    class_id,
    subject_id,
    faculty_id: faculty_id || null,
    room_id: room_id || null,
    day,
    period_start_id,
    period_end_id,
    academic_term_id,
    department_id: scheduleDepartmentId,
    mode,
    is_deleted: false,
    status: "PUBLISHED",
    created_by: userRecord.id,
    created_at: now,
    updated_at: now
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("schedules")
    .insert(schedulePayload)
    .select("*")
    .maybeSingle()

  if (insertErr || !inserted)
    throw createError({
      statusCode: 500,
      message: insertErr?.message || "Insert failed"
    })

  // -----------------------------------------
  // EXPAND schedule_periods
  // -----------------------------------------
  const expand = periodRows
    .filter(p => p.slot_index >= startSlot && p.slot_index <= endSlot)
    .map(p => ({
      schedule_id: inserted.id,
      day,
      period_id: p.id
    }))

  if (expand.length) {
    const { error: e2 } = await supabase
      .from("schedule_periods")
      .insert(expand)
    if (e2) throw createError({ statusCode: 500, message: e2.message })
  }

  // -----------------------------------------
  // HISTORY
  // -----------------------------------------
  await supabase.from("schedule_history").insert({
    schedule_id: inserted.id,
    action: "CREATE",
    old_data: null,
    new_data: inserted,
    performed_by: userRecord.id
  })

  return {
    success: true,
    schedule: inserted,
    faculty_conflict_ignored: facultyConflicts.length > 0 && force,
    room_conflict_ignored: roomConflicts.length > 0 && force,
    undo_id: inserted.id
  }
})
