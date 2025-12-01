export default defineEventHandler(async (event) => {
  const supabase = event.context.supabase
  const query = getQuery(event)
  const search = query.search?.toString() || ""

  const { data, error } = await supabase
    .from("deans")
    .select("*, departments(name)")
    .ilike("full_name", `%${search}%`)

  return { data, error }
})
