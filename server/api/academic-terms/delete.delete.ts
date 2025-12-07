// server/api/academic-terms/delete.delete.ts
import { readBody } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody(event)

  if (!body?.id) return { error: "Missing term ID." }

  const { error } = await supabase
    .from("academic_terms")
    .delete()
    .eq("id", body.id)

  return error ? { error: error.message } : { success: true }
})
