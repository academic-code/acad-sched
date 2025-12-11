// server/api/schedules/save.post.ts
import { readBody, createError } from "h3";
import { extractBearerToken, getAppUserRecord } from "./_helpers";

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!;
  const body = await readBody<any>(event);

  const {
    id,                     // optional (update)
    class_id,
    subject_id,
    faculty_id = null,
    room_id = null,
    day,
    period_start_id,
    period_end_id,
    academic_term_id: termFromBody,
    mode = "F2F",
    force = false
  } = body;

  // ---------------------------------------------------------
  // 1) BASIC REQUIREMENTS
  // ---------------------------------------------------------
  if (!class_id || !subject_id || !day || !period_start_id || !period_end_id) {
    throw createError({ statusCode: 400, message: "Missing required fields." });
  }

  // ---------------------------------------------------------
  // 2) AUTHENTICATION
  // ---------------------------------------------------------
  const token = extractBearerToken(event);
  if (!token) throw createError({ statusCode: 401, message: "Missing auth token." });

  const { userRecord } = await getAppUserRecord(supabase, token);
  let userRole = (userRecord.role || "").toUpperCase();
  const userDepartmentId = userRecord.department_id;
  const actorId = userRecord.id;

  // ---------------------------------------------------------
  // 3) LOAD CLASS INFORMATION
  // ---------------------------------------------------------
  const { data: classRow, error: classErr } = await supabase
    .from("classes")
    .select("id, department_id, academic_term_id")
    .eq("id", class_id)
    .maybeSingle();

  if (classErr || !classRow)
    throw createError({ statusCode: 400, message: "Class not found." });

  const scheduleDepartmentId = classRow.department_id;
  const academic_term_id = termFromBody || classRow.academic_term_id;

  if (!academic_term_id)
    throw createError({
      statusCode: 400,
      message: "academic_term_id is required (or must be set in the class)."
    });

  // ---------------------------------------------------------
  // 4) DETECT GENED DEAN ROLE
  // ---------------------------------------------------------
  if (userRole === "DEAN" && userDepartmentId) {
    const { data: dept } = await supabase
      .from("departments")
      .select("type")
      .eq("id", userDepartmentId)
      .maybeSingle();

    if (dept?.type === "GENED") userRole = "GENED";
  }

  // ---------------------------------------------------------
  // 5) SUBJECT VALIDATION
  // ---------------------------------------------------------
  const { data: subjectRow, error: subjectErr } = await supabase
    .from("subjects")
    .select("id, department_id, is_gened")
    .eq("id", subject_id)
    .maybeSingle();

  if (subjectErr || !subjectRow)
    throw createError({ statusCode: 400, message: "Subject not found." });

  // ---------------------------------------------------------
  // 6) PERMISSION RULES (STRICT)
  // ---------------------------------------------------------
  if (userRole === "ADMIN") {
    throw createError({
      statusCode: 403,
      message: "Admins cannot modify schedules in this endpoint."
    });
  }

  if (userRole === "FACULTY") {
    throw createError({
      statusCode: 403,
      message: "Faculty cannot modify schedules."
    });
  }

  if (userRole === "DEAN") {
    if (userDepartmentId !== scheduleDepartmentId) {
      throw createError({
        statusCode: 403,
        message: "You can only schedule classes inside your department."
      });
    }
    if (subjectRow.is_gened) {
      throw createError({
        statusCode: 403,
        message: "Program deans cannot schedule GenEd subjects."
      });
    }
  }

  if (userRole === "GENED") {
    if (!subjectRow.is_gened) {
      throw createError({
        statusCode: 403,
        message: "GenEd dean can only schedule GenEd subjects."
      });
    }
  }

  // ---------------------------------------------------------
  // 7) LOAD PERIODS (NEEDED FOR SLOT VALIDATION)
  // ---------------------------------------------------------
  const { data: periodRows, error: periodErr } = await supabase
    .from("periods")
    .select("id, slot_index");

  if (periodErr || !periodRows || periodRows.length === 0)
    throw createError({ statusCode: 500, message: "Periods not configured." });

  const slotOf = new Map<string, number>();
  periodRows.forEach((p: any) => slotOf.set(p.id, p.slot_index));

  const startIndex = slotOf.get(period_start_id);
  const endIndex = slotOf.get(period_end_id);

  if (startIndex == null || endIndex == null)
    throw createError({ statusCode: 400, message: "Invalid period selected." });

  const minIndex = Math.min(startIndex, endIndex);
  const maxIndex = Math.max(startIndex, endIndex);

  // ---------------------------------------------------------
  // 8) CONFLICT DETECTION
  // ---------------------------------------------------------
  let conflictReq = supabase
    .from("schedules")
    .select("*")
    .eq("day", day)
    .eq("academic_term_id", academic_term_id)
    .eq("is_deleted", false);

  if (id) conflictReq = conflictReq.neq("id", id);

  const orParts = [`class_id.eq.${class_id}`];
  if (faculty_id) orParts.push(`faculty_id.eq.${faculty_id}`);
  if (room_id) orParts.push(`room_id.eq.${room_id}`);
  conflictReq = conflictReq.or(orParts.join(","));

  const { data: conflicts, error: conflictErr } = await conflictReq;

  if (conflictErr)
    throw createError({ statusCode: 500, message: conflictErr.message });

  const classConf = [];
  const facultyConf = [];
  const roomConf = [];

  for (const s of conflicts || []) {
    const sStart = slotOf.get(s.period_start_id);
    const sEnd = slotOf.get(s.period_end_id);

    if (sStart == null || sEnd == null) continue;

    const sMin = Math.min(sStart, sEnd);
    const sMax = Math.max(sStart, sEnd);

    const overlaps = !(sMax < minIndex || sMin > maxIndex);
    if (!overlaps) continue;

    if (s.class_id === class_id) classConf.push(s);
    if (faculty_id && s.faculty_id === faculty_id) facultyConf.push(s);
    if (room_id && s.room_id === room_id) roomConf.push(s);
  }

  const hardConflicts = [...classConf, ...roomConf];
  const hardIds = [...new Set(hardConflicts.map((c) => c.id))];

  if (hardIds.length > 0 && !force) {
    return {
      conflict: true,
      type: "HARD",
      class_conflicts: classConf,
      room_conflicts: roomConf,
      faculty_conflicts: facultyConf,
      message: "⛔ Conflict detected — requires force=true"
    };
  }

  // FORCE MODE → soft delete
  if (hardIds.length > 0 && force) {
    const { error: delErr } = await supabase
      .from("schedules")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .in("id", hardIds);

    if (delErr) throw createError({ statusCode: 500, message: delErr.message });

    for (const c of hardConflicts) {
      await supabase.from("schedule_history").insert({
        schedule_id: c.id,
        action: "FORCE_REPLACE",
        old_data: c,
        new_data: null,
        performed_by: actorId
      });
    }
  }

  // ---------------------------------------------------------
  // 9) INSERT OR UPDATE SCHEDULE
  // ---------------------------------------------------------
  const now = new Date().toISOString();
  let scheduleId = id;
  let oldSchedule = null;

  if (id) {
    const { data: oldRow } = await supabase
      .from("schedules")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    oldSchedule = oldRow;

    const { error: updErr } = await supabase
      .from("schedules")
      .update({
        class_id,
        subject_id,
        faculty_id,
        room_id,
        day,
        period_start_id,
        period_end_id,
        academic_term_id,
        mode,
        department_id: scheduleDepartmentId,
        updated_at: now
      })
      .eq("id", id);

    if (updErr)
      throw createError({ statusCode: 500, message: updErr.message });
  } else {
    const { data: insertRes, error: insErr } = await supabase
      .from("schedules")
      .insert({
        class_id,
        subject_id,
        faculty_id,
        room_id,
        day,
        period_start_id,
        period_end_id,
        academic_term_id,
        mode,
        department_id: scheduleDepartmentId,
        created_by: actorId,
        created_at: now,
        updated_at: now,
        status: "PUBLISHED",
        is_deleted: false
      })
      .select("id")
      .single();

    if (insErr)
      throw createError({ statusCode: 500, message: insErr.message });

    scheduleId = insertRes.id;
  }

  if (!scheduleId)
    throw createError({ statusCode: 500, message: "Failed to save schedule." });

  // ---------------------------------------------------------
  // 10) WRITE schedule_periods EXPANSION
  // ---------------------------------------------------------
  await supabase.from("schedule_periods").delete().eq("schedule_id", scheduleId);

  const rangePeriodIds = periodRows
    .filter((p) => {
      const idx = p.slot_index;
      return idx >= minIndex && idx <= maxIndex;
    })
    .map((p) => p.id);

  if (rangePeriodIds.length > 0) {
    const insertData = rangePeriodIds.map((pid) => ({
      schedule_id: scheduleId,
      day,
      period_id: pid
    }));

    const { error: spErr } = await supabase
      .from("schedule_periods")
      .insert(insertData);

    if (spErr)
      throw createError({ statusCode: 500, message: spErr.message });
  }

  // ---------------------------------------------------------
  // 11) HISTORY LOG
  // ---------------------------------------------------------
  await supabase.from("schedule_history").insert({
    schedule_id: scheduleId,
    action: id ? "UPDATE" : "CREATE",
    old_data: oldSchedule,
    new_data: {
      class_id,
      subject_id,
      faculty_id,
      room_id,
      day,
      period_start_id,
      period_end_id,
      academic_term_id,
      mode,
      department_id: scheduleDepartmentId
    },
    performed_by: actorId
  });

  // ---------------------------------------------------------
  // 12) SUCCESS RETURN
  // ---------------------------------------------------------
  return {
    success: true,
    id: scheduleId,
    replaced: force && hardIds.length > 0,
    faculty_conflicts: facultyConf,
    undo_id: scheduleId
  };
});
