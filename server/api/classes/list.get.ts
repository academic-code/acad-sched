// server/api/classes/list.get.ts
import { getQuery, createError } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const query = getQuery(event)

  // ----------------------------------------------------------
  // 1️⃣ Get Supabase session token from request headers
  // ----------------------------------------------------------
  const authHeader = event.node.req.headers.authorization
  const token = authHeader?.replace("Bearer ", "") ?? null

  if (!token) {
    throw createError({ statusCode: 401, message: "Missing auth token." })
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token)

  if (authError || !authData?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }

  const loggedInUser = authData.user

  // ----------------------------------------------------------
  // 2️⃣ Fetch role & department of logged-in user
  // ----------------------------------------------------------
  const { data: userRecord, error: roleError } = await supabase
    .from("users")
    .select("role, department_id")
    .eq("auth_user_id", loggedInUser.id)
    .maybeSingle()

  if (roleError || !userRecord) {
    throw createError({ statusCode: 403, message: "User role not found." })
  }

  let userRole = userRecord.role.toUpperCase()
  const userDepartmentId = userRecord.department_id

  // 🔍 Detect if user is actually a GENED dean
  if (userRole === "DEAN" && userDepartmentId) {
    const { data: dept } = await supabase
      .from("departments")
      .select("type")
      .eq("id", userDepartmentId)
      .maybeSingle()

    if (dept?.type === "GENED") {
      userRole = "GENED"
    }
  }

  // ----------------------------------------------------------
  // 3️⃣ Apply optional filters from UI
  // ----------------------------------------------------------
  const academicTermId = query.academic_term_id?.toString() || ""
  const includeArchived = query.include_archived === "true"
  const filterDepartmentId = query.department_id?.toString() || ""

  // ----------------------------------------------------------
  // 4️⃣ Base query
  // ----------------------------------------------------------
  let request = supabase.from("classes").select("*")

  // ----------------------------------------------------------
  // 5️⃣ Role-Based Visibility Logic
  // ----------------------------------------------------------

  if (userRole === "ADMIN") {
    // Admin sees everything
    if (filterDepartmentId) {
      request = request.eq("department_id", filterDepartmentId)
    }
  }

  else if (userRole === "GENED") {
    // GenEd dean sees all departments (optional filter supported)
    if (filterDepartmentId) {
      request = request.eq("department_id", filterDepartmentId)
    }
  }

  else if (userRole === "DEAN") {
    // Regular dean sees only their own department
    request = request.eq("department_id", userDepartmentId)
  }

  else if (userRole === "FACULTY") {
    throw createError({ statusCode: 403, message: "Faculty cannot view classes." })
  }

  // ----------------------------------------------------------
  // 6️⃣ Filter Academic Term
  // ----------------------------------------------------------
  if (academicTermId) {
    request = request.eq("academic_term_id", academicTermId)
  }

  // ----------------------------------------------------------
  // 7️⃣ Hide archived by default
  // ----------------------------------------------------------
  if (!includeArchived) {
    request = request.eq("is_archived", false)
  }

  // ----------------------------------------------------------
  // 8️⃣ Sort results
  // ----------------------------------------------------------
  const { data, error } = await request
    .order("year_level_number", { ascending: true })
    .order("section", { ascending: true })
    .order("program_name", { ascending: true })

  if (error) {
    console.error(error)
    throw createError({ statusCode: 500, message: error.message })
  }

  return data || []
})
