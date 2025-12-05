import { readBody } from "h3"

export default defineEventHandler(async (event) => {
  const supabase = globalThis.$supabase
  if (!supabase) return { error: "Supabase not initialized." }

  const { overwrite } = await readBody(event)

  const { data: existing } = await supabase.from("periods").select("*")

  if (existing?.length && !overwrite) {
    return { error: "Periods already exist. Enable Overwrite to replace." }
  }

  if (overwrite) {
    await supabase.from("periods").delete().neq("id", "00000000-0000-0000-0000-000000000000")
  }

  const periods = []
  let slot = 1

  for (let h = 6; h < 21; h++) {
    for (let m of [0, 30]) {
      const start = `${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}:00`

      let nh = h, nm = m + 30
      if (nm >= 60) { nh++; nm = 0 }

      const end = `${nh.toString().padStart(2,"0")}:${nm.toString().padStart(2,"0")}:00`

      periods.push({
        slot_index: slot++,
        start_time: start,
        end_time: end,
        is_auto_generated: true
      })
    }
  }

  const { error } = await supabase.from("periods").insert(periods)
  if (error) return { error: error.message }

  return { success: true, count: periods.length }
})
