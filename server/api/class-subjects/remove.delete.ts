// server/api/class-subjects/remove.delete.ts
import { readBody } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = (globalThis as any).$supabase  

  const body = await readBody(event)
  const { class_id, subject_id } = body

  if (!class_id || !subject_id) {
    return { error: "Missing required fields." }
  }

  const { error } = await supabase
    .from("class_subjects")
    .delete()
    .eq("class_id", class_id)
    .eq("subject_id", subject_id)

  return error ? { error: error.message } : { success: true }
})
