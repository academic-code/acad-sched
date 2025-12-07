// server/api/subjects/delete-preview.post.ts
import { readBody } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const body = await readBody<{ id: string }>(event)

  const subjectId = body?.id
  if (!subjectId) return { error: "Missing subject ID." }

  // Schedules using this subject
  const { count: schedulesCount, error: schedulesErr } = await supabase
    .from("schedules")
    .select("id", { count: "exact", head: true })
    .eq("subject_id", subjectId)

  if (schedulesErr) return { error: schedulesErr.message }

  // Faculty assignments
  const { count: facultyCount, error: facultyErr } = await supabase
    .from("faculty_subjects")
    .select("id", { count: "exact", head: true })
    .eq("subject_id", subjectId)

  if (facultyErr) return { error: facultyErr.message }

  // Class links
  const { count: classCount, error: classErr } = await supabase
    .from("class_subjects")
    .select("id", { count: "exact", head: true })
    .eq("subject_id", subjectId)

  if (classErr) return { error: classErr.message }

  // Prerequisites (even if you don't use them anymore)

  return {
    success: true,
    counts: {
      schedules: schedulesCount ?? 0,
      faculty_assignments: facultyCount ?? 0,
      class_links: classCount ?? 0,
    }
  }
})
