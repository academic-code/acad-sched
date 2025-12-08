// server/api/classes/list.get.ts
import { getQuery } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!

  const query = getQuery(event)

  const role = (query.role?.toString() || "DEAN").toUpperCase()
  const departmentId = query.department_id?.toString() || ""
  const academicTermId = query.academic_term_id?.toString() || ""
  const includeArchived = query.include_archived === "true"

  let request = supabase.from("classes").select("*")

  // ----- ROLE-BASED FILTERING -----
  if (role === "DEAN" && departmentId) {
    // Program dean: only their department
    request = request.eq("department_id", departmentId)
  } else if (role === "ADMIN" || role === "GENED") {
    // Admin + GenEd dean: can see all, optional department filter
    if (departmentId) {
      request = request.eq("department_id", departmentId)
    }
  }

  // Filter by academic term if provided
  if (academicTermId) {
    request = request.eq("academic_term_id", academicTermId)
  }

  // Exclude archived by default
  if (!includeArchived) {
    request = request.eq("is_archived", false)
  }

  // Order: Year level ASC, then Section ASC, then Program name ASC
  const { data, error } = await request
    .order("year_level_number", { ascending: true })
    .order("section", { ascending: true })
    .order("program_name", { ascending: true })

  if (error) {
    return { error: error.message }
  }

  return data || []
})
