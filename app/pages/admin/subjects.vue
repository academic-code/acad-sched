<template>
  <div>
    <h1 class="text-h5 font-weight-bold mb-6">Subjects</h1>

    <SubjectTable
      :subjects="subjects"
      :departments="departments"
      role="ADMIN"
      :can-create="false"
      :show-department-filter="true"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import SubjectTable from "~/components/SubjectTable.vue"
import type { Subject } from "../../../types/Subject"
import { useRefreshRouter } from "~/composables/useRefreshRouter" // ✅ added

definePageMeta({ layout: "admin" })

const { $supabase } = useNuxtApp()

const subjects = ref<Subject[]>([])
const departments = ref<{ id: string; name: string }[]>([])

async function loadSubjects() {
  const res = await $fetch("/api/subjects/list", {
    query: {
      role: "ADMIN"
    }
  })

  subjects.value = Array.isArray(res) ? (res as Subject[]) : []
}

async function loadDepartments() {
  const { data } = await $supabase
    .from("departments")
    .select("id, name")
    .order("name")

  departments.value = (data || []) as { id: string; name: string }[]
}

onMounted(async () => {
  await loadDepartments()
  await loadSubjects()
})

/* 🔄 AUTO REFRESH */
useRefreshRouter({
  subjects: loadSubjects,
  departments: loadDepartments
})

</script>
