import { readBody } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!

  if (!supabase) {
    return { error: "Supabase not initialized." }
  }

  const {
    id,
    employee_no,
    first_name,
    last_name,
    faculty_type,
    is_active
  } = await readBody(event)

  if (!id) return { error: "Missing faculty id." }

  const { error } = await supabase
    .from("faculty")
    .update({
      employee_no,
      first_name,
      last_name,
      faculty_type,
      is_active
    })
    .eq("id", id)

  return { success: !error, error: error?.message }
})
