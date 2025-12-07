<template>
  <div>
    <h1 class="text-h5 font-weight-bold mb-6">Subjects</h1>

    <!-- SUBJECT FORM (PROGRAM DEAN ONLY) -->
    <SubjectForm
      v-if="!isGenEdDean"
      v-model="formModal"
      :data="selected"
      :saving="saving"
      @save="handleSave"
    />

    <!-- DELETE CONFIRMATION (PROGRAM DEAN ONLY) -->
    <v-dialog v-model="deleteDialog" width="480" v-if="!isGenEdDean">
      <v-card class="pa-4">
        <h3 class="text-h6 font-weight-medium mb-2">Delete Subject</h3>
        <p class="mb-2">
          Are you sure you want to delete
          <strong>{{ pendingDelete?.course_code }} — {{ pendingDelete?.description }}</strong>?
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

        <p class="text-body-2 text-red-darken-1">This action cannot be undone.</p>

        <div class="d-flex justify-end mt-4">
          <v-btn variant="text" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="red" :loading="deleting" class="ml-2" @click="executeDelete">
            Delete
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- SUBJECT LIST -->
    <SubjectTable
      :subjects="subjects"
      :departments="departments"
      :role="isGenEdDean ? 'GENED' : 'DEAN'"
      :can-create="!isGenEdDean"
      :can-edit="isGenEdDean ? undefined : canEditRow"
      :can-delete="isGenEdDean ? undefined : canDeleteRow"
      :show-department-filter="isGenEdDean && departments.length > 0"
      @create="openCreate"
      @edit="openEdit"
      @delete="requestDelete"
    />

    <AppAlert />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue"
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

/* ---------- FORM STATE ---------- */
const formModal = ref(false)
const saving = ref(false)
const selected = ref<Subject | null>(null)

/* ---------- DELETE STATE ---------- */
const deleteDialog = ref(false)
const pendingDelete = ref<Subject | null>(null)
const deleting = ref(false)
const deletePreview = ref<{
  schedules: number
  faculty_assignments: number
  class_links: number
  prerequisites: number
} | null>(null)

/* ---------- PERMISSIONS FOR NORMAL DEAN ---------- */
const canEditRow = (subject: Subject) =>
  !isGenEdDean.value && subject.department_id === deanDepartmentId.value

const canDeleteRow = (subject: Subject) => canEditRow(subject)

/* ---------- CONTEXT LOADING ---------- */
async function loadDeanContext() {
  const { data } = await $supabase.auth.getUser()
  const authUser = data?.user
  if (!authUser) return

  const { data: userRow } = await $supabase
    .from("users")
    .select("id, department_id")
    .eq("auth_user_id", authUser.id)
    .maybeSingle()

  if (!userRow?.department_id) return

  deanDepartmentId.value = userRow.department_id
  deanUserId.value = userRow.id

  const { data: deptRow } = await $supabase
    .from("departments")
    .select("type")
    .eq("id", userRow.department_id)
    .maybeSingle()

  isGenEdDean.value = deptRow?.type === "GENED"
}

/* ---------- LOAD DEPARTMENTS ---------- */
async function loadDepartments() {
  const { data } = await $supabase
    .from("departments")
    .select("id, name, type")
    .order("name")

  departments.value = data || []
}

/* ---------- LOAD SUBJECTS BASED ON ROLE ---------- */
async function loadSubjects() {
  if (!deanDepartmentId.value) return

  if (isGenEdDean.value) {
    // GenEd: view only gened subjects
    const res = await $fetch("/api/subjects/list", {
      query: { role: "GENED" }
    })
    subjects.value = Array.isArray(res) ? res : []
    return
  }

  // Normal Dean: department subjects + visibility of gened
  const deptSubjects = await $fetch("/api/subjects/list", {
    query: {
      role: "DEAN",
      department_id: deanDepartmentId.value
    }
  })

  const genedSubjects = await $fetch("/api/subjects/list", {
    query: { role: "GENED" }
  })

  const combined = [...(deptSubjects || []), ...(genedSubjects || [])] as Subject[]

  const map = new Map<string, Subject>()
  combined.forEach((s) => s.id && map.set(s.id, s))

  subjects.value = [...map.values()]
}

/* ---------- CRUD ---------- */
function openCreate() {
  if (!isGenEdDean.value) {
    selected.value = null
    formModal.value = true
  }
}

function openEdit(subject: Subject) {
  if (!canEditRow(subject)) return showAlert("error", "Not allowed.")
  selected.value = { ...subject }
  formModal.value = true
}

async function handleSave(payload: any) {
  saving.value = true

  const body = {
    ...payload,
    department_id: deanDepartmentId.value,
    created_by: deanUserId.value
  }

  const endpoint = payload.id ? "/api/subjects/update" : "/api/subjects/create"
  const method = payload.id ? "PUT" : "POST"

  const res: any = await $fetch(endpoint, { method, body })

  if (res?.error) showAlert("error", res.error)
  else showAlert("success", payload.id ? "Subject updated." : "Subject created.")

  formModal.value = false
  selected.value = null
  saving.value = false
  loadSubjects()
}

async function requestDelete(subject: Subject) {
  if (!canDeleteRow(subject)) return showAlert("error", "Not allowed.")

  pendingDelete.value = subject
  deleteDialog.value = true

  const res: any = await $fetch("/api/subjects/delete-preview", {
    method: "POST",
    body: { id: subject.id }
  })

  deletePreview.value = res?.counts || null
}

async function executeDelete() {
  if (!pendingDelete.value) return

  deleting.value = true

  const res: any = await $fetch("/api/subjects/delete", {
    method: "DELETE",
    body: { id: pendingDelete.value.id }
  })

  deleting.value = false
  deleteDialog.value = false

  if (res?.error) return showAlert("error", res.error)

  showAlert("success", "Subject deleted.")
  loadSubjects()
}

/* ---------- INIT ---------- */
onMounted(async () => {
  await loadDeanContext()
  await loadDepartments()
  await loadSubjects()
})
</script>
