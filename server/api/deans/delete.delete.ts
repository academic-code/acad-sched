// server/api/deans/delete.delete.ts
import { readBody } from "h3";

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!;
  const supabaseAdmin = globalThis.$supabaseAdmin!;

  const { dean_id } = await readBody(event);

  if (!dean_id) return { error: "Missing dean_id." };

  // 1️⃣ Fetch dean and linked user info
  const { data: dean, error: findErr } = await supabase
    .from("deans")
    .select(`
      id,
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

  if (findErr || !dean) {
    return { error: "Dean not found." };
  }

  // Supabase returns relational subquery as array
  const linkedUser = Array.isArray(dean.users) ? dean.users[0] : dean.users;

  const authUserId = linkedUser?.auth_user_id;
  const userId = linkedUser?.id;

  // 2️⃣ Delete dean record
  const { error: deanErr } = await supabase
    .from("deans")
    .delete()
    .eq("id", dean_id);

  if (deanErr) return { error: deanErr.message };

  // 3️⃣ Delete user record (database)
  if (userId) {
    await supabase.from("users").delete().eq("id", userId);
  }

  // 4️⃣ Delete auth user (Supabase auth)
  if (authUserId) {
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
    if (authErr) return { error: authErr.message };
  }

  return { success: true };
});
