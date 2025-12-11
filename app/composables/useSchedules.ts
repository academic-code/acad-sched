// app/composables/useSchedules.ts
// Unified frontend service for all schedule operations (B1–B7)
// Uses $fetch and global supabase injection for auth tokens.

import { useNuxtApp } from "#app"

export function useSchedules() {
  const nuxt = useNuxtApp()
  const supabase = nuxt.$supabase

  // ----------------------------------------
  // Helper: get current access token
  // ----------------------------------------
  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ""
  }

  // ============================================================
  // B1 — list.get.ts
  // ============================================================
  async function listSchedules(view: "CLASS" | "FACULTY" | "ROOM", target_id: string, academic_term_id?: string) {
    const token = await getToken()

    return await $fetch("/api/schedules/list", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      params: {
        view,
        target_id,
        academic_term_id: academic_term_id || ""
      }
    })
  }

  // ============================================================
  // B2 — by-class / by-faculty / by-room
  // ============================================================

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

  // ============================================================
  // B3 — save.post.ts (Create + Update unified)
  // ============================================================
  async function saveSchedule(payload: any) {
    const token = await getToken()
    return await $fetch("/api/schedules/save", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: payload
    })
  }

  // ============================================================
  // B4 — create.post.ts (Strict CREATE only)
  // ============================================================
  async function createSchedule(payload: any) {
    const token = await getToken()
    return await $fetch("/api/schedules/create", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: payload
    })
  }

  // ============================================================
  // B5 — update.post.ts (Strict UPDATE only)
  // ============================================================
  async function updateSchedule(payload: any) {
    const token = await getToken()
    return await $fetch("/api/schedules/update", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: payload
    })
  }

  // ============================================================
  // B6 — delete.post.ts (soft delete)
  // ============================================================
  async function deleteSchedule(id: string) {
    const token = await getToken()
    return await $fetch("/api/schedules/delete", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: { id }
    })
  }

  // ============================================================
  // B7 — undo.post.ts (undo create)
  // ============================================================
  async function undoSchedule(id: string) {
    const token = await getToken()
    return await $fetch("/api/schedules/undo", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: { id }
    })
  }

  // ============================================================
  // Return complete API
  // ============================================================
  return {
    listSchedules,
    getByClass,
    getByFaculty,
    getByRoom,
    createSchedule,
    updateSchedule,
    saveSchedule,
    deleteSchedule,
    undoSchedule
  }
}
