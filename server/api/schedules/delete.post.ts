// server/api/schedules/delete.post.ts
import { readBody, createError } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody<{ id?: string }>(event)

  const id = body.id
  if (!id) {
    throw createError({ statusCode: 400, message: "Missing schedule ID." })
  }

  const nowIso = new Date().toISOString()

  const { data: oldRow, error: loadErr } = await supabase
    .from("schedules")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (loadErr || !oldRow) {
    throw createError({ statusCode: 404, message: "Schedule not found." })
  }

  const { error } = await supabase
    .from("schedules")
    .update({
      is_deleted: true,
      updated_at: nowIso
    })
    .eq("id", id)

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  await supabase.from("schedule_history").insert({
    schedule_id: id,
    action: "DELETE",
    old_data: oldRow,
    new_data: null,
    performed_by: null, // optional: fill with actor like in save.post if you want
    performed_at: nowIso
  })

  return {
    success: true,
    id,
    undoAvailable: true,
    expiresIn: 10 // seconds
  }
})
