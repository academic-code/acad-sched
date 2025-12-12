// server/api/schedules/by-room.get.ts
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

  const room_id = q.room_id?.toString()
  const academic_term_id = q.academic_term_id?.toString()

  if (!room_id) throw createError({ statusCode: 400, message: "room_id required." })
  if (!academic_term_id) throw createError({ statusCode: 400, message: "academic_term_id required." })

  // ---------------- AUTH ----------------
  const token = extractBearerToken(event)
  if (!token) throw createError({ statusCode: 401, message: "Missing token." })

  const { userRecord } = await getAppUserRecord(supabase, token)
  const normalizedRole = await resolveNormalizedRole(supabase, userRecord)
  const userDeptId = userRecord.department_id

  // ---------------- PERMISSIONS ----------------
  // Faculty cannot view room schedules
  if (normalizedRole === "FACULTY") {
    throw createError({
      statusCode: 403,
      message: "Faculty cannot view room schedules."
    })
  }

  // Program DEAN → can only view rooms inside their own department
  if (normalizedRole === "DEAN") {
    const { data: roomRow, error: roomErr } = await supabase
      .from("rooms")
      .select("department_id")
      .eq("id", room_id)
      .maybeSingle()

    if (roomErr) throw createError({ statusCode: 500, message: "Failed to load room." })
    if (!roomRow) throw createError({ statusCode: 404, message: "Room not found." })

    if (roomRow.department_id !== userDeptId) {
      throw createError({
        statusCode: 403,
        message: "Dean can only view rooms inside their own department."
      })
    }
  }

  // GENED dean → full view allowed

  // ---------------- QUERY SCHEDULES ----------------
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

      class:classes(
        id,
        class_name,
        section,
        year_level_label,
        program_name
      ),

      subject:subjects(
        id,
        course_code,
        description,
        units,
        is_gened,
        department_id
      ),

      faculty:faculty(
        id,
        first_name,
        last_name
      ),

      room:rooms(
        id,
        name
      ),

      period_start:periods!schedules_period_start_id_fkey(
        id,
        start_time,
        end_time,
        slot_index
      ),

      period_end:periods!schedules_period_end_id_fkey(
        id,
        start_time,
        end_time,
        slot_index
      )
    `)
    .eq("room_id", room_id)
    .eq("academic_term_id", academic_term_id)
    .eq("is_deleted", false)
    .order("day", { ascending: true })
    .order("period_start(slot_index)", { ascending: true })

  if (error) {
    console.error("by-room.get error:", error)
    throw createError({ statusCode: 500, message: error.message })
  }

  // ---------------- FORMAT RESPONSE ----------------
  const rows = (data || []).map((row) =>
    formatScheduleForResponse(normalizedRole, userRecord, {
      ...row,
      day: normalizeDay(row.day)
    })
  )

  return rows
})
