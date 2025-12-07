// server/api/subjects/update.put.ts
import { readBody } from "h3"
import type { Subject } from "../../../types/Subject"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody<Subject>(event)

  if (!body.id) return { error: "Missing subject ID." }

  const { error } = await supabase
    .from("subjects")
    .update({
      department_id: body.department_id,
      course_code: body.course_code,
      description: body.description,
      lec: body.lec ?? 0,
      lab: body.lab ?? 0,
      units: body.units ?? 0,
      year_level_number: body.year_level_number,
      year_level_label: body.year_level_label,
      semester: body.semester,
      is_gened: body.is_gened ?? false
    })
    .eq("id", body.id)

  if (error) return { error: error.message }

  return { success: true }
})
