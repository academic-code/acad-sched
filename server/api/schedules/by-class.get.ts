// server/api/schedules/by-class.get.ts
import { getQuery, createError } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const query = getQuery(event)

  const class_id = query.class_id?.toString()
  const academic_term_id = query.academic_term_id?.toString()

  if (!class_id) throw createError({ statusCode: 400, message: "class_id required." })
  if (!academic_term_id) throw createError({ statusCode: 400, message: "academic_term_id required." })

  // ---- Auth ----
  const authHeader = event.node.req.headers.authorization
  const token = authHeader?.replace("Bearer ", "") ?? null
  if (!token) throw createError({ statusCode: 401, message: "Missing token." })

  const { data: authData } = await supabase.auth.getUser(token)
  if (!authData?.user) throw createError({ statusCode: 401, message: "Unauthorized." })

  // ---- Query ----
  const { data, error } = await supabase
    .from("schedules")
    .select(`
      id,
      day,
      mode,
      is_deleted,
      period_start:period_start_id(id, start_time, slot_index),
      period_end:period_end_id(id, end_time, slot_index),

      subject:subjects(id, course_code, description, units),
      room:rooms(id, name),
      faculty:faculty(id, first_name, last_name),
      class:classes(id, class_name, year_level_label, section)
    `)
    .eq("class_id", class_id)
    .eq("academic_term_id", academic_term_id)
    .eq("is_deleted", false)
    .order("day")
    .order("period_start.slot_index")

  if (error) throw createError({ statusCode: 500, message: error.message })

  return data
})
