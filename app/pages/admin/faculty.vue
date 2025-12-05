<template>
  <div>
    <h1 class="text-h5 font-weight-bold mb-6">Faculty Directory</h1>

    <!-- FILTER BAR -->
    <div class="d-flex gap-4 mb-4 align-center">
      <!-- SEARCH -->
      <v-text-field
        v-model="search"
        placeholder="Search faculty..."
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
        density="comfortable"
        hide-details
        style="max-width: 300px"
      />

      <!-- DEPARTMENT FILTER -->
      <v-select
        v-model="selectedDepartment"
        :items="departmentOptions"
        label="Filter by Department"
        item-title="name"
        item-value="id"
        variant="outlined"
        clearable
        hide-details
        style="max-width: 250px"
      />
    </div>

    <!-- TABLE -->
    <v-card elevation="1">
      <v-data-table
        :headers="headers"
        :items="filteredFaculty"
        :items-per-page="10"
        class="text-body-2"
      >
        <!-- DEPARTMENT COLUMN -->
        <template #item.department="{ item }">
          {{ item.departments?.name || "—" }}
        </template>

        <!-- STATUS CHIP -->
        <template #item.status="{ item }">
          <v-chip
            :color="item.is_active ? 'green' : 'red'"
            variant="flat"
            size="small"
          >
            {{ item.is_active ? "Active" : "Inactive" }}
          </v-chip>
        </template>

        <!-- EMPTY -->
        <template #no-data>
          <div class="text-center pa-5 text-grey-darken-1">
            No faculty found.
          </div>
        </template>
      </v-data-table>
    </v-card>
  </div>
</template>

<script setup>
definePageMeta({ layout: "admin" })

import { ref, onMounted, computed } from "vue"

const supabase = useNuxtApp().$supabase

const faculty = ref([])
const departments = ref([])

const search = ref("")
const selectedDepartment = ref(null)

/* ---------- TABLE HEADERS ---------- */
const headers = [
  { title: "Name", key: "full_name" },
  { title: "Email", key: "email" },
  { title: "Department", key: "department" },
  { title: "Type", key: "faculty_type" },
  { title: "Status", key: "status", align: "center" }
]

/* ---------- OPTIONS LIST ---------- */
const departmentOptions = computed(() => [
  { id: null, name: "All Departments" },
  ...departments.value
])

/* ---------- FILTERED TABLE DATA ---------- */
const filteredFaculty = computed(() =>
  faculty.value.filter(f => {
    const matchesSearch =
      f.full_name.toLowerCase().includes(search.value.toLowerCase()) ||
      f.email.toLowerCase().includes(search.value.toLowerCase()) ||
      (f.departments?.name || "").toLowerCase().includes(search.value.toLowerCase())

    const matchesDepartment =
      !selectedDepartment.value || f.department_id === selectedDepartment.value

    return matchesSearch && matchesDepartment
  })
)

/* ---------- LOAD DATA ---------- */
async function loadFaculty() {
  const { data } = await supabase
    .from("faculty")
    .select(`
      *,
      departments(name)
    `)
    .order("last_name")

  faculty.value = data.map(f => ({
    ...f,
    full_name: `${f.first_name} ${f.last_name}`
  }))
}

async function loadDepartments() {
  const { data } = await supabase
    .from("departments")
    .select("id, name")
    .order("name")

  departments.value = data
}

onMounted(() => {
  loadDepartments()
  loadFaculty()
})
</script>

<style scoped>
.gap-4 {
  gap: 16px;
}
</style>
