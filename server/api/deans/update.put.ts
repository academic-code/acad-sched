export default defineEventHandler(async (event) => {
  const supabase = event.context.supabase

  const { id, full_name, department_id } = await readBody(event)

  const { error } = await supabase
    .from("deans")
    .update({ full_name, department_id })
    .eq("id", id)

  return { error: error?.message }
})
