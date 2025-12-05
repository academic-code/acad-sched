import { readBody } from "h3";

export default defineEventHandler(async (event) => {
  try {
    const supabase = globalThis.$supabase!;
    const supabaseAdmin = globalThis.$supabaseAdmin!;

    const { email, full_name, department_id } = await readBody(event);

    console.log("🔍 Incoming payload:", { email, full_name, department_id });
    console.log("🔧 Supabase:", !!supabase);
    console.log("🔧 SupabaseAdmin:", !!supabaseAdmin);

    if (!email || !full_name || !department_id) {
      return { error: "Missing required fields." };
    }

    const { data: existingDean } = await supabase
      .from("deans")
      .select("id")
      .eq("department_id", department_id)
      .maybeSingle();

    if (existingDean) return { error: "This department already has a dean." };

    // Invite user
    const result = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      { redirectTo: `${process.env.NUXT_PUBLIC_SITE_URL}/welcome` }
    );

    console.log("📩 Invite response:", result);

    const { data: invite, error: inviteErr } = result;

    if (inviteErr) throw new Error("Invite Error: " + inviteErr.message);

    const authUserId = invite.user.id;

    const { data: userData, error: userErr } = await supabase
      .from("users")
      .insert({
        auth_user_id: authUserId,
        email,
        full_name,
        role: "DEAN",
        department_id
      })
      .select("id")
      .single();

    if (userErr) throw new Error("User Insert Error: " + userErr.message);

    const { error: deanErr } = await supabase.from("deans").insert({
      user_id: userData.id,
      department_id
    });

    if (deanErr) throw new Error("Dean Insert Error: " + deanErr.message);

    return { success: true };

  } catch (err: any) {
    console.error("🔥 SERVER ERROR:", err);
    return { error: err.message ?? "Unknown server error" };
  }
});
