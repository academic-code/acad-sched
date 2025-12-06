<template>
  <div>
    <!-- SEARCH -->
    <v-text-field
      v-model="search"
      label="Search subject..."
      prepend-inner-icon="mdi-magnify"
      variant="outlined"
      density="comfortable"
      class="mb-4"
    />

    <!-- ADMIN: FILTER BY DEPARTMENT -->
    <v-select
      v-if="role === 'ADMIN'"
      v-model="selectedDepartment"
      :items="departments"
      item-title="name"
      item-value="id"
      label="Filter by Department"
      variant="outlined"
      density="comfortable"
      class="mb-4"
      clearable
    />

    <!-- DEAN: ADD BUTTON -->
    <v-btn
      v-if="role === 'DEAN'"
      color="primary"
      prepend-icon="mdi-plus"
      class="mb-4"
      @click="$emit('create')"
    >
      Add Subject
    </v-btn>

    <!-- TABLE -->
    <v-data-table
      :headers="headers"
      :items="filteredSubjects"
      class="elevation-1"
    >
      <template #item.department_id="{ item }">
        {{ departmentName(item.department_id) }}
      </template>

      <template #item.is_gened="{ item }">
        <v-chip
          size="small"
          :color="item.is_gened ? 'purple-lighten-4' : 'blue-lighten-3'"
          :text-color="item.is_gened ? 'purple-darken-2' : 'blue-darken-1'"
        >
          {{ item.is_gened ? "GENED" : "MAJOR" }}
        </v-chip>
      </template>

      <template #item.actions="{ item }">
        <v-btn
          v-if="role === 'DEAN'"
          icon
          variant="text"
          color="indigo"
          @click="$emit('edit', item)"
        >
          <v-icon>mdi-pencil</v-icon>
        </v-btn>

        <v-btn
          v-if="role === 'DEAN'"
          icon
          variant="text"
          color="red"
          @click="$emit('delete', item)"
        >
          <v-icon>mdi-delete</v-icon>
        </v-btn>
      </template>
    </v-data-table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import type { Subject } from "../../types/Subject"

const props = defineProps<{
  subjects: Subject[]
  departments: { id: string; name: string }[]
  role: "ADMIN" | "DEAN"
  isGenEdDean?: boolean
}>()

defineEmits<{
  (e: "create"): void
  (e: "edit", subject: Subject): void
  (e: "delete", subject: Subject): void
}>()

const search = ref("")
const selectedDepartment = ref<string | null>(null)

// Use any[] so Vuetify TS doesn't scream
const headers: any[] = [
  { title: "Course Code", key: "course_code" },
  { title: "Description", key: "description" },
  { title: "Year Level", key: "year_level_number", align: "center" },
  { title: "Units", key: "units", align: "center" },
  { title: "Semester", key: "semester", align: "center" },
  { title: "Type", key: "is_gened", align: "center" },
  { title: "Department", key: "department_id", align: "center" },
  { title: "Actions", key: "actions", align: "center", sortable: false },
]

function departmentName(id: string) {
  return props.departments.find(d => d.id === id)?.name || "—"
}

const filteredSubjects = computed<Subject[]>(() => {
  let list = [...props.subjects]

  if (props.role === "ADMIN" && selectedDepartment.value) {
    list = list.filter(s => s.department_id === selectedDepartment.value)
  }

  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter((s: Subject) =>
      s.course_code.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    )
  }

  return list
})
</script>
