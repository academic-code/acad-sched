<template>
  <div>
    <h1 class="text-h5 font-weight-bold mb-6">Subjects</h1>

    <SubjectTable
      :subjects="subjects"
      :departments="departments"
      role="ADMIN"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import SubjectTable from "~/components/SubjectTable.vue"
import type { Subject } from "../../../types/Subject"

definePageMeta({ layout: "admin" })

const { $supabase } = useNuxtApp()

const subjects = ref<Subject[]>([])
const departments = ref<{ id: string; name: string }[]>([])

async function loadSubjects() {
  const { data, error } = await $supabase
    .from("subjects")
    .select("*")
    .order("course_code")

  if (!error && data) {
    subjects.value = data as Subject[]
  }
}

async function loadDepartments() {
  const { data } = await $supabase
    .from("departments")
    .select("id, name")
    .order("name")

  departments.value = (data || []) as { id: string; name: string }[]
}

onMounted(() => {
  loadDepartments()
  loadSubjects()
})
</script>
