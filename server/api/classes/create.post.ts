// server/api/classes/create.post.ts
import { readBody } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody<any>(event)

  const {
    department_id,
    year_level_number,
    section,
    academic_term_id,
    adviser_id,
    remarks,
    is_archived
  } = body

  if (!department_id) return { error: "Missing department." }
  if (!year_level_number) return { error: "Year level is required." }
  if (!section || !section.trim()) return { error: "Section is required." }
  if (!academic_term_id) return { error: "Academic term is required." }

  // Get department name for class_name
  const { data: dept, error: deptErr } = await supabase
    .from("departments")
    .select("name")
    .eq("id", department_id)
    .maybeSingle()

  if (deptErr || !dept) return { error: "Department not found." }

  const yearLabel = (() => {
    if (year_level_number === 1) return "1st Year"
    if (year_level_number === 2) return "2nd Year"
    if (year_level_number === 3) return "3rd Year"
    if (year_level_number === 4) return "4th Year"
    return `${year_level_number}th Year`
  })()

  const className = `${dept.name} ${yearLabel} ${section.trim()}`

  const { data, error } = await supabase
    .from("classes")
    .insert({
      department_id,
      year_level_number,
      year_level_label: yearLabel,
      section: section.trim(),
      class_name: className,
      academic_term_id,
      adviser_id: adviser_id || null,
      remarks: remarks || null,
      is_archived: !!is_archived
    })
    .select(`
      id,
      department_id,
      year_level_number,
      year_level_label,
      section,
      class_name,
      adviser_id,
      remarks,
      is_archived,
      academic_term_id,
      academic_term:academic_term_id (
        id,
        semester,
        academic_year,
        label
      ),
      adviser:adviser_id (
        id,
        first_name,
        last_name
      )
    `)
    .single()

  if (error) return { error: error.message }

  const normalized = {
    ...data,
    academic_term: Array.isArray((data as any).academic_term)
      ? (data as any).academic_term[0]
      : (data as any).academic_term,
    adviser: Array.isArray((data as any).adviser)
      ? (data as any).adviser[0]
      : (data as any).adviser
  }

  return { success: true, class: normalized }
})
