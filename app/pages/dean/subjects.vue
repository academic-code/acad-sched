<template>
  <div>
    <h1 class="text-h5 font-weight-bold mb-6">Subjects</h1>

    <!-- SUBJECT FORM DIALOG (PROGRAM DEAN ONLY) -->
    <SubjectForm
      v-if="!isGenEdDean"
      v-model="formModal"
      :data="selected"
      :saving="saving"
      @save="handleSave"
    />

    <!-- HARD DELETE CONFIRMATION (PROGRAM DEAN ONLY) -->
    <v-dialog v-model="deleteDialog" width="480" v-if="!isGenEdDean">
      <v-card class="pa-4">
        <h3 class="text-h6 font-weight-medium mb-2">Delete Subject</h3>
        <p class="mb-2">
          Are you sure you want to delete
          <strong>
            {{ pendingDelete?.course_code }} — {{ pendingDelete?.description }}
          </strong>?
        </p>

        <div v-if="deletePreview" class="text-body-2 mb-3">
          <p class="mb-1">This will also delete:</p>
          <ul class="pl-4">
            <li>{{ deletePreview.schedules }} linked schedules</li>
            <li>{{ deletePreview.faculty_assignments }} faculty assignments</li>
            <li>{{ deletePreview.class_links }} class links</li>
            <li>{{ deletePreview.prerequisites }} prerequisite relations</li>
          </ul>
        </div>

        <p class="text-body-2 text-red-darken-1">
          This action cannot be undone.
        </p>

        <div class="d-flex justify-end mt-4">
          <v-btn variant="text" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="red" :loading="deleting" class="ml-2" @click="executeDelete">
            Delete
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- SUBJECT DASHBOARD / LIST -->
    <SubjectTable
      :subjects="subjects"
      :departments="departments"
      :role="isGenEdDean ? 'GENED' : 'DEAN'"
      :can-create="!isGenEdDean"
      :can-edit="isGenEdDean ? undefined : canEditRow"
      :can-delete="isGenEdDean ? undefined : canDeleteRow"
      :show-department-filter="isGenEdDean"
      @create="openCreate"
      @edit="openEdit"
      @delete="requestDelete"
    />

    <AppAlert />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue"

import { useRefreshRouter } from "~/composables/useRefreshRouter"

import SubjectTable from "~/components/SubjectTable.vue"
import SubjectForm from "~/components/SubjectForm.vue"
import AppAlert from "~/components/AppAlert.vue"
import { useAlert } from "~/composables/useAlert"
import type { Subject } from "../../../types/Subject"

definePageMeta({ layout: "dean" })

const { $supabase } = useNuxtApp()
const { showAlert } = useAlert()

const subjects = ref<Subject[]>([])
const departments = ref<{ id: string; name: string; type?: string }[]>([])

const deanDepartmentId = ref<string>("")
const deanUserId = ref<string | null>(null)
const isGenEdDean = ref(false)

/* ---------- FORM STATE (PROGRAM DEAN) ---------- */
const formModal = ref(false)
const saving = ref(false)
const selected = ref<Subject | null>(null)

/* ---------- DELETE STATE (PROGRAM DEAN) ---------- */
const deleteDialog = ref(false)
const pendingDelete = ref<Subject | null>(null)
const deleting = ref(false)
const deletePreview = ref<{
  schedules: number
  faculty_assignments: number
  class_links: number
  prerequisites: number
} | null>(null)

/* ---------- PERMISSIONS (PROGRAM DEAN ONLY) ---------- */
const canCreate = computed(() => !isGenEdDean.value)

function canEditRow(subject: Subject): boolean {
  // Program dean: only subjects in their own department
  if (isGenEdDean.value) return false
  return subject.department_id === deanDepartmentId.value
}

function canDeleteRow(subject: Subject): boolean {
  return canEditRow(subject)
}

/* ---------- LOAD CONTEXT ---------- */
async function loadDeanContext() {
  const { data } = await $supabase.auth.getUser()
  const authUser = data?.user
  if (!authUser) return

  const { data: userRow, error: userErr } = await $supabase
    .from("users")
    .select("id, department_id")
    .eq("auth_user_id", authUser.id)
    .maybeSingle()

  if (userErr || !userRow?.department_id) {
    showAlert("error", "Unable to load dean profile.")
    return
  }

  deanDepartmentId.value = userRow.department_id
  deanUserId.value = userRow.id

  const { data: deptRow } = await $supabase
    .from("departments")
    .select("type")
    .eq("id", userRow.department_id)
    .maybeSingle()

  isGenEdDean.value = deptRow?.type === "GENED"
}

async function loadDepartments() {
  const { data } = await $supabase
    .from("departments")
    .select("id, name, type")
    .order("name")

  departments.value = (data || []) as { id: string; name: string; type?: string }[]
}

/* ---------- LOAD SUBJECTS (BASED ON ROLE) ---------- */
async function loadSubjects() {
  const { data: { session } } = await $supabase.auth.getSession()

  if (!session) return

  // ---- GENED DEAN VIEW ----
  if (isGenEdDean.value) {
    const res = await $fetch("/api/subjects/list", {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      },
      query: { role: "GENED" }
    })

    subjects.value = Array.isArray(res) ? res : []
    return
  }

  // ---- PROGRAM DEAN VIEW ----

  // 1️⃣ Department subjects
  const deptSubjects = await $fetch("/api/subjects/list", {
    headers: {
      Authorization: `Bearer ${session.access_token}`
    },
    query: {
      role: "DEAN",
      department_id: deanDepartmentId.value
    }
  })

  // 2️⃣ GenEd subjects
  const genedSubjects = await $fetch("/api/subjects/list", {
    headers: {
      Authorization: `Bearer ${session.access_token}`
    },
    query: {
      role: "GENED"
    }
  })

  const combined = [
    ...(Array.isArray(deptSubjects) ? deptSubjects : []),
    ...(Array.isArray(genedSubjects) ? genedSubjects : [])
  ]

  subjects.value = Array.from(new Map(combined.map(s => [s.id, s])).values())
}





/* ---------- FORM HANDLERS (PROGRAM DEAN) ---------- */
function openCreate() {
  if (isGenEdDean.value) return
  selected.value = null
  formModal.value = true
}

function openEdit(subject: Subject) {
  if (!canEditRow(subject)) {
    showAlert("error", "You can only edit subjects in your own department.")
    return
  }
  selected.value = { ...subject }
  formModal.value = true
}

type FormSavePayload = {
  id?: string
  year_level_number: number
  year_level_label: string
  semester: string
  course_code: string
  description: string
  lec: number
  lab: number
  units: number
  is_gened: boolean
}

async function handleSave(payloads: FormSavePayload[]) {
  if (!deanDepartmentId.value || !deanUserId.value) {
    showAlert("error", "Dean context not loaded.")
    return
  }

  saving.value = true

  try {
    for (const payload of payloads) {
      const body: any = {
        ...payload,
        department_id: deanDepartmentId.value,
        created_by: deanUserId.value
      }

      if (payload.id) {
        // UPDATE
        const res: any = await $fetch("/api/subjects/update", {
          method: "PUT",
          body
        })
        if (res?.error) throw new Error(res.error)
      } else {
        // CREATE
        const res: any = await $fetch("/api/subjects/create", {
          method: "POST",
          body
        })
        if (res?.error) throw new Error(res.error)
      }
    }

    showAlert("success", "Subject(s) saved.")
    formModal.value = false
    selected.value = null
    await loadSubjects()
  } catch (err: any) {
    showAlert("error", err?.message || "Failed to save subject(s).")
  } finally {
    saving.value = false
  }
}

/* ---------- DELETE FLOW (PROGRAM DEAN) ---------- */
async function requestDelete(subject: Subject) {
  if (!canDeleteRow(subject)) {
    showAlert("error", "You can only delete subjects in your own department.")
    return
  }

  pendingDelete.value = subject
  deletePreview.value = null
  deleteDialog.value = true

  try {
    const res: any = await $fetch("/api/subjects/delete-preview", {
      method: "POST",
      body: { id: subject.id }
    })

    if (res?.error) throw new Error(res.error)

    deletePreview.value = res.counts || null
  } catch (err: any) {
    showAlert("error", err?.message || "Failed to load delete impact.")
  }
}

async function executeDelete() {
  if (!pendingDelete.value) return
  deleting.value = true

  try {
    const res: any = await $fetch("/api/subjects/delete", {
      method: "DELETE",
      body: { id: pendingDelete.value.id }
    })

    if (res?.error) throw new Error(res.error)

    showAlert("success", "Subject deleted.")
    deleteDialog.value = false
    pendingDelete.value = null
    await loadSubjects()
  } catch (err: any) {
    showAlert("error", err?.message || "Failed to delete subject.")
  } finally {
    deleting.value = false
  }
}

/* ---------- INIT ---------- */
onMounted(async () => {
  await loadDeanContext()
  await loadDepartments()
  await loadSubjects()
})

/* ---------------------- 🔄 AUTO REFRESH ---------------------- */
useRefreshRouter({
  subjects: loadSubjects,
  departments: loadDepartments
})
</script>