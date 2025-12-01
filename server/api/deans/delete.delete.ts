export default defineEventHandler(async (event) => {
  const supabase = event.context.supabase;
  const { id, auth_id } = await readBody(event);

  // Delete from deans table
  const { error: dErr } = await supabase
    .from("deans")
    .delete()
    .eq("id", id);

  if (dErr) return { error: dErr.message };

  // Delete auth user
  const { error: authErr } = await supabase.auth.admin.deleteUser(auth_id);

  return { error: authErr?.message };
});
