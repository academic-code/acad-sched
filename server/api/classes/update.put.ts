// server/api/classes/update.put.ts
import { readBody } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody<any>(event)

  const { id } = body
  if (!id) return { error: "Missing class ID." }

  // Fetch current row to support partial updates and recomputing labels
  const { data: current, error: currentErr } = await supabase
    .from("classes")
    .select("department_id, year_level_number, year_level_label, section, class_name")
    .eq("id", id)
    .maybeSingle()

  if (currentErr || !current) {
    return { error: "Class not found." }
  }

  const departmentId = body.department_id || current.department_id
  const yearLevelNumber = body.year_level_number || current.year_level_number
  const section =
    typeof body.section === "string" ? body.section.trim() : current.section

  const updatePayload: any = {}

  // Always keep department/year/section in sync when provided
  if (body.department_id) updatePayload.department_id = departmentId
  if (body.year_level_number) updatePayload.year_level_number = yearLevelNumber
  if (body.section !== undefined) updatePayload.section = section

  if (body.academic_term_id) {
    updatePayload.academic_term_id = body.academic_term_id
  }

  if ("adviser_id" in body) {
    updatePayload.adviser_id = body.adviser_id || null
  }

  if ("remarks" in body) {
    updatePayload.remarks = body.remarks || null
  }

  if ("is_archived" in body) {
    updatePayload.is_archived = !!body.is_archived
  }

  // Recompute year_level_label + class_name when level/section/department changed
  const levelChanged = !!body.year_level_number
  const sectionChanged = body.section !== undefined
  const deptChanged = !!body.department_id

  if (levelChanged || sectionChanged || deptChanged) {
    const yearLabel = (() => {
      if (yearLevelNumber === 1) return "1st Year"
      if (yearLevelNumber === 2) return "2nd Year"
      if (yearLevelNumber === 3) return "3rd Year"
      if (yearLevelNumber === 4) return "4th Year"
      return `${yearLevelNumber}th Year`
    })()

    updatePayload.year_level_label = yearLabel

    // Get department for name
    const { data: dept, error: deptErr } = await supabase
      .from("departments")
      .select("name")
      .eq("id", departmentId)
      .maybeSingle()

    if (deptErr || !dept) {
      return { error: "Department not found for class update." }
    }

    updatePayload.class_name = `${dept.name} ${yearLabel} ${section}`
  }

  // (rename_mode is accepted but not used yet; you can log it if needed)
  // const renameMode = body.rename_mode as "CASCADE" | "LOCAL" | undefined

  const { data, error } = await supabase
    .from("classes")
    .update(updatePayload)
    .eq("id", id)
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
