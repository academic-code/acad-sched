import { readBody } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const { id, start_time, end_time, slot_index } = await readBody(event)

  const { error } = await supabase.from("periods")
    .update({ start_time, end_time, slot_index })
    .eq("id", id)

  return { error: error?.message }
})
