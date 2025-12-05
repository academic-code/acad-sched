// server/api/subjects/list.get.ts
import { getQuery } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!

  const query = getQuery(event)
  const role = query.role?.toString() || "ADMIN"
  const departmentId = query.department_id?.toString() || ""

  let q = supabase.from("subjects").select("*")

  if (role === "DEAN" && departmentId) {
    q = q.eq("department_id", departmentId)
  }

  const { data, error } = await q.order("course_code")

  if (error) {
    return { error: error.message }
  }

  return data
})
