// server/api/schedules/create.post.ts
import { readBody, createError } from "h3"

type CreateScheduleBody = {
  class_id: string
  subject_id: string
  faculty_id?: string | null
  room_id?: string | null
  period_start_id: string
  period_end_id: string
  day: string // e.g. 'MON', 'TUE'
  mode?: string // 'F2F' | 'ONLINE' | 'ASYNC'
  academic_term_id?: string // optional: will auto-fill from class if missing
  force?: boolean // allow teacher/room conflicts when true
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  // inclusive ranges using slot_index (1..n)
  return aStart <= bEnd && bStart <= aEnd
}

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody<CreateScheduleBody>(event)

  // ------------------ 1️⃣ Basic payload validation ------------------
  const {
    class_id,
    subject_id,
    faculty_id,
    room_id,
    period_start_id,
    period_end_id,
    day,
    mode,
    academic_term_id: bodyTermId,
    force
  } = body

  if (!class_id) throw createError({ statusCode: 400, message: "class_id is required." })
  if (!subject_id) throw createError({ statusCode: 400, message: "subject_id is required." })
  if (!period_start_id || !period_end_id) {
    throw createError({ statusCode: 400, message: "period_start_id and period_end_id are required." })
  }
  if (!day) throw createError({ statusCode: 400, message: "day is required." })

  // ------------------ 2️⃣ Auth + actor role ------------------
  const authHeader = event.node.req.headers.authorization
  const token = authHeader?.replace("Bearer ", "") ?? null
  if (!token) throw createError({ statusCode: 401, message: "Missing auth token." })

  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized." })
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

  // ------------------ 3️⃣ Load core entities (class, subject, term, periods) ------------------
  // Class
  const { data: classRow, error: classErr } = await supabase
    .from("classes")
    .select("id, department_id, academic_term_id")
    .eq("id", class_id)
    .maybeSingle()

  if (classErr || !classRow) {
    throw createError({ statusCode: 400, message: "Class not found." })
  }

  // Subject
  const { data: subjectRow, error: subjectErr } = await supabase
    .from("subjects")
    .select("id, department_id, is_gened")
    .eq("id", subject_id)
    .maybeSingle()

  if (subjectErr || !subjectRow) {
    throw createError({ statusCode: 400, message: "Subject not found." })
  }

  // Academic term: prefer body.academic_term_id, else from class
  const academic_term_id = bodyTermId || classRow.academic_term_id
  if (!academic_term_id) {
    throw createError({
      statusCode: 400,
      message: "academic_term_id is required (or must be set on the class)."
    })
  }

  const { data: termRow, error: termErr } = await supabase
    .from("academic_terms")
    .select("id, is_active")
    .eq("id", academic_term_id)
    .maybeSingle()

  if (termErr || !termRow) {
    throw createError({ statusCode: 400, message: "Academic term not found." })
  }
  if (!termRow.is_active) {
    throw createError({ statusCode: 400, message: "Cannot create schedules in an inactive term." })
  }

  // Periods (for slot_index)
  const { data: periods, error: periodsErr } = await supabase
    .from("periods")
    .select("id, slot_index")
    .in("id", [period_start_id, period_end_id])

  if (periodsErr || !periods || periods.length !== 2) {
    throw createError({
      statusCode: 400,
      message: "Invalid period_start_id or period_end_id."
    })
  }

  const startPeriod = periods.find((p) => p.id === period_start_id)!
  const endPeriod = periods.find((p) => p.id === period_end_id)!
  const startSlot = Math.min(startPeriod.slot_index, endPeriod.slot_index)
  const endSlot = Math.max(startPeriod.slot_index, endPeriod.slot_index)

  // Department for this schedule: always from CLASS department
  const scheduleDepartmentId = classRow.department_id

  // ------------------ 4️⃣ Normalize user role (detect GENED dean) ------------------
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

  // ------------------ 5️⃣ Role-based permission rules ------------------
  if (userRole === "FACULTY") {
    throw createError({ statusCode: 403, message: "Faculty cannot create schedules." })
  }

  if (userRole === "DEAN") {
    if (!userDepartmentId) {
      throw createError({
        statusCode: 403,
        message: "Dean has no department assigned."
      })
    }

    // Class must belong to dean's department
    if (scheduleDepartmentId !== userDepartmentId) {
      throw createError({
        statusCode: 403,
        message: "You can only schedule classes within your own department."
      })
    }

    // Subject must belong to dean's department
    if (subjectRow.department_id !== userDepartmentId) {
      throw createError({
        statusCode: 403,
        message: "You can only schedule subjects belonging to your department."
      })
    }

    // Dean schedules MAJOR subjects only (no GenEd)
    if (subjectRow.is_gened) {
      throw createError({
        statusCode: 403,
        message: "Program deans cannot schedule GenEd subjects. Please coordinate with the GenEd dean."
      })
    }
  }

  if (userRole === "GENED") {
    // GenEd dean can schedule ONLY GenEd subjects
    if (!subjectRow.is_gened) {
      throw createError({
        statusCode: 403,
        message: "GenEd dean can only schedule GenEd subjects."
      })
    }
    // Class can be from any department — allowed
  }

  // ADMIN: no extra restrictions

  // ------------------ 6️⃣ Conflict detection ------------------
  const warnings: string[] = []

  // Helper to fetch existing schedules with slot_index ranges
  async function fetchSchedules(filter: Record<string, any>) {
    let req = supabase
      .from("schedules")
      .select(`
        id,
        day,
        is_deleted,
        period_start:period_start_id(slot_index),
        period_end:period_end_id(slot_index)
      `)
      .eq("academic_term_id", academic_term_id)
      .eq("is_deleted", false)
      .eq("day", day)

    for (const [key, value] of Object.entries(filter)) {
      req = req.eq(key, value)
    }

    const { data, error } = await req
    if (error) {
      throw createError({ statusCode: 500, message: error.message })
    }
    return data || []
  }

  // 6.1 Class conflicts → always BLOCK
  const classSchedules = await fetchSchedules({ class_id })
  for (const s of classSchedules as any[]) {
    const sStart = s.period_start?.slot_index
    const sEnd = s.period_end?.slot_index
    if (sStart == null || sEnd == null) continue
    if (rangesOverlap(startSlot, endSlot, sStart, sEnd)) {
      throw createError({
        statusCode: 409,
        message: "This class already has a schedule at the selected time.",
        data: {
          type: "CLASS_CONFLICT",
          schedule_id: s.id
        } as any
      })
    }
  }

  // 6.2 Faculty conflicts → soft-flex
  let teacherConflicts: any[] = []
  if (faculty_id) {
    teacherConflicts = await fetchSchedules({ faculty_id })
    teacherConflicts = (teacherConflicts as any[]).filter((s) => {
      const sStart = s.period_start?.slot_index
      const sEnd = s.period_end?.slot_index
      if (sStart == null || sEnd == null) return false
      return rangesOverlap(startSlot, endSlot, sStart, sEnd)
    })

    if (teacherConflicts.length > 0 && !force) {
      throw createError({
        statusCode: 409,
        message: "Teacher is already booked at this time.",
        data: {
          type: "FACULTY_CONFLICT",
          conflicts: teacherConflicts.map((c) => c.id)
        } as any
      })
    }

    if (teacherConflicts.length > 0 && force) {
      warnings.push("Teacher is already booked at this time.")
    }
  }

  // 6.3 Room conflicts → soft-flex
  let roomConflicts: any[] = []
  if (room_id) {
    roomConflicts = await fetchSchedules({ room_id })
    roomConflicts = (roomConflicts as any[]).filter((s) => {
      const sStart = s.period_start?.slot_index
      const sEnd = s.period_end?.slot_index
      if (sStart == null || sEnd == null) return false
      return rangesOverlap(startSlot, endSlot, sStart, sEnd)
    })

    if (roomConflicts.length > 0 && !force) {
      throw createError({
        statusCode: 409,
        message: "Room is already used at this time.",
        data: {
          type: "ROOM_CONFLICT",
          conflicts: roomConflicts.map((c) => c.id)
        } as any
      })
    }

    if (roomConflicts.length > 0 && force) {
      warnings.push("Room is already used at this time.")
    }
  }

  // ------------------ 7️⃣ Insert schedule ------------------
  const schedulePayload = {
    class_id,
    subject_id,
    faculty_id: faculty_id || null,
    room_id: room_id || null,
    department_id: scheduleDepartmentId,
    period_start_id,
    period_end_id,
    day,
    mode: mode || "F2F",
    academic_term_id,
    status: "PUBLISHED",
    is_deleted: false,
    created_by: actorId
  }

  const { data: insertedRows, error: insertErr } = await supabase
    .from("schedules")
    .insert(schedulePayload)
    .select("*")
    .maybeSingle()

  if (insertErr || !insertedRows) {
    throw createError({
      statusCode: 500,
      message: insertErr?.message || "Failed to create schedule."
    })
  }

  const newSchedule = insertedRows

  // ------------------ 8️⃣ Write schedule_history (CREATE) ------------------
  await supabase.from("schedule_history").insert({
    schedule_id: newSchedule.id,
    action: "CREATE",
    old_data: null,
    new_data: newSchedule,
    performed_by: actorId
  })

  // ------------------ 9️⃣ UNDO support (10 seconds via created_at check later) ------------------
  // We simply return the id; undo endpoint will check created_at window.
  return {
    success: true,
    schedule: newSchedule,
    warnings,
    undo_id: newSchedule.id
  }
})
