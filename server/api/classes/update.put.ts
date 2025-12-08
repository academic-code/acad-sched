// server/api/classes/update.put.ts
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

  const id = body.id as string | undefined
  if (!id) return { error: "Missing class ID." }

  const department_id = body.department_id as string | undefined
  const program_name_raw = body.program_name as string | undefined
  const year_level_number = body.year_level_number as number | undefined
  const section_raw = body.section as string | undefined
  const class_name_raw = body.class_name as string | undefined
  const academic_term_id = body.academic_term_id as string | undefined
  const adviser_id = body.adviser_id as string | null | undefined
  const remarks = body.remarks as string | undefined

  if (!department_id) return { error: "Department is required." }
  if (!program_name_raw || !program_name_raw.trim()) return { error: "Program name is required." }
  if (!year_level_number) return { error: "Year level is required." }
  if (!section_raw || !section_raw.trim()) return { error: "Section is required." }
  if (!class_name_raw || !class_name_raw.trim()) return { error: "Class name is required." }
  if (!academic_term_id) return { error: "Academic term is required." }

// ---- Prevent updating class in inactive academic term ----
const { data: term } = await supabase
  .from("academic_terms")
  .select("is_active")
  .eq("id", academic_term_id)
  .maybeSingle()

if (!term?.is_active) {
  return { error: "Cannot update a class linked to an inactive academic term." }
}



  const program_name = program_name_raw.trim()
  const section = section_raw.trim().toUpperCase()
  const class_name = class_name_raw.trim()
  const year_level_label = body.year_level_label || yearLabelFromNumber(year_level_number)

  // ----- UNIQUENESS CHECK (excluding this ID) -----
  const { data: conflict, error: checkErr } = await supabase
    .from("classes")
    .select("id")
    .match({
      academic_term_id,
      program_name,
      year_level_number,
      section
    })
    .neq("id", id)
    .maybeSingle()

  if (checkErr) return { error: checkErr.message }

  if (conflict) {
    return {
      error:
        "Another class with the same Program, Year Level, Section, and Term already exists."
    }
  }

  // ----- UPDATE -----
  const { error } = await supabase
    .from("classes")
    .update({
      department_id,
      program_name,
      year_level_number,
      year_level_label,
      section,
      class_name,
      adviser_id: adviser_id || null,
      remarks: remarks || null,
      academic_term_id
    })
    .eq("id", id)

  if (error) {
    if ((error as any).code === "23505") {
      return {
        error:
          "Another class with the same Program, Year Level, Section, and Term already exists."
      }
    }
    return { error: error.message }
  }

  return { success: true }
})
