// FILE: server/api/schedules/by-faculty.get.ts
import { getQuery, createError } from "h3"
import { extractBearerToken, getAppUserRecord } from "./_helpers"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const q = getQuery(event)

  const faculty_id = q.faculty_id?.toString()
  const academic_term_id = q.academic_term_id?.toString()

  if (!faculty_id) throw createError({ statusCode: 400, message: "faculty_id required." })
  if (!academic_term_id) throw createError({ statusCode: 400, message: "academic_term_id required." })

  // ---------------- AUTH ----------------
  const token = extractBearerToken(event)
  if (!token) throw createError({ statusCode: 401, message: "Missing token." })

  const { userRecord } = await getAppUserRecord(supabase, token)
  const userRole = (userRecord.role || "").toUpperCase()

  // Faculties can only view their own schedules
  if (userRole === "FACULTY" && userRecord.id !== faculty_id) {
    throw createError({ statusCode: 403, message: "Faculty can only view their own schedules." })
  }

  // ---------------- QUERY ----------------
  const { data, error } = await supabase
    .from("schedules")
    .select(`
      id,
      class_id,
      subject_id,
      faculty_id,
      room_id,
      day,
      mode,
      academic_term_id,
      is_deleted,

      class:classes(id, class_name, section, year_level_label, program_name),
      subject:subjects(id, course_code, description, is_gened),
      faculty:faculty(id, first_name, last_name),
      room:rooms(id, name),

      period_start:periods!schedules_period_start_id_fkey(id, slot_index, start_time, end_time),
      period_end:periods!schedules_period_end_id_fkey(id, slot_index, start_time, end_time)
    `)
    .eq("faculty_id", faculty_id)
    .eq("academic_term_id", academic_term_id)
    .eq("is_deleted", false)
    .order("day", { ascending: true })
    .order("period_start.slot_index", { ascending: true })

  if (error) {
    console.error("by-faculty.get error:", error)
    throw createError({ statusCode: 500, message: error.message })
  }

  return data || []
})
