<template>
  <div>
    <h1 class="text-h5 font-weight-bold mb-6">Subjects</h1>

    <SubjectForm
      v-model="modal"
      :data="selected"
      :canSetGenEd="isGenEdDean"
      @save="saveSubject"
    />

    <SubjectTable
      :subjects="subjects"
      :departments="departments"
      role="DEAN"
      :isGenEdDean="isGenEdDean"
      @create="openCreate"
      @edit="openEdit"
      @delete="deleteSubject"
    />
  </div>
</template>


<script setup lang="ts">
import { ref, onMounted } from "vue"
import SubjectTable from "~/components/SubjectTable.vue"
import SubjectForm from "~/components/SubjectForm.vue"
import type { Subject } from "../../../types/Subject"
import { useAlert } from "~/composables/useAlert"

definePageMeta({ layout: "dean" })

const { $supabase } = useNuxtApp()
const { showAlert } = useAlert()

const subjects = ref<Subject[]>([])
const departments = ref<{ id: string; name: string; type?: string }[]>([])
const modal = ref(false)
const selected = ref<Subject | null>(null)
const deanDepartmentId = ref<string>("")
const isGenEdDean = ref(false)

/** Helper so TypeScript stops complaining */
function isError(res: any): res is { error: string } {
  return typeof res === "object" && res !== null && "error" in res
}

async function loadDean() {
  const { data } = await $supabase.auth.getUser()
  const user = data?.user
  if (!user) return

  const { data: userRow } = await $supabase
    .from("users")
    .select("department_id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (!userRow?.department_id) return

  deanDepartmentId.value = userRow.department_id

  const { data: dept } = await $supabase
    .from("departments")
    .select("type")
    .eq("id", userRow.department_id)
    .maybeSingle()

  isGenEdDean.value = dept?.type === "GENED"
}

async function loadSubjects() {
  if (!deanDepartmentId.value) return

  const res = await $fetch("/api/subjects/list", {
    query: {
      role: isGenEdDean.value ? "GENED" : "DEAN",
      department_id: deanDepartmentId.value
    }
  })

  subjects.value = Array.isArray(res) ? res : []
}

async function loadDepartments() {
  const { data } = await $supabase.from("departments").select("id,name,type")
  departments.value = data || []
}

function openCreate() {
  if (isGenEdDean.value) return showAlert("error", "GenEd dean cannot create subjects.")
  selected.value = null
  modal.value = true
}

function openEdit(subject: Subject) {
  if (isGenEdDean.value) return showAlert("error", "GenEd dean cannot edit subjects.")
  selected.value = { ...subject }
  modal.value = true
}

async function saveSubject(payload: Subject) {
  const body: Subject = {
    ...payload,
    department_id: deanDepartmentId.value
  }

  const endpoint = payload.id ? "/api/subjects/update" : "/api/subjects/create"

  const res = await $fetch(endpoint, {
    method: payload.id ? "PUT" : "POST",
    body
  })

  if (isError(res)) return showAlert("error", res.error)

  showAlert("success", payload.id ? "Subject updated successfully" : "Subject created successfully")
  modal.value = false
  loadSubjects()
}

async function deleteSubject(subject: Subject) {
  if (isGenEdDean.value) return showAlert("error", "GenEd dean cannot delete subjects.")

  const res = await $fetch("/api/subjects/delete", {
    method: "DELETE",
    body: { id: subject.id }
  })

  if (isError(res)) return showAlert("error", res.error)

  showAlert("success", "Subject deleted.")
  loadSubjects()
}

onMounted(async () => {
  await loadDean()
  await loadDepartments()
  await loadSubjects()
})
</script>



