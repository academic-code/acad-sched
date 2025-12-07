// server/api/classes/archive.post.ts
import { readBody } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody<{ id?: string; is_archived?: boolean }>(event)

  if (!body.id) return { error: "Missing class ID." }
  if (typeof body.is_archived !== "boolean") {
    return { error: "Missing archive state." }
  }

  const { error } = await supabase
    .from("classes")
    .update({ is_archived: body.is_archived })
    .eq("id", body.id)

  if (error) return { error: error.message }

  return { success: true }
})
