// server/api/subjects/list.get.ts
import { getQuery } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!

  const query = getQuery(event)
  const role = query.role?.toString() || "ADMIN"
  const departmentId = query.department_id?.toString() || ""

  let request = supabase.from("subjects").select("*")

  if (role === "DEAN" && departmentId) {
    request = request.or(`department_id.eq.${departmentId},is_gened.eq.true`)
  }

  if (role === "GENED") {
    request = request.eq("is_gened", true)
  }

  const { data, error } = await request.order("created_at", { ascending: false })

  if (error) return { error: error.message }
  return data
})
