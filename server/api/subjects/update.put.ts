// server/api/subjects/update.put.ts
import { readBody } from "h3"
import type { Subject } from "../../../types/Subject"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody<Subject>(event)

  if (!body.id) return { error: "Missing subject ID." }

  // ---- STRICT DUPLICATE VALIDATION ON UPDATE ----
  const { data: exists } = await supabase
    .from("subjects")
    .select("id")
    .or(
      `course_code.eq.${body.course_code.trim()},description.eq.${body.description.trim()}`
    )
    .neq("id", body.id) // allow the existing record
    .limit(1)

  if (exists && exists.length > 0) {
    return {
      error: "Another subject already exists with this course code or description."
    }
  }

  // ---- Update ----
  const { error } = await supabase
    .from("subjects")
    .update({
      course_code: body.course_code.trim(),
      description: body.description.trim(),
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
