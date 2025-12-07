// server/api/subjects/list.get.ts
import { getQuery } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!

  const query = getQuery(event)
  const role = (query.role?.toString() || "ADMIN").toUpperCase()
  const departmentId = query.department_id?.toString() || ""
  const filterDept = query.filter_department_id?.toString() || ""

  let request = supabase.from("subjects").select("*")

  if (role === "DEAN" && departmentId) {
    // Normal dean: ONLY their department’s subjects
    request = request.eq("department_id", departmentId)
  } else if (role === "GENED") {
    // GenEd dean: only GenEd subjects, optional department filter
    request = request.eq("is_gened", true)
    if (filterDept) {
      request = request.eq("department_id", filterDept)
    }
  } else {
    // ADMIN (or anything else): optional department filter only
    if (filterDept) {
      request = request.eq("department_id", filterDept)
    }
  }

  const { data, error } = await request
    .order("year_level_number", { ascending: true })
    .order("semester", { ascending: true })
    .order("course_code", { ascending: true })

  if (error) return { error: error.message }
  return data
})
