// server/api/classes/list.get.ts
import { getQuery } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!

  const query = getQuery(event)
  const role = (query.role as string) || "ADMIN"
  const departmentId = (query.department_id as string) || ""

  let q = supabase
    .from("classes")
    .select(`
      id,
      department_id,
      year_level_number,
      year_level_label,
      section,
      class_name,
      adviser_id,
      remarks,
      is_archived,
      academic_term_id,
      academic_term:academic_term_id (
        id,
        semester,
        academic_year,
        label
      ),
      adviser:adviser_id (
        id,
        first_name,
        last_name
      )
    `)
    .order("year_level_number", { ascending: true })
    .order("section", { ascending: true })

  if (role === "DEAN" && departmentId) {
    q = q.eq("department_id", departmentId)
  }

  const { data, error } = await q

  if (error) {
    return { error: error.message }
  }

  const normalized = (data || []).map((row: any) => ({
    ...row,
    academic_term: Array.isArray(row.academic_term)
      ? row.academic_term[0]
      : row.academic_term,
    adviser: Array.isArray(row.adviser) ? row.adviser[0] : row.adviser
  }))

  return normalized
})
