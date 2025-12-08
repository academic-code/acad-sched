// server/api/deans/delete.delete.ts
import { readBody } from "h3";

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!;
  const supabaseAdmin = globalThis.$supabaseAdmin!;

  const { dean_id } = await readBody(event);
  if (!dean_id) return { error: "Missing dean_id." };

  // 1️⃣ Fetch dean + user + department
  const { data: dean, error: findErr } = await supabase
    .from("deans")
    .select(`
      id,
      department_id,
      users (
        id,
        auth_user_id
      )
    `)
    .eq("id", dean_id)
    .single();

  if (findErr || !dean) return { error: "Dean not found." };

  // 🔧 Normalize user (fix for TS)
  const deanUser = Array.isArray(dean.users) ? dean.users[0] : dean.users;

  const deanUserId = deanUser?.id || null;
  const deanAuthId = deanUser?.auth_user_id || null;
  const departmentId = dean.department_id;

  // ----------------------------------------------
  // 🧹 DELETE SCHEDULES + PERIODS + HISTORY
  // ----------------------------------------------
  const { data: schedules } = await supabase
    .from("schedules")
    .select("id")
    .eq("department_id", departmentId);

  if (schedules?.length) {
    const scheduleIds = schedules.map(v => v.id);

    await supabase.from("schedule_periods").delete().in("schedule_id", scheduleIds);
    await supabase.from("schedule_history").delete().in("schedule_id", scheduleIds);
    await supabase.from("schedules").delete().eq("department_id", departmentId);
  }

  // ----------------------------------------------
  // 🧹 DELETE CLASS-SUBJECT RELATIONS
  // ----------------------------------------------
  const { data: classes } = await supabase
    .from("classes")
    .select("id")
    .eq("department_id", departmentId);

  if (classes?.length) {
    const classIds = classes.map(c => c.id);
    await supabase.from("class_subjects").delete().in("class_id", classIds);
  }

  // ----------------------------------------------
  // 🧹 DELETE CLASSES
  // ----------------------------------------------
  await supabase.from("classes").delete().eq("department_id", departmentId);

  // ----------------------------------------------
  // 🧹 DELETE SUBJECTS (Major + GenEd assignments related to this dept)
  // ----------------------------------------------
  await supabase.from("subjects").delete().eq("department_id", departmentId);

  // ----------------------------------------------
  // 🧹 DELETE ROOMS
  // ----------------------------------------------
  await supabase.from("rooms").delete().eq("department_id", departmentId);

  // ----------------------------------------------
  // 🧹 DELETE FACULTY + AUTH ACCOUNTS
  // ----------------------------------------------
  const { data: facultyList } = await supabase
    .from("users")
    .select("id, auth_user_id")
    .eq("department_id", departmentId)
    .eq("role", "FACULTY");

  if (facultyList?.length) {
    for (const faculty of facultyList) {
      if (faculty.auth_user_id) {
        await supabaseAdmin.auth.admin.deleteUser(faculty.auth_user_id);
      }
      await supabase.from("users").delete().eq("id", faculty.id);
    }
  }

  // ----------------------------------------------
  // 🧹 DELETE DEAN RECORD + USER + AUTH
  // ----------------------------------------------
  await supabase.from("deans").delete().eq("id", dean_id);

  if (deanUserId) await supabase.from("users").delete().eq("id", deanUserId);

  if (deanAuthId) await supabaseAdmin.auth.admin.deleteUser(deanAuthId);

  // ----------------------------------------------
  // 🧹 DELETE DEPARTMENT
  // ----------------------------------------------
  await supabase.from("departments").delete().eq("id", departmentId);

  return { success: true };
});
