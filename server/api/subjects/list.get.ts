import { getQuery, createError } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const query = getQuery(event)

  // ---- 1️⃣ AUTH ----
  const authHeader = event.node.req.headers.authorization
  const token = authHeader?.replace("Bearer ", "") ?? null

  if (!token) {
    throw createError({ statusCode: 401, message: "Missing auth token." })
  }

  const { data: authData } = await supabase.auth.getUser(token)
  if (!authData?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }

  // ---- 2️⃣ USER ROLE + DEPARTMENT ----
  const { data: userRow } = await supabase
    .from("users")
    .select("role, department_id")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle()

  if (!userRow) throw createError({ statusCode: 403, message: "User role not found." })

  let userRole = userRow.role.toUpperCase()
  const userDept = userRow.department_id

  // Detect if the DEAN belongs to GENED department → promote to GENED role
  if (userRole === "DEAN" && userDept) {
    const { data: dept } = await supabase
      .from("departments")
      .select("type")
      .eq("id", userDept)
      .maybeSingle()

    if (dept?.type === "GENED") {
      userRole = "GENED"
    }
  }

  // ---- 3️⃣ BUILD QUERY ----
  let request = supabase.from("subjects").select("*")

  if (userRole === "ADMIN") {
    // sees everything
  }

  else if (userRole === "GENED") {
    // Sees ONLY GenEd subjects from ANY department
    request = request.eq("is_gened", true)
  }

  else if (userRole === "DEAN") {
    // Sees ONLY subjects from their own department (Major + GenEd)
    request = request.eq("department_id", userDept)
  }

  else {
    throw createError({ statusCode: 403, message: "Forbidden." })
  }

  // ---- 4️⃣ SORT ----
  const { data, error } = await request
    .order("year_level_number", { ascending: true })
    .order("semester", { ascending: true })
    .order("course_code", { ascending: true })

  if (error) throw createError({ statusCode: 500, message: error.message })

  return data || []
})
