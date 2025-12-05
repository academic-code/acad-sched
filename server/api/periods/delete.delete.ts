import { readBody } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const { id } = await readBody(event)

  const { error } = await supabase.from("periods").delete().eq("id", id)

  return { error: error?.message }
})
