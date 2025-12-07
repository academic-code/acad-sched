// server/api/classes/assign-subjects.post.ts
import { readBody } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody<{ class_id?: string }>(event)

  if (!body.class_id) return { error: "Missing class_id." }

  // 1) Load class
  const { data: cls, error: classErr } = await supabase
    .from("classes")
    .select("id, department_id, year_level_number, academic_term_id")
    .eq("id", body.class_id)
    .maybeSingle()

  if (classErr || !cls) {
    return { error: "Class not found." }
  }

  // 2) Determine term: use class.academic_term_id or active term
  let termId = cls.academic_term_id
  let term: any = null

  if (termId) {
    const { data: t, error: termErr } = await supabase
      .from("academic_terms")
      .select("id, semester, academic_year, label")
      .eq("id", termId)
      .maybeSingle()

    if (termErr || !t) {
      return { error: "Academic term not found for this class." }
    }
    term = t
  } else {
    const { data: t, error: termErr } = await supabase
      .from("academic_terms")
      .select("id, semester, academic_year, label")
      .eq("is_active", true)
      .maybeSingle()

    if (termErr || !t) {
      return { error: "No active academic term set." }
    }
    term = t
    termId = t.id
  }

  // 3) Find matching subjects (major subjects only, same department + year + semester)
  const { data: subjects, error: subjErr } = await supabase
    .from("subjects")
    .select("id")
    .eq("department_id", cls.department_id)
    .eq("year_level_number", cls.year_level_number)
    .eq("semester", term.semester)

  if (subjErr) {
    return { error: subjErr.message }
  }

  if (!subjects || subjects.length === 0) {
    return {
      success: true,
      assignedCount: 0,
      termLabel: `${term.academic_year} • ${term.semester}`
    }
  }

  const rows = subjects.map(s => ({
    class_id: cls.id,
    subject_id: s.id,
    academic_term_id: termId
  }))

  const { error: insertErr } = await supabase
    .from("class_subjects")
    .insert(rows)

  if (insertErr) {
    return { error: insertErr.message }
  }

  return {
    success: true,
    assignedCount: subjects.length,
    termLabel: `${term.academic_year} • ${term.semester}`
  }
})
