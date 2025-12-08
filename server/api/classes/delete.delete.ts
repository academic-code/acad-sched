// server/api/classes/delete.delete.ts
import { readBody } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase!
  const { id } = await readBody<{ id?: string }>(event)

  if (!id) return { error: "Missing class ID." }

  const { error } = await supabase.from("classes").delete().eq("id", id)

  if (error) {
    // Foreign key violation → class is referenced by schedules / class_subjects, etc.
    if ((error as any).code === "23503") {
      return {
        error:
          "Cannot delete this class because it is already used in schedules or other records."
      }
    }
    return { error: error.message }
  }

  return { success: true }
})
