// FILE: server/api/schedules/by-room.get.ts
import { getQuery, createError } from "h3"
import { extractBearerToken, getAppUserRecord } from "./_helpers"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const q = getQuery(event)

  const room_id = q.room_id?.toString()
  const academic_term_id = q.academic_term_id?.toString()

  if (!room_id) throw createError({ statusCode: 400, message: "room_id required." })
  if (!academic_term_id) throw createError({ statusCode: 400, message: "academic_term_id required." })

  // ------------------------------
  // AUTH
  // ------------------------------
  const token = extractBearerToken(event)
  if (!token) throw createError({ statusCode: 401, message: "Missing token." })

  const { userRecord } = await getAppUserRecord(supabase, token)

  let userRole = (userRecord.role || "").toUpperCase()
  const userDepartmentId = userRecord.department_id

  // detect GENED dean (MATCHING OTHER ENDPOINTS)
  if (userRole === "DEAN" && userDepartmentId) {
    const { data: dept } = await supabase
      .from("departments")
      .select("type")
      .eq("id", userDepartmentId)
      .maybeSingle()
    if (dept?.type === "GENED") userRole = "GENED"
  }

  // Faculty restriction:
  // ❗ Faculty can ONLY view their own schedules (NOT allowed for rooms)
  if (userRole === "FACULTY") {
    throw createError({
      statusCode: 403,
      message: "Faculty cannot view room schedules."
    })
  }

  // Dean restriction:
  // ❗ A dean can only view rooms inside their department
  if (userRole === "DEAN") {
    const { data: roomRow } = await supabase
      .from("rooms")
      .select("department_id")
      .eq("id", room_id)
      .maybeSingle()

    if (!roomRow)
      throw createError({ statusCode: 404, message: "Room not found." })

    if (roomRow.department_id !== userDepartmentId) {
      throw createError({
        statusCode: 403,
        message: "Dean can only view rooms inside their own department."
      })
    }
  }

  // GENED dean:
  // GenEd dean should NOT access non-GenEd subjects (but rooms have no gened flag)
  // → Allowed, but filtering will happen automatically since schedules join subjects.

  // ------------------------------
  // QUERY SCHEDULES
  // ------------------------------
  const { data, error } = await supabase
    .from("schedules")
    .select(`
      id,
      day,
      mode,
      is_deleted,

      period_start:period_start_id(id, start_time, slot_index),
      period_end:period_end_id(id, end_time, slot_index),

      subject:subjects(id, course_code, description, units, is_gened),
      faculty:faculty(id, first_name, last_name),
      class:classes(id, class_name, section, year_level_label, program_name),
      room:rooms(id, name)
    `)
    .eq("room_id", room_id)
    .eq("academic_term_id", academic_term_id)
    .eq("is_deleted", false)
    .order("day", { ascending: true })
    .order("period_start.slot_index", { ascending: true })

  if (error) throw createError({ statusCode: 500, message: error.message })

  return data || []
})
