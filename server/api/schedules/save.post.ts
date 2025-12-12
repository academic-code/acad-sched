// server/api/schedules/save.post.ts
import { readBody, createError } from "h3"
import {
  extractBearerToken,
  getAppUserRecord,
  resolveNormalizedRole,
  normalizeDay
} from "./_helpers"
import { ConflictEngine } from "./conflict-engine"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody<any>(event)

  const {
    id,
    class_id,
    subject_id,
    faculty_id = null,
    room_id = null,
    day,
    period_start_id,
    period_end_id,
    academic_term_id: termFromClient,
    mode = "F2F",
    force = false
  } = body || {}

  if (!class_id) throw createError({ statusCode: 400, message: "class_id is required." })
  if (!subject_id) throw createError({ statusCode: 400, message: "subject_id is required." })
  if (!day) throw createError({ statusCode: 400, message: "day is required." })
  if (!period_start_id || !period_end_id) {
    throw createError({ statusCode: 400, message: "period_start_id and period_end_id are required." })
  }

  if (room_id && String(mode).toUpperCase() !== "F2F") {
    throw createError({ statusCode: 400, message: "Rooms are only allowed for F2F mode." })
  }

  // normalize day once (ScheduleDay)
  const normalizedDay = normalizeDay(day || "")

  // AUTH
  const token = extractBearerToken(event)
  if (!token) throw createError({ statusCode: 401, message: "Missing auth token." })

  const { userRecord, authUser } = await getAppUserRecord(supabase, token)
  const normalizedRole = await resolveNormalizedRole(supabase, userRecord)
  const actorId = userRecord.id
  const userDeptId = userRecord.department_id

  // Load class
  const { data: classRow, error: classErr } = await supabase
    .from("classes")
    .select("id, department_id, academic_term_id")
    .eq("id", class_id)
    .maybeSingle()

  if (classErr) throw createError({ statusCode: 500, message: classErr.message })
  if (!classRow) throw createError({ statusCode: 404, message: "Class not found." })

  const scheduleDepartmentId = classRow.department_id
  const academic_term_id = termFromClient || classRow.academic_term_id
  if (!academic_term_id) {
    throw createError({ statusCode: 400, message: "academic_term_id missing (no class term fallback)." })
  }

  // Load subject
  const { data: subjectRow, error: subjErr } = await supabase
    .from("subjects")
    .select("id, department_id, is_gened")
    .eq("id", subject_id)
    .maybeSingle()

  if (subjErr) throw createError({ statusCode: 500, message: subjErr.message })
  if (!subjectRow) throw createError({ statusCode: 404, message: "Subject not found." })

  // Permission rules
  if (normalizedRole === "ADMIN") throw createError({ statusCode: 403, message: "Admins cannot modify schedules." })
  if (normalizedRole === "FACULTY") throw createError({ statusCode: 403, message: "Faculty cannot modify schedules." })

  if (normalizedRole === "DEAN") {
    if (!userDeptId) throw createError({ statusCode: 403, message: "Dean has no department." })
    if (scheduleDepartmentId !== userDeptId) throw createError({ statusCode: 403, message: "Dean can only schedule for classes in their department." })
    if (subjectRow.is_gened) throw createError({ statusCode: 403, message: "Program Deans cannot schedule GenEd subjects." })
    if (subjectRow.department_id !== userDeptId) throw createError({ statusCode: 403, message: "Dean can only schedule subjects from their department." })
  }

  if (normalizedRole === "GENED") {
    if (!subjectRow.is_gened) throw createError({ statusCode: 403, message: "GenEd dean can only schedule GenEd subjects." })
  }

  // ROOM sharing policy
  const conflictEngine = new ConflictEngine(supabase)

  if (room_id) {
    const roomPolicyCheck = await conflictEngine.validateRoomSharingPolicy({
      room_id,
      day: normalizedDay,
      period_start_id,
      period_end_id,
      academic_term_id,
      excludeScheduleId: id ?? null
    })

    if (!roomPolicyCheck.ok && !force) {
      return {
        conflict: true,
        type: "ROOM_PRIVATE",
        message: "Room is PRIVATE and already booked.",
        room_conflicts: roomPolicyCheck.conflicts
      }
    }
  }

  // Full conflict detection
  const conflicts = await conflictEngine.findConflicts({
    class_id,
    faculty_id,
    room_id,
    day: normalizedDay,
    period_start_id,
    period_end_id,
    academic_term_id,
    excludeScheduleId: id ?? null
  })

  if (conflicts.hard.length > 0 && !force) {
    return {
      conflict: true,
      type: "HARD",
      class_conflicts: conflicts.classConflicts,
      room_conflicts: conflicts.roomConflicts,
      faculty_conflicts: conflicts.facultyConflicts,
      message: "⛔ Hard conflict — requires force=true"
    }
  }

  if (conflicts.soft.length > 0 && !force) {
    return {
      conflict: true,
      type: "SOFT",
      faculty_conflicts: conflicts.facultyConflicts,
      message: "👩‍🏫 Faculty conflict — set force=true to replace."
    }
  }

  // Force delete if forced
  if (force) {
    const toDelete = [
      ...conflicts.roomConflicts.map(c => c.id),
      ...conflicts.facultyConflicts.map(c => c.id)
    ]

    if (toDelete.length > 0) {
      await conflictEngine.softDeleteConflicts(toDelete, actorId)
      await supabase.from("schedule_periods").delete().in("schedule_id", toDelete)
    }
  }

  // Insert or update
  const nowIso = new Date().toISOString()
  let scheduleId = id
  let oldSchedule = null

  if (id) {
    const { data: oldRow } = await supabase
      .from("schedules")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    oldSchedule = oldRow

    const { error: updErr } = await supabase
      .from("schedules")
      .update({
        class_id,
        subject_id,
        faculty_id,
        room_id,
        day: normalizedDay,
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
    const { data: insertRow, error: insErr } = await supabase
      .from("schedules")
      .insert({
        class_id,
        subject_id,
        faculty_id,
        room_id,
        day: normalizedDay,
        period_start_id,
        period_end_id,
        academic_term_id,
        mode,
        department_id: scheduleDepartmentId,
        status: "PUBLISHED",
        is_deleted: false,
        created_by: actorId,
        created_at: nowIso,
        updated_at: nowIso
      })
      .select("id")
      .single()

    if (insErr) throw createError({ statusCode: 500, message: insErr.message })
    scheduleId = insertRow.id
  }

  if (!scheduleId) throw createError({ statusCode: 500, message: "Failed to save schedule." })

  // Rebuild schedule_periods
  await supabase.from("schedule_periods").delete().eq("schedule_id", scheduleId)

  const slotMap = await conflictEngine.loadSlotMap()
  const startSlot = slotMap.get(String(period_start_id))!
  const endSlot = slotMap.get(String(period_end_id))!
  const minSlot = Math.min(startSlot, endSlot)
  const maxSlot = Math.max(startSlot, endSlot)

  const periodIdsInRange: string[] = []
  for (const [pid, slot] of slotMap.entries()) {
    if (slot >= minSlot && slot <= maxSlot) periodIdsInRange.push(pid)
  }

  if (periodIdsInRange.length > 0) {
    const batch = periodIdsInRange.map(pid => ({
      schedule_id: scheduleId,
      day: normalizedDay,
      period_id: pid
    }))
    const { error: spErr } = await supabase.from("schedule_periods").insert(batch)
    if (spErr) throw createError({ statusCode: 500, message: spErr.message })
  }

  // History
  await supabase.from("schedule_history").insert({
    schedule_id: scheduleId,
    action: id ? "UPDATE" : "CREATE",
    old_data: oldSchedule,
    new_data: {
      class_id,
      subject_id,
      faculty_id,
      room_id,
      day: normalizedDay,
      period_start_id,
      period_end_id,
      academic_term_id,
      mode,
      department_id: scheduleDepartmentId
    },
    performed_by: actorId,
    performed_at: nowIso
  })

  return {
    success: true,
    id: scheduleId,
    replaced: force && (conflicts.hard.length > 0 || conflicts.soft.length > 0)
  }
})
