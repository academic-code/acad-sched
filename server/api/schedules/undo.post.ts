// server/api/schedules/undo.post.ts
import { readBody, createError } from "h3"

type UndoBody = {
  id: string
}

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody<UndoBody>(event)

  const { id } = body
  if (!id) {
    throw createError({ statusCode: 400, message: "id is required." })
  }

  // 1️⃣ Auth (just to be safe)
  const authHeader = event.node.req.headers.authorization
  const token = authHeader?.replace("Bearer ", "") ?? null
  if (!token) throw createError({ statusCode: 401, message: "Missing auth token." })

  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized." })
  }

  // 2️⃣ Load schedule
  const { data: schedule, error: scheduleErr } = await supabase
    .from("schedules")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (scheduleErr || !schedule) {
    throw createError({ statusCode: 404, message: "Schedule not found." })
  }

  if (schedule.is_deleted) {
    throw createError({ statusCode: 400, message: "Schedule already deleted." })
  }

  // 3️⃣ Enforce 10-second window based on created_at
  const createdAt = new Date(schedule.created_at)
  const now = new Date()
  const diffMs = now.getTime() - createdAt.getTime()

  if (diffMs > 10_000) {
    throw createError({
      statusCode: 400,
      message: "Undo window expired. (More than 10 seconds since creation.)"
    })
  }

  // 4️⃣ Soft delete schedule
  const { error: updateErr } = await supabase
    .from("schedules")
    .update({ is_deleted: true })
    .eq("id", id)

  if (updateErr) {
    throw createError({ statusCode: 500, message: updateErr.message })
  }

  // 5️⃣ Log in history
  await supabase.from("schedule_history").insert({
    schedule_id: schedule.id,
    action: "UNDO_CREATE",
    old_data: schedule,
    new_data: null,
    performed_by: null // optional: could look up user.id from users table
  })

  return {
    success: true
  }
})
