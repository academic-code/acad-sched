// server/api/subjects/create.post.ts
import { readBody } from "h3"
import type { Subject } from "../../../types/Subject"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody<Subject>(event)

  if (!body.department_id || !body.course_code || !body.description) {
    return { error: "Missing required fields." }
  }

  if (!body.year_level_number) {
    return { error: "Year level is required." }
  }

  if (!body.semester) {
    return { error: "Semester is required." }
  }

  if (!body.units && body.units !== 0) {
    return { error: "Units is required." }
  }

  const { error } = await supabase.from("subjects").insert({
    department_id: body.department_id,
    course_code: body.course_code,
    description: body.description,
    lec: body.lec ?? 0,
    lab: body.lab ?? 0,
    units: body.units ?? 0,
    year_level_number: body.year_level_number,
    year_level_label: body.year_level_label,
    semester: body.semester,
    is_gened: body.is_gened ?? false,
    created_by: body.created_by ?? null
  })

  if (error) return { error: error.message }

  return { success: true }
})
