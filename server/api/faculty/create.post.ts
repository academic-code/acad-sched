import { readBody } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const supabaseAdmin = globalThis.$supabaseAdmin!

  if (!supabase || !supabaseAdmin) {
    return { error: "Supabase not initialized." }
  }

  const {
    email,
    first_name,
    last_name,
    employee_no,
    department_id,
    faculty_type
  } = await readBody(event)

  if (!email || !first_name || !last_name || !employee_no || !department_id) {
    return { error: "Missing required fields." }
  }

  // 1) Invite to Supabase Auth
  const { data: invite, error: inviteErr } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NUXT_PUBLIC_SITE_URL}/welcome`,
      data: { role: "FACULTY", department_id }
    })

  if (inviteErr) {
    return { error: inviteErr.message }
  }

  const authUserId = invite.user.id

  // 2) Create record in users table
  const full_name = `${first_name} ${last_name}`.trim()

  const { error: userErr } = await supabase.from("users").insert({
    auth_user_id: authUserId,
    email,
    full_name,
    role: "FACULTY",
    department_id
  })

  if (userErr) {
    return { error: userErr.message }
  }

  // 3) Create record in faculty table
  const { error: facultyErr } = await supabase.from("faculty").insert({
    auth_user_id: authUserId,
    department_id,
    employee_no,
    first_name,
    last_name,
    email,
    faculty_type,
    is_active: true
  })

  if (facultyErr) {
    return { error: facultyErr.message }
  }

  return { success: true }
})
