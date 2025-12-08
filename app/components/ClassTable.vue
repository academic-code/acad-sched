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

      <!-- Academic Term Filter -->
<v-select
  v-model="selectedTerm"
  :items="termOptions"
  label="Academic Term"
  variant="outlined"
  density="comfortable"
  hide-details
  style="max-width: 250px"
  class="ml-3"
/>


<v-btn
  v-if="props.role === 'DEAN'"
  :disabled="!canCreate"
  color="primary"
  prepend-icon="mdi-plus"
  @click="$emit('create')"
>
  {{ canCreate ? "Add Class" : "Term Locked" }}
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

  <!-- 📘 ASSIGN SUBJECTS BUTTON -->
  <template v-if="props.role === 'DEAN'">
    <!-- Enabled only when editor is allowed -->
    <v-btn
      v-if="canEdit(cls)"
      variant="text"
      icon
      size="small"
      color="blue-darken-1"
      @click="$emit('assign', cls)"
    >
      <v-icon>mdi-book-plus</v-icon>
    </v-btn>

    <!-- Disabled if locked -->
    <v-tooltip v-else text="Cannot assign — term inactive">
      <template #activator="{ props }">
        <v-btn v-bind="props" disabled icon size="small">
          <v-icon>mdi-lock</v-icon>
        </v-btn>
      </template>
    </v-tooltip>
  </template>

  <!-- Read-Only mode for: ADMIN & GENED Dean -->
  <template v-if="props.role !== 'DEAN'">
    <v-tooltip text="View assigned subjects">
      <template #activator="{ props }">
        <v-btn v-bind="props" icon size="small" @click="$emit('assign', cls)">
          <v-icon>mdi-eye</v-icon>
        </v-btn>
      </template>
    </v-tooltip>
  </template>

  <!-- ✏️ EDIT BUTTON -->
  <v-btn
    v-if="props.role === 'DEAN' && canEdit(cls)"
    variant="text"
    icon
    size="small"
    @click="$emit('edit', cls)"
  >
    <v-icon>mdi-pencil</v-icon>
  </v-btn>

  <v-tooltip v-else-if="props.role === 'DEAN'" text="Editing locked — term inactive">
    <template #activator="{ props }">
      <v-btn v-bind="props" disabled icon size="small">
        <v-icon>mdi-lock</v-icon>
      </v-btn>
    </template>
  </v-tooltip>

  <!-- 🗑 DELETE BUTTON -->
  <v-btn
    v-if="props.role === 'DEAN' && canDelete(cls)"
    variant="text"
    icon
    size="small"
    color="red"
    @click="$emit('delete', cls)"
  >
    <v-icon>mdi-delete</v-icon>
  </v-btn>

  <v-tooltip v-else-if="props.role === 'DEAN'" text="Cannot delete — term inactive">
    <template #activator="{ props }">
      <v-btn v-bind="props" disabled icon size="small" color="red">
        <v-icon>mdi-lock</v-icon>
      </v-btn>
    </template>
  </v-tooltip>

  <!-- If role cannot do anything -->
  <span v-if="props.role !== 'DEAN'" class="text-grey text-caption">—</span>

</td>


            </tr>
          </tbody>
        </v-table>
      </v-card>
    </div>
  </div>
</template>


<script setup>
import { ref, computed, watch, onMounted } from "vue"

const props = defineProps({
  classes: Array,
  role: String, // ADMIN | GENED | DEAN
  departments: Array,
  academicTerms: Array,
})

const search = ref("")
const selectedDept = ref(null)
const selectedTerm = ref(null)

/* ------------------------------------------------------
   AUTO-SELECT ACTIVE TERM ON LOAD
------------------------------------------------------ */
onMounted(() => {
  const active = props.academicTerms?.find(t => t.is_active)
  if (active) selectedTerm.value = active.id
})

/* ----------- Permissions ----------- */
const showDeptFilter = computed(() => props.role !== "DEAN")

/**
 * ADD BUTTON ENABLE LOGIC
 * ✔ Only DEANs can create
 * ✔ Enabled only if selectedTerm is active
 */
const canCreate = computed(() => {
  if (props.role !== "DEAN") return false
  const term = props.academicTerms.find(t => t.id === selectedTerm.value)
  return term?.is_active === true
})

/* ----------- Edit/Delete Permissions (same rule) ----------- */
const activeTerm = computed(() => props.academicTerms?.find(t => t.is_active) || null)

const canEdit = (cls) => {
  if (props.role !== "DEAN") return false
  return cls.academic_term_id === activeTerm.value?.id
}

const canDelete = (cls) => {
  if (props.role !== "DEAN") return false
  return cls.academic_term_id === activeTerm.value?.id
}

/* ----------- Dropdown Options ----------- */
const departmentOptions = computed(() => [
  { title: "All", value: null },
  ...(props.departments || []).map(d => ({
    title: d.name,
    value: d.id,
  })),
])

const termOptions = computed(() =>
  (props.academicTerms || []).map(t => ({
    title: `${t.academic_year} - ${t.semester}${t.is_active ? "  ⭐" : ""}`,
    value: t.id,
  }))
)

/* ----------- Filtering Logic ----------- */
const filtered = computed(() => {
  let data = [...(props.classes || [])]

  if (selectedDept.value) {
    data = data.filter(c => c.department_id === selectedDept.value)
  }

  if (selectedTerm.value) {
    data = data.filter(c => c.academic_term_id === selectedTerm.value)
  }

  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    data = data.filter(c =>
      c.class_name.toLowerCase().includes(q) ||
      c.program_name.toLowerCase().includes(q)
    )
  }

  return data
})

/* ----------- Grouping logic ----------- */
const grouped = computed(() => {
  const map = {}

  for (const c of filtered.value) {
    const label = `${c.year_level_label}`
    if (!map[label]) map[label] = []
    map[label].push(c)
  }

  Object.values(map).forEach(list =>
    list.sort((a, b) => a.section.localeCompare(b.section))
  )

  return map
})
</script>
