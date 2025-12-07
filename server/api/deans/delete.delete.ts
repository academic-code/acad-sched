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
      user_id,
      users (
        id,
        full_name,
        email,
        auth_user_id
      )
    `)
    .eq("id", dean_id)
    .single();

  if (findErr || !dean) return { error: "Dean not found." };

  // Normalize Supabase object
  const deanUser = Array.isArray(dean.users) ? dean.users[0] : dean.users;
  const deanAuthId = deanUser?.auth_user_id;
  const deanUserId = deanUser?.id;
  const departmentId = dean.department_id;

  // 2️⃣ Get all faculty in the same department
  const { data: facultyList, error: facultyErr } = await supabase
    .from("users")
    .select("id, auth_user_id")
    .eq("department_id", departmentId)
    .eq("role", "FACULTY");

  if (facultyErr) return { error: facultyErr.message };

  // 3️⃣ Delete faculty DB records & their auth accounts
  if (facultyList?.length) {
    for (const faculty of facultyList) {
      if (faculty.auth_user_id) {
        await supabaseAdmin.auth.admin.deleteUser(faculty.auth_user_id);
      }

      await supabase.from("users").delete().eq("id", faculty.id);
    }
  }

  // 4️⃣ Delete dean record (from deans table)
  const { error: deanDeleteErr } = await supabase
    .from("deans")
    .delete()
    .eq("id", dean_id);

  if (deanDeleteErr) return { error: deanDeleteErr.message };

  // 5️⃣ Delete dean user from users table
  if (deanUserId) {
    await supabase.from("users").delete().eq("id", deanUserId);
  }

  // 6️⃣ Delete dean authentication account
  if (deanAuthId) {
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(deanAuthId);
    if (authErr) return { error: authErr.message };
  }

  return { success: true };
});
