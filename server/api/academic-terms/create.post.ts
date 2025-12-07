// server/api/academic-terms/create.post.ts
import { readBody } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody(event)

  const { semester, academic_year, is_active } = body

  if (!academic_year) return { error: "Academic year is required." }
  if (!semester) return { error: "Semester is required." }

  // Generate label format
  const label = `${academic_year} • ${semester}`

  // If active, deactivate previous active
  if (is_active) {
    await supabase.from("academic_terms").update({ is_active: false })
  }

  const { data, error } = await supabase
    .from("academic_terms")
    .insert([{ semester, academic_year, label, is_active: !!is_active }])
    .select("*")
    .single()

  if (error) return { error: error.message }

  return { success: true, term: data }
})
