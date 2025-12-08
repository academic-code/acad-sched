<template>
  <div>
    <!-- Header -->
    <div class="d-flex justify-space-between align-center mb-4">
      <v-text-field
        v-model="search"
        prepend-inner-icon="mdi-magnify"
        label="Search class..."
        variant="outlined"
        density="comfortable"
        hide-details
      />

      <v-select
        v-if="showDeptFilter"
        v-model="selectedDept"
        :items="departmentOptions"
        label="Department"
        variant="outlined"
        density="comfortable"
        hide-details
        style="max-width: 250px"
      />

      <v-btn
        v-if="canCreate"
        color="primary"
        prepend-icon="mdi-plus"
        @click="$emit('create')"
      >
        Add Class
      </v-btn>
    </div>

    <!-- Grouped List -->
    <div v-for="(group, year) in grouped" :key="year" class="mb-6">
      <h3 class="font-weight-bold text-subtitle-1 mb-2">{{ year }}</h3>
      <v-divider class="mb-2" />

      <v-card>
        <v-table>
          <thead>
            <tr>
              <th>Class Name</th>
              <th>Program</th>
              <th>Section</th>
              <th>Adviser</th>
              <th>Term</th>
              <th class="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cls in group" :key="cls.id">
              <td>{{ cls.class_name }}</td>
              <td>{{ cls.program_name }}</td>
              <td>{{ cls.section }}</td>
              <td>{{ cls.adviser_name || "-" }}</td>
              <td>{{ cls.term_label }}</td>

              <td class="text-center">
                <v-btn
                  v-if="canEdit"
                  variant="text"
                  icon
                  size="small"
                  @click="$emit('edit', cls)"
                ><v-icon>mdi-pencil</v-icon></v-btn>

                <v-btn
                  v-if="canDelete"
                  variant="text"
                  icon
                  size="small"
                  color="red"
                  @click="$emit('delete', cls)"
                ><v-icon>mdi-delete</v-icon></v-btn>

                <span v-if="!canEdit && !canDelete" class="text-grey text-caption">—</span>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue"

const props = defineProps({
  classes: Array,
  role: String, // ADMIN | GENED | DEAN
  departments: Array,
})

const search = ref("")
const selectedDept = ref(null)

const showDeptFilter = computed(() => props.role !== "DEAN")
const canCreate = computed(() => props.role === "DEAN")
const canEdit = computed(() => props.role === "DEAN")
const canDelete = computed(() => props.role === "DEAN")

const departmentOptions = computed(() => [
  { title: "All", value: null },
  ...(props.departments || []).map(d => ({
    title: d.name,
    value: d.id,
  })),
])

const filtered = computed(() => {
  let data = [...(props.classes || [])]

  if (selectedDept.value) {
    data = data.filter(c => c.department_id === selectedDept.value)
  }

  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    data = data.filter(c =>
      c.class_name.toLowerCase().includes(q) ||
      c.program_name.toLowerCase().includes(q),
    )
  }

  return data
})

const grouped = computed(() => {
  const map = {}

  for (const c of filtered.value) {
    const label = `${c.year_level_label}`
    if (!map[label]) map[label] = []
    map[label].push(c)
  }

  Object.values(map).forEach(list =>
    list.sort((a, b) => a.section.localeCompare(b.section)),
  )

  return map
})
</script>
