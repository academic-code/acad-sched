// server/api/classes/create.post.ts
import { readBody } from "h3"

function yearLabelFromNumber(n: number): string {
  if (n === 1) return "1st Year"
  if (n === 2) return "2nd Year"
  if (n === 3) return "3rd Year"
  if (n === 4) return "4th Year"
  return `${n}th Year`
}

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody<any>(event)

  const department_id = body.department_id as string | undefined
  const program_name_raw = body.program_name as string | undefined
  const year_level_number = body.year_level_number as number | undefined
  const section_raw = body.section as string | undefined
  const class_name_raw = body.class_name as string | undefined
  const academic_term_id = body.academic_term_id as string | undefined
  const adviser_id = body.adviser_id as string | null | undefined
  const remarks = body.remarks as string | undefined
  const created_by = body.created_by as string | null | undefined

  // ----- REQUIRED FIELD CHECKS -----
  if (!department_id) return { error: "Department is required." }
  if (!program_name_raw || !program_name_raw.trim()) return { error: "Program name is required." }
  if (!year_level_number) return { error: "Year level is required." }
  if (!section_raw || !section_raw.trim()) return { error: "Section is required." }
  if (!class_name_raw || !class_name_raw.trim()) return { error: "Class name is required." }
  if (!academic_term_id) return { error: "Academic term is required." }

  // ---- Prevent creating class in inactive academic term ----
const { data: term } = await supabase
  .from("academic_terms")
  .select("is_active")
  .eq("id", academic_term_id)
  .maybeSingle()

if (!term?.is_active) {
  return { error: "Cannot create a class under an inactive academic term." }
}


  const program_name = program_name_raw.trim()
  const section = section_raw.trim().toUpperCase()
  const class_name = class_name_raw.trim()
  const year_level_label = body.year_level_label || yearLabelFromNumber(year_level_number)

  // ----- UNIQUENESS CHECK (FRIENDLY) -----
  const { data: existing, error: checkErr } = await supabase
    .from("classes")
    .select("id")
    .match({
      academic_term_id,
      program_name,
      year_level_number,
      section
    })
    .maybeSingle()

  if (checkErr) {
    return { error: checkErr.message }
  }

  if (existing) {
    return {
      error:
        "A class with the same Program, Year Level, Section, and Term already exists."
    }
  }

  // ----- INSERT -----
  const { error } = await supabase.from("classes").insert({
    department_id,
    program_name,
    year_level_number,
    year_level_label,
    section,
    class_name,
    adviser_id: adviser_id || null,
    remarks: remarks || null,
    is_archived: false,
    academic_term_id,
    created_by: created_by || null
  })

  // Handle DB unique constraint in case of race condition
  if (error) {
    if ((error as any).code === "23505") {
      return {
        error:
          "A class with the same Program, Year Level, Section, and Term already exists."
      }
    }
    return { error: error.message }
  }

  return { success: true }
})
