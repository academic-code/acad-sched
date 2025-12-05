import { readBody } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody(event)

  const { start_time, end_time, slot_index } = body

  if (!start_time || !end_time) return { error: "Time is required" }

  const { error } = await supabase.from("periods").insert({
    start_time,
    end_time,
    slot_index,
    is_auto_generated: false
  })

  return { error: error?.message }
})
