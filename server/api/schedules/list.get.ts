// FILE: server/api/schedules/list.get.ts

import { getQuery, createError } from "h3"
import {
  extractBearerToken,
  getAppUserRecord,
  resolveNormalizedRole,
  getFacultyRowByAuthUser,
  normalizeDay,
  formatScheduleForResponse
} from "./_helpers"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const query = getQuery(event)

  // ---------------- TOKEN / AUTH ----------------
  const token = extractBearerToken(event)
  if (!token) throw createError({ statusCode: 401, message: "Missing auth token." })

  const { userRecord, authUser } = await getAppUserRecord(supabase, token)
  const normalizedRole = await resolveNormalizedRole(supabase, userRecord)
  const userDeptId = userRecord.department_id

  // Faculty mapping
  const facultyRowOfCaller = await getFacultyRowByAuthUser(supabase, authUser.id)
  const requesterFacultyId = facultyRowOfCaller?.id ?? null

  // ---------------- GET PARAMS ----------------
  const view = (query.view?.toString() || "CLASS").toUpperCase()
  const targetId = query.target_id?.toString()
  if (!targetId) throw createError({ statusCode: 400, message: "target_id is required." })

  // academic term (default to active)
  let academicTermId = query.academic_term_id?.toString() || ""
  if (!academicTermId) {
    const { data: activeTerm, error: termErr } = await supabase
      .from("academic_terms")
      .select("id")
      .eq("is_active", true)
      .maybeSingle()

    if (termErr) throw createError({ statusCode: 500, message: "Failed to load active term." })
    if (!activeTerm) throw createError({ statusCode: 400, message: "No active academic term found." })
    academicTermId = activeTerm.id
  }

  // ---------------- ROLE-BASED ACCESS CONTROL ----------------

  // FACULTY → may only view their own schedule
  if (normalizedRole === "FACULTY") {
    if (view !== "FACULTY" || targetId !== requesterFacultyId) {
      throw createError({
        statusCode: 403,
        message: "Faculty can only view their own schedules."
      })
    }
  }

  // PROGRAM DEAN restrictions
  if (normalizedRole === "DEAN") {
    if (!userDeptId) throw createError({ statusCode: 403, message: "Dean has no department." })

    if (view === "CLASS") {
      const { data: cls, error: cErr } = await supabase
        .from("classes")
        .select("department_id")
        .eq("id", targetId)
        .maybeSingle()
      if (cErr) throw createError({ statusCode: 500, message: "Failed to load class." })
      if (!cls) throw createError({ statusCode: 404, message: "Class not found." })
      if (cls.department_id !== userDeptId) {
        throw createError({ statusCode: 403, message: "Dean can only view classes in their own department." })
      }
    }

    if (view === "FACULTY") {
      const { data: fac, error: fErr } = await supabase
        .from("faculty")
        .select("department_id")
        .eq("id", targetId)
        .maybeSingle()
      if (fErr) throw createError({ statusCode: 500, message: "Failed to load faculty." })
      if (!fac) throw createError({ statusCode: 404, message: "Faculty not found." })
      if (fac.department_id !== userDeptId) {
        throw createError({ statusCode: 403, message: "Dean can only view faculty in their own department." })
      }
    }

    if (view === "ROOM") {
      const { data: room, error: rErr } = await supabase
        .from("rooms")
        .select("department_id")
        .eq("id", targetId)
        .maybeSingle()
      if (rErr) throw createError({ statusCode: 500, message: "Failed to load room." })
      if (!room) throw createError({ statusCode: 404, message: "Room not found." })
      if (room.department_id !== userDeptId) {
        throw createError({
          statusCode: 403,
          message: "Dean can only view rooms inside their own department."
        })
      }
    }
  }

  // GENED → full view allowed (Option B)

  // ---------------- BUILD BASE QUERY ----------------
  let request = supabase
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
      period_start_id,
      period_end_id,
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
        slot_index,
        start_time,
        end_time
      ),

      period_end:periods!schedules_period_end_id_fkey(
        id,
        slot_index,
        start_time,
        end_time
      )
    `)
    .eq("academic_term_id", academicTermId)
    .eq("is_deleted", false)

  // ---------------- APPLY VIEW FILTER ----------------
  if (view === "CLASS") request = request.eq("class_id", targetId)
  else if (view === "FACULTY") request = request.eq("faculty_id", targetId)
  else if (view === "ROOM") request = request.eq("room_id", targetId)
  else throw createError({ statusCode: 400, message: "Invalid view type." })

  // PROGRAM DEAN → final filtering by department_id
  if (normalizedRole === "DEAN") {
    request = request.eq("department_id", userDeptId)
  }

  // GENED → no extra restriction (view-only full access)

  // ---------------- EXECUTE QUERY ----------------
  const { data, error } = await request
    .order("day", { ascending: true })
    .order("period_start.slot_index", { ascending: true })

  if (error) {
    console.error("schedules.list error:", error)
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
