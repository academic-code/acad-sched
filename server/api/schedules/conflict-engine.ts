// server/api/schedules/conflict-engine.ts
import { createError } from "h3"
import type { ScheduleDay } from "./_helpers"   // <-- import the type

type SupabaseClientLike = any

export type PeriodRow = { id: string; slot_index: number }
export type ScheduleRow = any

export type ConflictResult = {
  classConflicts: ScheduleRow[]
  facultyConflicts: ScheduleRow[]
  roomConflicts: ScheduleRow[]
  hard: ScheduleRow[]
  soft: ScheduleRow[]
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart <= bEnd && bStart <= aEnd
}

export class ConflictEngine {
  supabase: SupabaseClientLike

  constructor(supabase: SupabaseClientLike) {
    this.supabase = supabase
  }

  async loadSlotMap() : Promise<Map<string, number>> {
    const { data: periodRows, error: periodErr } = await this.supabase
      .from("periods")
      .select("id, slot_index")
      .order("slot_index", { ascending: true })

    if (periodErr) throw createError({ statusCode: 500, message: "Failed to load periods." })
    if (!periodRows || periodRows.length === 0) throw createError({ statusCode: 500, message: "Periods not configured." })

    const map = new Map<string, number>()
    for (const p of periodRows) map.set(String(p.id), Number(p.slot_index))
    return map
  }

  getScheduleSlotRange(slotMap: Map<string, number>, scheduleRow: any) : { start: number, end: number } | null {
    if (!scheduleRow) return null
    const sStart = slotMap.get(String(scheduleRow.period_start_id))
    const sEnd = slotMap.get(String(scheduleRow.period_end_id))
    if (sStart == null || sEnd == null) return null
    return { start: Math.min(sStart, sEnd), end: Math.max(sStart, sEnd) }
  }

  async findConflicts(params: {
    class_id: string
    faculty_id?: string | null
    room_id?: string | null
    day: string | ScheduleDay
    period_start_id: string
    period_end_id: string
    academic_term_id: string
    excludeScheduleId?: string | null
  }): Promise<ConflictResult> {
    const {
      class_id,
      faculty_id,
      room_id,
      day,
      period_start_id,
      period_end_id,
      academic_term_id,
      excludeScheduleId = null
    } = params

    const slotMap = await this.loadSlotMap()
    const startIndex = slotMap.get(String(period_start_id))
    const endIndex = slotMap.get(String(period_end_id))
    if (startIndex == null || endIndex == null) throw createError({ statusCode: 400, message: "Invalid period selected." })
    const minIndex = Math.min(startIndex, endIndex)
    const maxIndex = Math.max(startIndex, endIndex)

    let req = this.supabase
      .from("schedules")
      .select("*")
      .eq("day", day)
      .eq("academic_term_id", academic_term_id)
      .eq("is_deleted", false)

    if (excludeScheduleId) req = req.neq("id", excludeScheduleId)

    const orParts = [`class_id.eq.${class_id}`]
    if (faculty_id) orParts.push(`faculty_id.eq.${faculty_id}`)
    if (room_id) orParts.push(`room_id.eq.${room_id}`)

    req = req.or(orParts.join(","))

    const { data: candidates, error: fetchErr } = await req
    if (fetchErr) throw createError({ statusCode: 500, message: fetchErr.message || "Failed to check conflicts." })

    const classConf: ScheduleRow[] = []
    const facultyConf: ScheduleRow[] = []
    const roomConf: ScheduleRow[] = []

    let roomSharing: string | null = null
    if (room_id) {
      const { data: roomRow, error: roomErr } = await this.supabase
        .from("rooms")
        .select("room_sharing")
        .eq("id", room_id)
        .maybeSingle()
      if (roomErr) throw createError({ statusCode: 500, message: "Failed to load room info." })
      roomSharing = roomRow?.room_sharing ?? null
    }

    for (const s of (candidates || [])) {
      const sStart = slotMap.get(String(s.period_start_id))
      const sEnd = slotMap.get(String(s.period_end_id))
      if (sStart == null || sEnd == null) continue
      const sMin = Math.min(sStart, sEnd)
      const sMax = Math.max(sStart, sEnd)
      const overlaps = rangesOverlap(minIndex, maxIndex, sMin, sMax)
      if (!overlaps) continue

      if (s.class_id === class_id) classConf.push(s)
      if (faculty_id && s.faculty_id === faculty_id) facultyConf.push(s)
      if (room_id && s.room_id === room_id) {
        if (!roomSharing || String(roomSharing).toUpperCase() === "PRIVATE") {
          roomConf.push(s)
        } else {
          // SHARED -> allowed
        }
      }
    }

    const hard = [...classConf, ...roomConf]
    const soft = [...facultyConf]

    return {
      classConflicts: classConf,
      facultyConflicts: facultyConf,
      roomConflicts: roomConf,
      hard,
      soft
    }
  }

  async softDeleteConflicts(scheduleIds: string[], actorId: string | null) {
    if (!scheduleIds || scheduleIds.length === 0) return { success: true, deletedIds: [] }

    const nowIso = new Date().toISOString()
    const { error: delErr } = await this.supabase
      .from("schedules")
      .update({ is_deleted: true, updated_at: nowIso })
      .in("id", scheduleIds)

    if (delErr) throw createError({ statusCode: 500, message: delErr.message || "Failed to soft-delete conflicts." })

    for (const sid of scheduleIds) {
      const { error: histErr } = await this.supabase.from("schedule_history").insert({
        schedule_id: sid,
        action: "FORCE_REPLACE",
        old_data: null,
        new_data: null,
        performed_by: actorId,
        performed_at: nowIso
      })
      if (histErr) {
        console.error("Failed to insert schedule_history for FORCE_REPLACE:", histErr)
      }
    }

    return { success: true, deletedIds: scheduleIds }
  }

  async validateRoomSharingPolicy(params: {
    room_id?: string | null
    day: string | ScheduleDay
    period_start_id: string
    period_end_id: string
    academic_term_id: string
    excludeScheduleId?: string | null
  }) {
    const { room_id, day, period_start_id, period_end_id, academic_term_id, excludeScheduleId } = params
    if (!room_id) return { ok: true }

    const { data: roomRow, error: roomErr } = await this.supabase
      .from("rooms")
      .select("room_sharing")
      .eq("id", room_id)
      .maybeSingle()

    if (roomErr) throw createError({ statusCode: 500, message: "Failed to load room info." })
    const roomSharing = roomRow?.room_sharing ?? "PRIVATE"

    if (String(roomSharing).toUpperCase() === "SHARED") {
      return { ok: true }
    }

    const fakeClassId = "__DUMMY_CLASS_FOR_ROOM_CHECK__"
    const conflicts = await this.findConflicts({
      class_id: fakeClassId,
      faculty_id: null,
      room_id,
      day,
      period_start_id,
      period_end_id,
      academic_term_id,
      excludeScheduleId
    })

    if (conflicts.roomConflicts && conflicts.roomConflicts.length > 0) {
      return { ok: false, reason: "ROOM_CONFLICT", conflicts: conflicts.roomConflicts }
    }

    return { ok: true }
  }
}
