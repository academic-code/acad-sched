// server/api/deans/update.put.ts
import { readBody } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = event.context.supabaseAdmin
  const { id, user_id, full_name, department_id } = await readBody(event)

  if (!id || !user_id || !full_name || !department_id) {
    return { error: "Missing required fields." }
  }

  // Update the user profile
  const { error: userErr } = await supabase
    .from("users")
    .update({
      full_name,
      department_id
    })
    .eq("id", user_id)

  if (userErr) return { error: userErr.message }

  // Update dean mapping if department changed
  const { error: deanErr } = await supabase
    .from("deans")
    .update({
      department_id
    })
    .eq("id", id)

  return { error: deanErr?.message }
})
