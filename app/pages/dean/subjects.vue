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

async function loadCurrentDeanDepartment() {
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
    .select("id, name, type")
    .eq("id", userRow.department_id)
    .maybeSingle()

  if (dept?.type === "GENED") {
    isGenEdDean.value = true
  }
}

async function loadDepartments() {
  const { data } = await $supabase
    .from("departments")
    .select("id, name, type")
    .order("name")

  departments.value = (data || []) as { id: string; name: string; type?: string }[]
}

async function loadSubjects() {
  if (!deanDepartmentId.value) return

  const res = await $fetch<Subject[]>("/api/subjects/list", {
    query: {
      role: "DEAN",
      department_id: deanDepartmentId.value
    }
  })

  subjects.value = Array.isArray(res) ? res : []
}

function openCreate() {
  selected.value = null
  modal.value = true
}

function openEdit(subject: Subject) {
  selected.value = { ...subject }
  modal.value = true
}

async function saveSubject(payload: Subject) {
  if (!deanDepartmentId.value) {
    showAlert("error", "Dean department not detected.")
    return
  }

  const subject: Subject = {
    ...payload,
    department_id: deanDepartmentId.value,
    is_gened: isGenEdDean.value ? payload.is_gened : false
  }

  const endpoint = subject.id
    ? "/api/subjects/update"
    : "/api/subjects/create"

  const res = await $fetch<{ error?: string; success?: boolean }>(endpoint, {
    method: subject.id ? "PUT" : "POST",
    body: subject
  })

  if (res.error) {
    showAlert("error", res.error)
    return
  }

  showAlert("success", subject.id ? "Subject updated." : "Subject created.")
  modal.value = false
  await loadSubjects()
}

async function deleteSubject(subject: Subject) {
  const res = await $fetch<{ error?: string; success?: boolean }>(
    "/api/subjects/delete",
    {
      method: "DELETE",
      body: { id: subject.id }
    }
  )

  if (res.error) {
    showAlert("error", res.error)
    return
  }

  showAlert("success", "Subject deleted.")
  await loadSubjects()
}

onMounted(async () => {
  await loadCurrentDeanDepartment()
  await loadDepartments()
  await loadSubjects()
})
</script>
