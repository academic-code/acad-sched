// server/api/academic-terms/list.get.ts
export default defineEventHandler(async () => {
  const supabase = globalThis.$supabase!

  const { data, error } = await supabase
    .from("academic_terms")
    .select("*")
    .order("academic_year", { ascending: false })

  if (error) return { error: error.message }

  return data || []
})
