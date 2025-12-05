import { readBody } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const supabaseAdmin = globalThis.$supabaseAdmin!

  if (!supabase || !supabaseAdmin) {
    return { error: "Supabase not initialized." }
  }

  const { faculty_id, auth_user_id } = await readBody(event)

  if (!faculty_id) return { error: "Missing faculty_id." }

  // 1) Delete record in faculty table
  const { error: fErr } = await supabase
    .from("faculty")
    .delete()
    .eq("id", faculty_id)

  if (fErr) return { error: fErr.message }

  // 2) Delete record in users table (by auth_user_id)
  if (auth_user_id) {
    await supabase
      .from("users")
      .delete()
      .eq("auth_user_id", auth_user_id)

    // 3) Delete from Supabase Auth
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(auth_user_id)
    if (authErr) return { error: authErr.message }
  }

  return { success: true }
})
