export default defineEventHandler(async (event) => {
  const supabase = event.context.supabase;

  const body = await readBody(event);
  const { email, full_name, department_id } = body;

  if (!email || !full_name || !department_id) {
    return { error: "Missing required fields." };
  }

  // 1. Check if department already has a dean
  const { data: existingDean } = await supabase
    .from("deans")
    .select("id")
    .eq("department_id", department_id)
    .maybeSingle();

  if (existingDean) {
    return { error: "This department already has a dean." };
  }

  // 2. Create Supabase invitation
  const { data: inviteData, error: inviteErr } =
    await supabase.auth.admin.inviteUserByEmail(email, {
      emailRedirectTo: `${process.env.PUBLIC_APP_URL}/welcome`,
      data: {
        role: "dean",
        full_name,
        department_id,
      },
    });

  if (inviteErr) {
    return { error: inviteErr.message };
  }

  // 3. Insert dean record
  const { error: deanErr } = await supabase.from("deans").insert({
    auth_id: inviteData.user.id,
    full_name,
    email,
    department_id,
  });

  return { error: deanErr?.message };
});
