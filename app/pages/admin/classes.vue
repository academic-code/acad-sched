<template>
  <div>
    <h1 class="text-h5 font-weight-bold mb-6">Classes</h1>

    <ClassTable
      :classes="classesForTable"
      :departments="departments"
      role="ADMIN"
    />

    <AppAlert />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import ClassTable from "~/components/ClassTable.vue"
import AppAlert from "~/components/AppAlert.vue"
import { useAlert } from "~/composables/useAlert"
import type { AcademicTerm, FacultyOption } from "../../../types/Class"

definePageMeta({ layout: "admin" })

const { $supabase } = useNuxtApp()
const { showAlert } = useAlert()

const classes = ref<any[]>([])
const departments = ref<{ id: string; name: string }[]>([])
const academicTerms = ref<AcademicTerm[]>([])
const faculty = ref<FacultyOption[]>([])

/* ---------- COMPUTED ---------- */

const classesForTable = computed(() => {
  const termMap = new Map(
    academicTerms.value.map((t) => [
      t.id,
      `${t.academic_year} - ${t.semester}`
    ])
  )

  const facultyMap = new Map(
    faculty.value.map((f) => [f.id, f.full_name])
  )

  return classes.value.map((c: any) => ({
    ...c,
    adviser_name: c.adviser_id ? facultyMap.get(c.adviser_id) || "" : "",
    term_label: c.academic_term_id
      ? termMap.get(c.academic_term_id) || ""
      : ""
  }))
})

/* ---------- LOADERS ---------- */

async function loadDepartments() {
  const { data, error } = await $supabase
    .from("departments")
    .select("id, name")
    .order("name", { ascending: true })

  if (error) {
    showAlert("error", "Failed to load departments.")
    return
  }

  departments.value = (data || []) as { id: string; name: string }[]
}

async function loadAcademicTerms() {
  const { data, error } = await $supabase
    .from("academic_terms")
    .select("id, academic_year, semester")
    .order("academic_year", { ascending: false })
    .order("semester", { ascending: false })

  if (error) {
    showAlert("error", "Failed to load academic terms.")
    return
  }

  academicTerms.value = (data || []) as AcademicTerm[]
}

async function loadFaculty() {
  const { data, error } = await $supabase
    .from("faculty")
    .select("id, first_name, last_name")

  if (error) {
    showAlert("error", "Failed to load faculty.")
    return
  }

  faculty.value =
    (data || []).map((f: any) => ({
      id: f.id,
      full_name: `${f.last_name}, ${f.first_name}`
    })) as FacultyOption[]
}

async function loadClasses() {
  const res = await $fetch("/api/classes/list", {
    query: {
      role: "ADMIN"
    }
  })

  classes.value = Array.isArray(res) ? (res as any[]) : []
}

/* ---------- INIT ---------- */

onMounted(async () => {
  await loadDepartments()
  await loadAcademicTerms()
  await loadFaculty()
  await loadClasses()
})
</script>
