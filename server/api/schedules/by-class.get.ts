// server/api/schedules/by-class.get.ts
import { getQuery, createError } from "h3"
import {
  extractBearerToken,
  getAppUserRecord,
  resolveNormalizedRole,
  normalizeDay,
  formatScheduleForResponse
} from "./_helpers"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const q = getQuery(event)

  const class_id = q.class_id?.toString()
  const academic_term_id = q.academic_term_id?.toString()

  if (!class_id) throw createError({ statusCode: 400, message: "class_id required." })
  if (!academic_term_id) throw createError({ statusCode: 400, message: "academic_term_id required." })

  const token = extractBearerToken(event)
  if (!token) throw createError({ statusCode: 401, message: "Missing token." })

  const { userRecord } = await getAppUserRecord(supabase, token)
  const normalizedRole = await resolveNormalizedRole(supabase, userRecord)
  const userDeptId = userRecord.department_id

  // DEAN: can only view classes inside their own department
  if (normalizedRole === "DEAN") {
    const { data: cls, error } = await supabase
      .from("classes")
      .select("department_id")
      .eq("id", class_id)
      .maybeSingle()

    if (error) throw createError({ statusCode: 500, message: "Failed to load class." })
    if (!cls) throw createError({ statusCode: 404, message: "Class not found." })
    if (cls.department_id !== userDeptId) {
      throw createError({ statusCode: 403, message: "Dean can only view classes in their own department." })
    }
  }

  const { data, error } = await supabase
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
      is_deleted,

      class:classes(id, class_name, year_level_label, section),
      subject:subjects(id, course_code, description, units, is_gened, department_id),
      faculty:faculty(id, first_name, last_name),
      room:rooms(id, name),

      period_start:periods!schedules_period_start_id_fkey(id, slot_index, start_time, end_time),
      period_end:periods!schedules_period_end_id_fkey(id, slot_index, start_time, end_time)
    `)
    .eq("class_id", class_id)
    .eq("academic_term_id", academic_term_id)
    .eq("is_deleted", false)
    .order("day", { ascending: true })
    .order("period_start(slot_index)", { ascending: true })

  if (error) throw createError({ statusCode: 500, message: error.message })

  return (data || []).map((row) =>
    formatScheduleForResponse(normalizedRole, userRecord, { ...row, day: normalizeDay(row.day) })
  )
})
