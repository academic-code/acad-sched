// server/api/classes/delete.delete.ts
import { readBody } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const { id } = await readBody<{ id: string }>(event)

  if (!id) return { error: "Missing class ID." }

  // Delete mappings first
  const { error: csErr } = await supabase
    .from("class_subjects")
    .delete()
    .eq("class_id", id)

  if (csErr) return { error: csErr.message }

  const { error } = await supabase
    .from("classes")
    .delete()
    .eq("id", id)

  if (error) return { error: error.message }

  return { success: true }
})
