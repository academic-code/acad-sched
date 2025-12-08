// server/api/class-subjects/assign.post.ts
import { readBody } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = (globalThis as any).$supabase  

  const body = await readBody(event)
  const { class_id, subject_id, academic_term_id } = body

  if (!class_id || !subject_id || !academic_term_id) {
    return { error: "Missing required fields." }
  }

  const { data: existing } = await supabase
    .from("class_subjects")
    .select("*")
    .eq("class_id", class_id)
    .eq("subject_id", subject_id)
    .maybeSingle()

  if (existing) {
    return { error: "Subject already assigned." }
  }

  const { error } = await supabase
    .from("class_subjects")
    .insert({
      class_id,
      subject_id,
      academic_term_id
    })

  return error ? { error: error.message } : { success: true }
})
