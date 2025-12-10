// server/api/schedules/list.get.ts
import { getQuery, createError } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const query = getQuery(event)

  // -------- 1️⃣ Auth --------
  const authHeader = event.node.req.headers.authorization
  const token = authHeader?.replace("Bearer ", "") ?? null

  if (!token) {
    throw createError({ statusCode: 401, message: "Missing auth token." })
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized." })
  }

  // -------- 2️⃣ User role + department --------
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

  // Detect GenEd dean
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

  // -------- 3️⃣ Resolve view + target --------
  const view = (query.view?.toString() || "CLASS").toUpperCase() // CLASS | FACULTY | ROOM
  const targetId = query.target_id?.toString() || ""

  if (!targetId) {
    throw createError({ statusCode: 400, message: "target_id is required." })
  }

  // -------- 4️⃣ Resolve academic term (active by default) --------
  let academicTermId = query.academic_term_id?.toString() || ""

  if (!academicTermId) {
    const { data: activeTerm, error: termErr } = await supabase
      .from("academic_terms")
      .select("id")
      .eq("is_active", true)
      .maybeSingle()

    if (termErr) {
      throw createError({ statusCode: 500, message: termErr.message })
    }

    if (!activeTerm) {
      throw createError({
        statusCode: 400,
        message: "No active academic term found. Please specify academic_term_id."
      })
    }

    academicTermId = activeTerm.id
  }

  // -------- 5️⃣ Build base query with joins --------
  let request = supabase
    .from("schedules")
    .select(`
      id,
      class_id,
      subject_id,
      faculty_id,
      room_id,
      department_id,
      day,
      mode,
      academic_term_id,
      period_start_id,
      period_end_id,
      is_deleted,
      created_at,
      updated_at,
      class:classes (
        id,
        class_name,
        section,
        year_level_label,
        program_name
      ),
      subject:subjects (
        id,
        course_code,
        description,
        is_gened
      ),
      faculty:faculty (
        id,
        first_name,
        last_name
      ),
      room:rooms (
        id,
        name
      ),
      period_start:periods!schedules_period_start_id_fkey (
        id,
        slot_index,
        start_time,
        end_time
      ),
      period_end:periods!schedules_period_end_id_fkey (
        id,
        slot_index,
        start_time,
        end_time
      )
    `)
    .eq("academic_term_id", academicTermId)
    .eq("is_deleted", false)

  // View filter (class / faculty / room)
  if (view === "CLASS") {
    request = request.eq("class_id", targetId)
  } else if (view === "FACULTY") {
    request = request.eq("faculty_id", targetId)
  } else if (view === "ROOM") {
    request = request.eq("room_id", targetId)
  } else {
    throw createError({ statusCode: 400, message: "Invalid view type." })
  }

  // -------- 6️⃣ Role-based visibility --------
  if (userRole === "FACULTY") {
    // Faculty: can only view their own schedules
    if (view !== "FACULTY" || targetId !== actorId) {
      throw createError({
        statusCode: 403,
        message: "Faculty can only view their own timetable."
      })
    }
  } else if (userRole === "DEAN") {
    // Program dean: only schedules inside their department
    if (!userDepartmentId) {
      throw createError({
        statusCode: 403,
        message: "Dean has no department assigned."
      })
    }
    request = request.eq("department_id", userDepartmentId)
  } else if (userRole === "GENED") {
    // GenEd dean: can see all schedules (since GenEd spans departments)
    // no extra filter
  } else if (userRole === "ADMIN") {
    // Admin: can see all
    // no extra filter
  } else {
    throw createError({ statusCode: 403, message: "Forbidden." })
  }

  // -------- 7️⃣ Execute --------
  const { data, error } = await request
    .order("day", { ascending: true })
    .order("period_start_id", { ascending: true })

  if (error) {
    console.error(error)
    throw createError({ statusCode: 500, message: error.message })
  }

  return data || []
})
