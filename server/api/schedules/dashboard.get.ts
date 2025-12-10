// server/api/schedules/dashboard.get.ts
import { getQuery, createError } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const query = getQuery(event)

  const academic_term_id = query.academic_term_id?.toString() || ""
  const filterDepartmentId = query.department_id?.toString() || ""

  if (!academic_term_id) {
    throw createError({ statusCode: 400, message: "academic_term_id is required." })
  }

  // --------------------------------------------------
  // 1️⃣ Auth → app user + role + department
  // --------------------------------------------------
  const authHeader = event.node.req.headers.authorization
  const token = authHeader?.replace("Bearer ", "") ?? null

  if (!token) {
    throw createError({ statusCode: 401, message: "Missing auth token." })
  }

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

  // --------------------------------------------------
  // 2️⃣ Load academic term (validate exists)
  // --------------------------------------------------
  const { data: termRow, error: termErr } = await supabase
    .from("academic_terms")
    .select("*")
    .eq("id", academic_term_id)
    .maybeSingle()

  if (termErr || !termRow) {
    throw createError({ statusCode: 400, message: "Academic term not found." })
  }

  // --------------------------------------------------
  // 3️⃣ Detect GENED dean
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
  // 4️⃣ Determine access scope
  // --------------------------------------------------
  let allowedDepartmentIds: string[] | null = null
  let limitSchedulesByFacultyId: string | null = null

  if (userRole === "ADMIN") {
    // Admin can see everything, optional filter by department
    if (filterDepartmentId) {
      allowedDepartmentIds = [filterDepartmentId]
    } else {
      allowedDepartmentIds = null // all
    }
  }

  else if (userRole === "GENED") {
    // GenEd dean can see all departments (to edit GenEd schedules for any class)
    if (filterDepartmentId) {
      allowedDepartmentIds = [filterDepartmentId]
    } else {
      allowedDepartmentIds = null // all
    }
  }

  else if (userRole === "DEAN") {
    // Program dean: only their own department
    if (!userDepartmentId) {
      throw createError({
        statusCode: 403,
        message: "Dean has no department assigned."
      })
    }
    allowedDepartmentIds = [userDepartmentId]
  }

  else if (userRole === "FACULTY") {
    // For now: block here; better to use a dedicated faculty timetable endpoint
    throw createError({
      statusCode: 403,
      message: "Faculty timetable uses a separate endpoint."
    })
  }

  else {
    throw createError({ statusCode: 403, message: "Unknown role." })
  }

  // --------------------------------------------------
  // 5️⃣ Fetch core data in parallel
  // --------------------------------------------------

  // Periods (no role restriction)
  const periodsPromise = supabase
    .from("periods")
    .select("*")
    .order("slot_index", { ascending: true })

  // Rooms (filter by department; include shared = NULL)
  const roomsPromise = (async () => {
    let req = supabase.from("rooms").select("*")

    if (allowedDepartmentIds && allowedDepartmentIds.length > 0) {
      // rooms where department_id is in allowed OR null (shared)
      req = req.or(
        [
          "department_id.is.null",
          ...allowedDepartmentIds.map((id) => `department_id.eq.${id}`)
        ].join(",")
      )
    }

    return req.order("name", { ascending: true })
  })()

  // Classes (by term + department scope)
  const classesPromise = (async () => {
    let req = supabase
      .from("classes")
      .select("*")
      .eq("academic_term_id", academic_term_id)
      .eq("is_archived", false)

    if (allowedDepartmentIds && allowedDepartmentIds.length > 0) {
      req = req.in("department_id", allowedDepartmentIds)
    }

    return req
      .order("year_level_number", { ascending: true })
      .order("section", { ascending: true })
      .order("program_name", { ascending: true })
  })()

  // Faculty (by department)
  const facultyPromise = (async () => {
    let req = supabase
      .from("faculty")
      .select("*")
      .eq("is_active", true)

    if (allowedDepartmentIds && allowedDepartmentIds.length > 0) {
      req = req.in("department_id", allowedDepartmentIds)
    }

    return req.order("last_name", { ascending: true })
  })()

  // Subjects (respect subject visibility rules)
  const subjectsPromise = (async () => {
    let req = supabase.from("subjects").select("*")

    if (userRole === "ADMIN") {
      // all subjects, no extra restriction
    } else if (userRole === "GENED") {
      // GenEd dean: ONLY GenEd subjects across all departments
      req = req.eq("is_gened", true)
    } else if (userRole === "DEAN") {
      // Program dean: ALL subjects in their own department (major + their own gened)
      if (!userDepartmentId) {
        throw createError({
          statusCode: 403,
          message: "Dean has no department assigned."
        })
      }
      req = req.eq("department_id", userDepartmentId)
    }

    return req
      .order("year_level_number", { ascending: true })
      .order("semester", { ascending: true })
      .order("course_code", { ascending: true })
  })()

  // Schedules (by term + department scope)
  const schedulesPromise = (async () => {
    let req = supabase
      .from("schedules")
      .select("*")
      .eq("academic_term_id", academic_term_id)
      .eq("is_deleted", false)

    if (allowedDepartmentIds && allowedDepartmentIds.length > 0) {
      req = req.in("department_id", allowedDepartmentIds)
    }

    if (limitSchedulesByFacultyId) {
      req = req.eq("faculty_id", limitSchedulesByFacultyId)
    }

    return req
      .order("day", { ascending: true })
      .order("period_start_id", { ascending: true })
  })()

  const [
    { data: periods, error: periodsErr },
    { data: rooms, error: roomsErr },
    { data: classes, error: classesErr },
    { data: faculty, error: facultyErr },
    { data: subjects, error: subjectsErr },
    { data: schedules, error: schedulesErr }
  ] = await Promise.all([
    periodsPromise,
    roomsPromise,
    classesPromise,
    facultyPromise,
    subjectsPromise,
    schedulesPromise
  ])

  if (periodsErr) throw createError({ statusCode: 500, message: periodsErr.message })
  if (roomsErr) throw createError({ statusCode: 500, message: roomsErr.message })
  if (classesErr) throw createError({ statusCode: 500, message: classesErr.message })
  if (facultyErr) throw createError({ statusCode: 500, message: facultyErr.message })
  if (subjectsErr) throw createError({ statusCode: 500, message: subjectsErr.message })
  if (schedulesErr) throw createError({ statusCode: 500, message: schedulesErr.message })

  // --------------------------------------------------
  // 6️⃣ Return bundle
  // --------------------------------------------------
  return {
    academic_term: termRow,
    periods: periods || [],
    rooms: rooms || [],
    classes: classes || [],
    faculty: faculty || [],
    subjects: subjects || [],
    schedules: schedules || []
  }
})
