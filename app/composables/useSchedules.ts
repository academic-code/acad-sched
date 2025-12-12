// app/composables/useSchedules.ts
import { useNuxtApp } from "#app"

export function useSchedules() {
  const nuxt = useNuxtApp()
  const supabase = nuxt.$supabase

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ""
  }

  async function listSchedules(view: "CLASS" | "FACULTY" | "ROOM", target_id: string, academic_term_id?: string) {
    const token = await getToken()
    return await $fetch("/api/schedules/list", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      params: { view, target_id, academic_term_id: academic_term_id || "" }
    })
  }

  async function getByClass(class_id: string, academic_term_id: string) {
    const token = await getToken()
    return await $fetch("/api/schedules/by-class", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      params: { class_id, academic_term_id }
    })
  }

  async function getByFaculty(faculty_id: string, academic_term_id: string) {
    const token = await getToken()
    return await $fetch("/api/schedules/by-faculty", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      params: { faculty_id, academic_term_id }
    })
  }

  async function getByRoom(room_id: string, academic_term_id: string) {
    const token = await getToken()
    return await $fetch("/api/schedules/by-room", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      params: { room_id, academic_term_id }
    })
  }

  async function saveSchedule(payload: any) {
    const token = await getToken()
    return await $fetch("/api/schedules/save", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: payload
    })
  }

  async function deleteSchedule(id: string) {
    const token = await getToken()
    return await $fetch("/api/schedules/delete", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: { id }
    })
  }

  async function undoSchedule(id: string) {
    const token = await getToken()
    return await $fetch("/api/schedules/undo", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: { id }
    })
  }

  return {
    listSchedules,
    getByClass,
    getByFaculty,
    getByRoom,
    saveSchedule,
    deleteSchedule,
    undoSchedule
  }
}
