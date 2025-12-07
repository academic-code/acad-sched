// server/api/academic-terms/update.post.ts
import { readBody } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody(event)

  const { id, semester, academic_year, is_active } = body

  if (!id) return { error: "Missing term ID." }

  const label = `${academic_year} • ${semester}`

  // Enforce single active term
  if (is_active) {
    await supabase.from("academic_terms").update({ is_active: false })
  }

  const { data, error } = await supabase
    .from("academic_terms")
    .update({
      semester,
      academic_year,
      label,
      is_active: !!is_active
    })
    .eq("id", id)
    .select("*")
    .single()

  if (error) return { error: error.message }

  return { success: true, term: data }
})
