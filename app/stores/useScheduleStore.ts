import { defineStore } from "pinia"
import { useSchedules } from "@/composables/useSchedules"

// Types for strong typing
export interface ScheduleRecord {
  id: string
  class_id: string
  subject_id: string
  faculty_id: string | null
  room_id: string | null
  department_id: string
  day: string
  mode: string
  academic_term_id: string
  period_start_id: string
  period_end_id: string
  is_deleted: boolean
  period_start?: { id: string; slot_index: number }
  period_end?: { id: string; slot_index: number }
  subject?: any
  faculty?: any
  room?: any
  class?: any
}

export const useScheduleStore = defineStore("scheduleStore", {
  state: () => ({
    schedules: [] as ScheduleRecord[],
    loading: false as boolean,
    view: "CLASS" as "CLASS" | "FACULTY" | "ROOM",
    target_id: "" as string,
    academic_term_id: "" as string
  }),

  getters: {
    sorted(state) {
      return [...state.schedules].sort((a, b) => {
        if (a.day !== b.day) return a.day.localeCompare(b.day)
        return (a.period_start?.slot_index || 0) - (b.period_start?.slot_index || 0)
      })
    }
  },

  actions: {
    // ---------------------------------------------------------
    // Load schedules using B1 list.get.ts
    // ---------------------------------------------------------
    async load(view: "CLASS" | "FACULTY" | "ROOM", target_id: string, academic_term_id: string) {
      try {
        this.loading = true
        this.view = view
        this.target_id = target_id
        this.academic_term_id = academic_term_id

        const api = useSchedules()
        const data = await api.listSchedules(view, target_id, academic_term_id)

        this.schedules = Array.isArray(data) ? data : []
      } catch (err) {
        console.error("ScheduleStore.load error:", err)
      } finally {
        this.loading = false
      }
    },

    // ---------------------------------------------------------
    // CREATE (B3 save OR B4 create)
    // ---------------------------------------------------------
    async createSchedule(payload: any) {
      const api = useSchedules()
      const res = await api.createSchedule(payload)

      // Refresh list immediately (perfect sync)
      await this.load(this.view, this.target_id, this.academic_term_id)

      return res
    },

    // ---------------------------------------------------------
    // UPDATE (B5 update)
    // ---------------------------------------------------------
    async updateSchedule(payload: any) {
      const api = useSchedules()
      const res = await api.updateSchedule(payload)

      await this.load(this.view, this.target_id, this.academic_term_id)

      return res
    },

    // ---------------------------------------------------------
    // SAVE (B3 unified CREATE+UPDATE)
    // ---------------------------------------------------------
    async saveSchedule(payload: any) {
      const api = useSchedules()
      const res = await api.saveSchedule(payload)

      await this.load(this.view, this.target_id, this.academic_term_id)

      return res
    },

    // ---------------------------------------------------------
    // DELETE (B6 delete)
    // ---------------------------------------------------------
    async deleteSchedule(id: string) {
      const api = useSchedules()
      const res = await api.deleteSchedule(id)

      await this.load(this.view, this.target_id, this.academic_term_id)

      return res
    },

    // ---------------------------------------------------------
    // UNDO (B7 undo)
    // ---------------------------------------------------------
    async undoSchedule(id: string) {
      const api = useSchedules()
      const res = await api.undoSchedule(id)

      await this.load(this.view, this.target_id, this.academic_term_id)

      return res
    }
  }
})
