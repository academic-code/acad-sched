// server/api/subjects/delete.delete.ts
import { readBody } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const { id } = await readBody<{ id: string }>(event)

  if (!id) return { error: "Missing subject ID." }

  const { error } = await supabase.from("subjects").delete().eq("id", id)

  if (error) return { error: error.message }

  return { success: true }
})
