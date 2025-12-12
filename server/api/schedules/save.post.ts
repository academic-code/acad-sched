// server/api/schedules/save.post.ts
import { readBody, createError } from "h3"
import {
  extractBearerToken,
  getAppUserRecord,
  resolveNormalizedRole,
  normalizeDay
} from "./_helpers"
import { ConflictEngine } from "./conflict-engine"

type SupabaseClientLike = any

export default defineEventHandler(async (event) => {
  const supabase: SupabaseClientLike = globalThis.$supabase!

  try {
    const body = await readBody<Record<string, any>>(event)

    // ----------------- Normalize & Validate payload -----------------
    const payload = {
      id: body?.id ?? undefined,
      class_id: body?.class_id ?? null,
      subject_id: body?.subject_id ?? null,
      faculty_id: body?.faculty_id ?? null,
      room_id: body?.room_id ?? null,
      day: body?.day ?? null,
      period_start_id: body?.period_start_id ?? null,
      period_end_id: body?.period_end_id ?? null,
      academic_term_id: body?.academic_term_id ?? null,
      mode: (body?.mode ?? "F2F") as string,
      force: Boolean(body?.force === true || body?.force === "true")
    }

    if (!payload.class_id) throw createError({ statusCode: 400, message: "class_id is required." })
    if (!payload.subject_id) throw createError({ statusCode: 400, message: "subject_id is required." })
    if (!payload.day) throw createError({ statusCode: 400, message: "day is required." })
    if (!payload.period_start_id) throw createError({ statusCode: 400, message: "period_start_id is required." })
    if (!payload.period_end_id) throw createError({ statusCode: 400, message: "period_end_id is required." })
    if (!payload.academic_term_id) throw createError({ statusCode: 400, message: "academic_term_id is required." })

    const normalizedDay = normalizeDay(payload.day)

    // ----------------- AUTH -----------------
    const token = extractBearerToken(event)
    if (!token) throw createError({ statusCode: 401, message: "Missing auth token." })

    const { userRecord, authUser } = await getAppUserRecord(supabase, token)
    const normalizedRole = await resolveNormalizedRole(supabase, userRecord)
    const roleUpper = (normalizedRole || "").toString().toUpperCase()
    const userDeptId = userRecord?.department_id ?? null

    // Quick reject: faculty role cannot create/modify schedules
    if (roleUpper === "FACULTY") {
      throw createError({ statusCode: 403, message: "Faculty cannot create or modify schedules." })
    }

    // ----------------- Load referenced rows -----------------
    // Class row (useful for department, but in A2 SUBJECT dept governs assignment)
    const { data: classRow, error: classErr } = await supabase
      .from("classes")
      .select("id, department_id, academic_term_id")
      .eq("id", payload.class_id)
      .maybeSingle()
    if (classErr) throw createError({ statusCode: 500, message: classErr.message })
    if (!classRow) throw createError({ statusCode: 404, message: "Class not found." })

    // Subject row — crucial for A2 (subject.department_id)
    const { data: subjectRow, error: subjErr } = await supabase
      .from("subjects")
      .select("id, department_id, is_gened, year_level_number, semester")
      .eq("id", payload.subject_id)
      .maybeSingle()
    if (subjErr) throw createError({ statusCode: 500, message: subjErr.message })
    if (!subjectRow) throw createError({ statusCode: 404, message: "Subject not found." })

    // If faculty_id provided, load faculty row to validate department & active state
    let facultyRow: any = null
    if (payload.faculty_id) {
      const { data: f, error: fErr } = await supabase
        .from("faculty")
        .select("id, department_id, is_active")
        .eq("id", payload.faculty_id)
        .maybeSingle()
      if (fErr) throw createError({ statusCode: 500, message: fErr.message })
      if (!f) throw createError({ statusCode: 404, message: "Faculty not found." })
      facultyRow = f
    }

    // Room if provided
    let roomRow: any = null
    if (payload.room_id) {
      const { data: r, error: rErr } = await supabase
        .from("rooms")
        .select("id, department_id, room_sharing")
        .eq("id", payload.room_id)
        .maybeSingle()
      if (rErr) throw createError({ statusCode: 500, message: rErr.message })
      if (!r) throw createError({ statusCode: 404, message: "Room not found." })
      roomRow = r
    }

    // Academic term check — avoid selecting academic_year to prevent prior error.
    const { data: termRow, error: termErr } = await supabase
      .from("academic_terms")
      .select("id, semester, label, is_active")
      .eq("id", payload.academic_term_id)
      .maybeSingle()
    if (termErr) throw createError({ statusCode: 500, message: termErr.message })
    if (!termRow) throw createError({ statusCode: 400, message: "Academic term not found." })

    // ----------------- Role-specific permission checks (A2) -----------------
    // A2: Dean may assign only if the SUBJECT belongs to their department AND faculty (if provided) matches the SUBJECT's department.
    const subjectDeptId = subjectRow.department_id ?? null
    const isGenedSubject = Boolean(subjectRow?.is_gened)

    if (roleUpper === "DEAN") {
      if (!userDeptId) throw createError({ statusCode: 403, message: "Dean has no department." })

      // Dean must be of the same department as the SUBJECT (A2)
      if (String(userDeptId) !== String(subjectDeptId)) {
        throw createError({ statusCode: 403, message: "Dean can only create schedules for subjects in their own department." })
      }

      // Deans cannot create GenEd schedules (GenEd dean handles GenEd)
      if (isGenedSubject) {
        throw createError({ statusCode: 403, message: "Deans cannot create GenEd schedules." })
      }

      // If room provided, ensure room belongs to the dean's department (subject's dept == dean's dept)
      if (roomRow && String(roomRow.department_id) !== String(userDeptId)) {
        throw createError({ statusCode: 403, message: "Dean can only assign rooms from their own department." })
      }
    }

    if (roleUpper === "GENED") {
      // GenEd dean may only create schedules for GenEd subjects
      if (!isGenedSubject) throw createError({ statusCode: 403, message: "GenEd dean can only create schedules for GenEd subjects." })
    }

    // ADMIN: no department restrictions

    // Faculty assignment validation (A2 rules)
    if (facultyRow) {
      // Faculty must be active
      if (facultyRow.is_active === false) {
        throw createError({ statusCode: 403, message: "Cannot assign an inactive faculty." })
      }

      // Faculty must belong to the SUBJECT's department (A2)
      if (String(facultyRow.department_id) !== String(subjectDeptId)) {
        throw createError({ statusCode: 403, message: "Assigned faculty must belong to the subject's department." })
      }

      // Additionally: If requester is DEAN and DEAN's dept != subject dept we've already blocked above.
      // If requester is DEAN and facultyRow.department_id matches subjectDept, this is allowed.
    }

    // ----------------- Prepare conflict engine & slot checks -----------------
    const conflictEngine = new ConflictEngine(supabase)
    const slotMap = await conflictEngine.loadSlotMap()
    const startIndex = slotMap.get(String(payload.period_start_id))
    const endIndex = slotMap.get(String(payload.period_end_id))
    if (startIndex == null || endIndex == null) throw createError({ statusCode: 400, message: "Invalid period_start_id or period_end_id." })

    // ----------------- Conflict detection -----------------
    const conflicts = await conflictEngine.findConflicts({
      class_id: payload.class_id,
      faculty_id: payload.faculty_id ?? null,
      room_id: payload.room_id ?? null,
      day: normalizedDay,
      period_start_id: payload.period_start_id,
      period_end_id: payload.period_end_id,
      academic_term_id: payload.academic_term_id,
      excludeScheduleId: payload.id ?? null
    })

    const hardConflictIds = [
      ...(conflicts.classConflicts ?? []).map((r: any) => r.id),
      ...(conflicts.roomConflicts ?? []).map((r: any) => r.id)
    ]
    const softConflictIds = (conflicts.facultyConflicts ?? []).map((r: any) => r.id)

    if ((hardConflictIds.length > 0 || softConflictIds.length > 0) && !payload.force) {
      // Return conflict details so caller can decide whether to force
      return {
        success: false,
        requires_force: true,
        message: "Conflicts detected.",
        conflicts: {
          hard: hardConflictIds,
          soft: softConflictIds,
          details: {
            classConflicts: conflicts.classConflicts,
            facultyConflicts: conflicts.facultyConflicts,
            roomConflicts: conflicts.roomConflicts
          }
        }
      }
    }

    // If force === true, soft-delete hard conflicts so the new schedule can take slot
    let replacedIds: string[] = []
    if (payload.force && hardConflictIds.length > 0) {
      const softDelResult = await conflictEngine.softDeleteConflicts(hardConflictIds, userRecord?.id ?? null)
      if (softDelResult?.deletedIds) replacedIds = softDelResult.deletedIds
    }

    // ----------------- Insert or Update schedule -----------------
    const nowIso = new Date().toISOString()
    // department_id for schedule should be the SUBJECT's department (A2 authoritative)
    const scheduleDeptId = subjectDeptId ?? classRow.department_id

    let newScheduleId: string | null = null
    let oldScheduleRow: any = null

    if (payload.id) {
      // UPDATE flow
      const { data: existing, error: loadErr } = await supabase
        .from("schedules")
        .select("*, subject:subjects(id, is_gened, department_id)")
        .eq("id", payload.id)
        .maybeSingle()
      if (loadErr) throw createError({ statusCode: 500, message: loadErr.message })
      if (!existing) throw createError({ statusCode: 404, message: "Schedule to update not found." })

      oldScheduleRow = existing

      // Permission checks on update:
      if (roleUpper === "DEAN") {
        // Dean can only modify schedules for subjects in their dept (A2)
        if (String(scheduleDeptId) !== String(userDeptId)) {
          throw createError({ statusCode: 403, message: "Dean cannot modify schedules outside their department." })
        }
      }
      if (roleUpper === "GENED") {
        if (!existing.subject?.is_gened) throw createError({ statusCode: 403, message: "GenEd dean can only modify GenEd schedules." })
      }

      const { error: updErr } = await supabase
        .from("schedules")
        .update({
          class_id: payload.class_id,
          subject_id: payload.subject_id,
          faculty_id: payload.faculty_id ?? null,
          room_id: payload.room_id ?? null,
          department_id: scheduleDeptId,
          period_start_id: payload.period_start_id,
          period_end_id: payload.period_end_id,
          day: normalizedDay,
          mode: payload.mode,
          academic_term_id: payload.academic_term_id,
          updated_at: nowIso
        })
        .eq("id", payload.id)

      if (updErr) throw createError({ statusCode: 500, message: updErr.message })
      newScheduleId = payload.id
    } else {
      // CREATE flow
      const insertPayload: Record<string, any> = {
        class_id: payload.class_id,
        subject_id: payload.subject_id,
        faculty_id: payload.faculty_id ?? null,
        room_id: payload.room_id ?? null,
        department_id: scheduleDeptId,
        period_start_id: payload.period_start_id,
        period_end_id: payload.period_end_id,
        day: normalizedDay,
        mode: payload.mode,
        academic_term_id: payload.academic_term_id,
        created_by: userRecord?.id ?? null,
        created_at: nowIso,
        updated_at: nowIso
      }

      const { data: insData, error: insErr } = await supabase
        .from("schedules")
        .insert(insertPayload)
        .select("id")
        .maybeSingle()

      if (insErr) throw createError({ statusCode: 500, message: insErr.message })
      if (!insData?.id) throw createError({ statusCode: 500, message: "Failed to create schedule." })
      newScheduleId = insData.id
    }

    // ----------------- Build schedule_periods rows (recreate) -----------------
    try {
      await supabase.from("schedule_periods").delete().eq("schedule_id", newScheduleId)
    } catch (e) {
      console.error("Warning: failed to cleanup existing schedule_periods", e)
    }

    const sIdx = slotMap.get(String(payload.period_start_id))!
    const eIdx = slotMap.get(String(payload.period_end_id))!
    const minIdx = Math.min(sIdx, eIdx)
    const maxIdx = Math.max(sIdx, eIdx)

    const { data: periodRows, error: periodFetchErr } = await supabase
      .from("periods")
      .select("id, slot_index")
      .gte("slot_index", minIdx)
      .lte("slot_index", maxIdx)
      .order("slot_index", { ascending: true })

    if (periodFetchErr) {
      console.error("Failed to fetch period rows for schedule_periods:", periodFetchErr)
    } else {
      const inserts = (periodRows || []).map((p: any) => ({
        schedule_id: newScheduleId,
        day: normalizedDay,
        period_id: p.id,
        created_at: nowIso
      }))
      if (inserts.length > 0) {
        const { error: spErr } = await supabase.from("schedule_periods").insert(inserts)
        if (spErr) {
          console.error("Failed to insert schedule_periods:", spErr)
        }
      }
    }

    // ----------------- Insert schedule_history entry -----------------
    try {
      await supabase.from("schedule_history").insert({
        schedule_id: newScheduleId,
        action: payload.id ? "UPDATE" : "CREATE",
        old_data: oldScheduleRow ?? null,
        new_data: {
          id: newScheduleId,
          class_id: payload.class_id,
          subject_id: payload.subject_id,
          faculty_id: payload.faculty_id ?? null,
          room_id: payload.room_id ?? null,
          department_id: scheduleDeptId,
          period_start_id: payload.period_start_id,
          period_end_id: payload.period_end_id,
          day: normalizedDay,
          mode: payload.mode,
          academic_term_id: payload.academic_term_id
        },
        performed_by: userRecord?.id ?? null,
        performed_at: nowIso
      })
    } catch (e) {
      console.error("Failed to insert schedule_history:", e)
    }

    // ----------------- Return response -----------------
    return {
      success: true,
      id: newScheduleId,
      replaced_conflict_ids: replacedIds,
      message: payload.id ? "Schedule updated." : "Schedule created.",
      undo_id: newScheduleId
    }
  } catch (err: any) {
    console.error("schedules.save ERROR:", err)
    const msg = err?.message ?? "Server Error"
    const code = err?.statusCode ?? 500
    throw createError({ statusCode: code, message: msg })
  }
})
