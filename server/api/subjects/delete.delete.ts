// server/api/subjects/delete.delete.ts
import { readBody } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const { id } = await readBody<{ id: string }>(event)

  if (!id) return { error: "Missing subject ID." }

  // 1) Fetch schedules that use this subject
  const { data: schedules, error: schedErr } = await supabase
    .from("schedules")
    .select("id")
    .eq("subject_id", id)

  if (schedErr) return { error: schedErr.message }

  const scheduleIds = (schedules || []).map((s) => s.id)

  // 2) Delete schedule_periods & schedule_history for those schedules
  if (scheduleIds.length > 0) {
    const { error: spErr } = await supabase
      .from("schedule_periods")
      .delete()
      .in("schedule_id", scheduleIds)

    if (spErr) return { error: spErr.message }

    const { error: histErr } = await supabase
      .from("schedule_history")
      .delete()
      .in("schedule_id", scheduleIds)

    if (histErr) return { error: histErr.message }
  }

  // 3) Delete schedules
  const { error: delSchedErr } = await supabase
    .from("schedules")
    .delete()
    .eq("subject_id", id)

  if (delSchedErr) return { error: delSchedErr.message }

  // 4) Delete faculty_subjects links
  const { error: facSubErr } = await supabase
    .from("faculty_subjects")
    .delete()
    .eq("subject_id", id)

  if (facSubErr) return { error: facSubErr.message }

  // 5) Delete class_subjects links
  const { error: classSubErr } = await supabase
    .from("class_subjects")
    .delete()
    .eq("subject_id", id)

  if (classSubErr) return { error: classSubErr.message }


  // 7) Finally delete the subject itself
  const { error: subErr } = await supabase
    .from("subjects")
    .delete()
    .eq("id", id)

  if (subErr) return { error: subErr.message }

  return { success: true }
})
