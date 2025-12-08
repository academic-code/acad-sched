// server/api/class-subjects/list.get.ts
export default defineEventHandler(async (event) => {
  const supabase = (globalThis as any).$supabase 

  const query = getQuery(event)

  if (!query.class_id) return []

  const { data, error } = await supabase
    .from("class_subjects")
    .select(`
      subject_id,
      subjects(
        id,
        course_code,
        description
      )
    `)
    .eq("class_id", query.class_id)

  if (error || !data) return []

  return data.map((row: any) => ({
    subject_id: row.subject_id,
    id: row.subjects?.id,
    course_code: row.subjects?.course_code,
    description: row.subjects?.description
  }))
})
