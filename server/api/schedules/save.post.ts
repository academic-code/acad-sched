// server/api/schedules/save.post.ts
import { readBody, createError } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody<any>(event)

  const {
    id, // optional -> if present = UPDATE, else CREATE
    class_id,
    subject_id,
    faculty_id,
    room_id,
    day,
    period_start_id,
    period_end_id,
    academic_term_id: termFromBody,
    mode = "F2F",
    force = false
  } = body

  if (!class_id || !subject_id || !day || !period_start_id || !period_end_id) {
    throw createError({ statusCode: 400, message: "Missing required fields." })
  }

  // --------------------------------------------------
  // 1️⃣ Auth: Supabase user → app user + role/department
  // --------------------------------------------------
  const authHeader = event.node.req.headers.authorization
  const token = authHeader?.replace("Bearer ", "") ?? null

  if (!token) throw createError({ statusCode: 401, message: "Missing auth token." })

  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }

  const { data: userRecord, error: userErr } = await supabase
    .from("users")
    .select("id, role, department_id")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle()

  if (userErr || !userRecord) {
    throw createError({ statusCode: 403, message: "User record not found." })
  }

  const actorId = userRecord.id
  let userRole = (userRecord.role || "").toUpperCase()
  const userDepartmentId = userRecord.department_id

  // --------------------------------------------------
  // 2️⃣ Load Class (for department + optional term)
  // --------------------------------------------------
  const { data: classRow, error: classErr } = await supabase
    .from("classes")
    .select("id, department_id, academic_term_id")
    .eq("id", class_id)
    .maybeSingle()

  if (classErr || !classRow) {
    throw createError({ statusCode: 400, message: "Class not found." })
  }

  const scheduleDepartmentId = classRow.department_id
  let academic_term_id = termFromBody || classRow.academic_term_id

  if (!academic_term_id) {
    throw createError({ statusCode: 400, message: "Academic term is required for schedule." })
  }

  // --------------------------------------------------
  // 3️⃣ Detect GENED dean role
  // --------------------------------------------------
  if (userRole === "DEAN" && userDepartmentId) {
    const { data: deptRow } = await supabase
      .from("departments")
      .select("type")
      .eq("id", userDepartmentId)
      .maybeSingle()

    if (deptRow?.type === "GENED") {
      userRole = "GENED"
    }
  }

  // --------------------------------------------------
  // 4️⃣ Permissions
  // --------------------------------------------------
  if (userRole === "ADMIN") {
    throw createError({ statusCode: 403, message: "Admins cannot modify schedules." })
  }

  if (userRole === "FACULTY") {
    throw createError({ statusCode: 403, message: "Faculty cannot modify schedules." })
  }

  // Program Dean: only schedule inside their own department (via CLASS)
  if (userRole === "DEAN") {
    if (!userDepartmentId || userDepartmentId !== scheduleDepartmentId) {
      throw createError({
        statusCode: 403,
        message: "You can only schedule classes in your own department."
      })
    }
  }

  // GenEd dean: only for GenEd subjects
  if (userRole === "GENED") {
    const { data: subjectRow, error: subjErr } = await supabase
      .from("subjects")
      .select("is_gened")
      .eq("id", subject_id)
      .maybeSingle()

    if (subjErr || !subjectRow?.is_gened) {
      throw createError({
        statusCode: 403,
        message: "GenEd Dean can only schedule General Education subjects."
      })
    }
  }

  // --------------------------------------------------
  // 5️⃣ Load periods (for slot_index mapping)
  // --------------------------------------------------
  const { data: periodRows, error: periodErr } = await supabase
    .from("periods")
    .select("id, slot_index")

  if (periodErr || !periodRows || periodRows.length === 0) {
    throw createError({ statusCode: 500, message: "Periods not configured." })
  }

  const periodSlotMap = new Map<string, number>()
  periodRows.forEach((p: any) => {
    periodSlotMap.set(p.id, p.slot_index)
  })

  const startIndex = periodSlotMap.get(period_start_id)
  const endIndex = periodSlotMap.get(period_end_id)

  if (startIndex == null || endIndex == null) {
    throw createError({ statusCode: 400, message: "Invalid period selected." })
  }

  const minIndex = Math.min(startIndex, endIndex)
  const maxIndex = Math.max(startIndex, endIndex)

  // --------------------------------------------------
  // 6️⃣ Conflict detection (Class / Room / Faculty)
  // --------------------------------------------------

  // Build base query (same day + term + not deleted)
  let conflictReq = supabase
    .from("schedules")
    .select("*")
    .eq("day", day)
    .eq("academic_term_id", academic_term_id)
    .eq("is_deleted", false)

  // Exclude self if updating
  if (id) {
    conflictReq = conflictReq.neq("id", id)
  }

  // Build OR filters for class / faculty / room
  const orParts: string[] = [`class_id.eq.${class_id}`]
  if (faculty_id) orParts.push(`faculty_id.eq.${faculty_id}`)
  if (room_id) orParts.push(`room_id.eq.${room_id}`)

  if (orParts.length > 0) {
    conflictReq = conflictReq.or(orParts.join(","))
  }

  const { data: possibleConflicts, error: conflictErr } = await conflictReq

  if (conflictErr) {
    throw createError({ statusCode: 500, message: conflictErr.message })
  }

  const classConflicts: any[] = []
  const roomConflicts: any[] = []
  const facultyConflicts: any[] = []

  if (possibleConflicts) {
    for (const s of possibleConflicts) {
      const sStart = periodSlotMap.get(s.period_start_id)
      const sEnd = periodSlotMap.get(s.period_end_id)
      if (sStart == null || sEnd == null) continue

      const sMin = Math.min(sStart, sEnd)
      const sMax = Math.max(sStart, sEnd)

      const overlaps = !(sMax < minIndex || sMin > maxIndex)
      if (!overlaps) continue

      if (s.class_id === class_id) classConflicts.push(s)
      if (room_id && s.room_id === room_id) roomConflicts.push(s)
      if (faculty_id && s.faculty_id === faculty_id) facultyConflicts.push(s)
    }
  }

  const hardConflicts = [...classConflicts, ...roomConflicts]
  // Deduplicate by id
  const hardIds = Array.from(new Set(hardConflicts.map((c) => c.id)))

  // Class + Room: HARD conflict → require force
  if (hardIds.length > 0 && !force) {
    return {
      conflict: true,
      type: "HARD",
      class_conflicts: classConflicts,
      room_conflicts: roomConflicts,
      faculty_conflicts: facultyConflicts,
      message: "⚠ Conflict detected — click 'Replace' to override existing class/room schedules."
    }
  }

  // --------------------------------------------------
  // 7️⃣ If force: soft-delete conflicting class/room schedules
  // --------------------------------------------------
  if (hardIds.length > 0 && force) {
    const { error: delErr } = await supabase
      .from("schedules")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .in("id", hardIds)

    if (delErr) {
      throw createError({ statusCode: 500, message: delErr.message })
    }

    // log bulk replace
    for (const conflict of hardConflicts) {
      await supabase.from("schedule_history").insert({
        schedule_id: conflict.id,
        action: "FORCE_REPLACE",
        old_data: conflict,
        new_data: null,
        performed_by: actorId
      })
    }
  }

  // --------------------------------------------------
  // 8️⃣ Insert or Update schedule
  // --------------------------------------------------
  const nowIso = new Date().toISOString()
  let scheduleId = id
  let oldSchedule: any = null

  if (id) {
    // Load old data for history
    const { data: oldRow } = await supabase
      .from("schedules")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    oldSchedule = oldRow || null

    const { error: updErr } = await supabase
      .from("schedules")
      .update({
        class_id,
        subject_id,
        faculty_id,
        room_id,
        day,
        period_start_id,
        period_end_id,
        academic_term_id,
        mode,
        department_id: scheduleDepartmentId,
        updated_at: nowIso
      })
      .eq("id", id)

    if (updErr) throw createError({ statusCode: 500, message: updErr.message })
  } else {
    const { data: insertRes, error: insErr } = await supabase
      .from("schedules")
      .insert({
        class_id,
        subject_id,
        faculty_id,
        room_id,
        day,
        period_start_id,
        period_end_id,
        academic_term_id,
        mode,
        department_id: scheduleDepartmentId,
        created_by: actorId,
        created_at: nowIso,
        updated_at: nowIso,
        status: "PUBLISHED",
        is_deleted: false
      })
      .select("id")
      .single()

    if (insErr) throw createError({ statusCode: 500, message: insErr.message })
    scheduleId = insertRes.id
  }

  if (!scheduleId) {
    throw createError({ statusCode: 500, message: "Failed to save schedule." })
  }

  // --------------------------------------------------
  // 9️⃣ Update schedule_periods (expand range)
  // --------------------------------------------------
  // Delete old rows for this schedule
  await supabase
    .from("schedule_periods")
    .delete()
    .eq("schedule_id", scheduleId)

  // Collect period ids in the range
  const rangePeriodIds = periodRows
    .filter((p: any) => {
      const idx = p.slot_index
      return idx >= minIndex && idx <= maxIndex
    })
    .map((p: any) => p.id)

  if (rangePeriodIds.length > 0) {
    const toInsert = rangePeriodIds.map((pid: string) => ({
      schedule_id: scheduleId,
      day,
      period_id: pid
    }))

    const { error: spErr } = await supabase
      .from("schedule_periods")
      .insert(toInsert)

    if (spErr) {
      throw createError({ statusCode: 500, message: spErr.message })
    }
  }

  // --------------------------------------------------
  // 🔟 Log history for this save
  // --------------------------------------------------
  await supabase.from("schedule_history").insert({
    schedule_id: scheduleId,
    action: id ? "UPDATE" : "CREATE",
    old_data: oldSchedule,
    new_data: {
      class_id,
      subject_id,
      faculty_id,
      room_id,
      day,
      period_start_id,
      period_end_id,
      academic_term_id,
      mode,
      department_id: scheduleDepartmentId
    },
    performed_by: actorId
  })

  return {
    success: true,
    id: scheduleId,
    replaced: force && hardIds.length > 0,
    faculty_conflict: facultyConflicts.length > 0,
    faculty_conflicts: facultyConflicts
  }
})
