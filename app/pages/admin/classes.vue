<!-- app/pages/admin/classes.vue -->
<template>
  <div>
    <h1 class="text-h5 font-weight-bold mb-6">Classes</h1>

    <!-- FILTER BAR -->
    <v-row class="mb-4">
      <v-col cols="12" md="4">
        <v-text-field
          v-model="search"
          label="Search class..."
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="comfortable"
        />
      </v-col>

      <v-col cols="12" md="4">
        <v-select
          v-model="selectedDepartment"
          :items="departments"
          item-title="name"
          item-value="id"
          label="Filter by Department"
          variant="outlined"
          density="comfortable"
          clearable
        />
      </v-col>

      <v-col cols="12" md="4">
        <v-select
          v-model="selectedTerm"
          :items="academicTerms"
          item-title="labelDisplay"
          item-value="id"
          label="Filter by Academic Term"
          variant="outlined"
          density="comfortable"
          clearable
        />
      </v-col>
    </v-row>

    <v-switch v-model="showArchived" label="Show archived" inset class="mb-4" />

    <!-- TABLE -->
    <v-card elevation="1">
      <v-data-table :headers="headers" :items="filteredClasses" :items-per-page="15">
        <template #item.department="{ item }">
          {{ departmentName(item.department_id) }}
        </template>

        <template #item.adviser="{ item }">
          {{ adviserName(item) }}
        </template>

        <template #item.academic_term="{ item }">
          <span v-if="item.academic_term">
            {{ formatTerm(item.academic_term) }}
          </span>
          <span v-else>—</span>
        </template>

        <template #item.is_archived="{ item }">
          <v-chip
            size="small"
            :color="item.is_archived ? 'grey-darken-2' : 'green-lighten-4'"
            :text-color="item.is_archived ? 'white' : 'green-darken-2'"
          >
            {{ item.is_archived ? "Archived" : "Active" }}
          </v-chip>
        </template>

        <template #no-data>
          <div class="text-center pa-5 text-grey-darken-1">No classes found.</div>
        </template>
      </v-data-table>
    </v-card>

    <AppAlert />
  </div>
</template>


<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import type { DataTableHeader } from "vuetify"
import { useAlert } from "~/composables/useAlert"

definePageMeta({ layout: "admin" })

const { $supabase } = useNuxtApp()
const { showAlert } = useAlert()

/* --- DATA SOURCES --- */
const classes = ref<any[]>([])
const departments = ref<{ id: string; name: string }[]>([])
const terms = ref<any[]>([])

/* --- UI STATE --- */
const search = ref("")
const selectedDepartment = ref<string | null>(null)
const selectedTerm = ref<string | null>(null)
const showArchived = ref(false)

/* --- TABLE HEADERS --- */
const headers: DataTableHeader[] = [
  { title: "Class Name", key: "class_name", align: "start" },
  { title: "Department", key: "department_id", align: "start" },
  { title: "Year Level", key: "year_level_label", align: "center" },
  { title: "Section", key: "section", align: "center" },
  { title: "Adviser", key: "adviser", align: "center" },
  { title: "Term", key: "academic_term", align: "center" },
  { title: "Status", key: "is_archived", align: "center" },
]

/* --- HELPERS --- */
function departmentName(id: string) {
  return departments.value.find(d => d.id === id)?.name || "—"
}

function adviserName(row: any) {
  if (!row?.adviser) return "—"
  return `${row.adviser.first_name} ${row.adviser.last_name}`
}

function formatTerm(term: any) {
  if (!term) return "—"
  return `${term.academic_year} • ${term.semester}`
}

/* --- FILTERED LIST --- */
const filteredClasses = computed(() => {
  let list = [...classes.value]

  if (selectedDepartment.value) list = list.filter(c => c.department_id === selectedDepartment.value)
  if (selectedTerm.value) list = list.filter(c => c.academic_term?.id === selectedTerm.value)
  if (!showArchived.value) list = list.filter(c => !c.is_archived)

  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(c => c.class_name.toLowerCase().includes(q) || c.section.toLowerCase().includes(q))
  }

  return list
})

/* --- LOADERS --- */
async function loadDepartments() {
  const { data } = await $supabase.from("departments").select("id,name")
  departments.value = data || []
}

async function loadAcademicTerms() {
  const { data } = await $supabase.from("academic_terms").select("*")
  terms.value = data || []
}

async function loadClasses() {
  const res = await $fetch<any[]>("/api/classes/list", { query: { role: "ADMIN" } })
  classes.value = Array.isArray(res) ? res : []
}

/* FOR DROPDOWN DISPLAY */
const academicTerms = computed(() =>
  terms.value.map(t => ({
    ...t,
    labelDisplay: `${t.academic_year} • ${t.semester}`,
  }))
)

/* --- INIT --- */
onMounted(async () => {
  await loadDepartments()
  await loadAcademicTerms()
  await loadClasses()
})
</script>