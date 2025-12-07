<template>
  <div>
    <!-- TOP BAR -->
    <div class="d-flex justify-space-between align-center mb-4">
      <div class="d-flex align-center" style="gap: 12px; width: 100%;">
        <v-text-field
          v-model="search"
          prepend-inner-icon="mdi-magnify"
          label="Search subject..."
          variant="outlined"
          density="comfortable"
          hide-details
          class="flex-grow-1"
        />

        <v-select
          v-if="showDepartmentFilter && departments.length"
          v-model="selectedDeptId"
          :items="departmentItems"
          item-title="label"
          item-value="value"
          label="Department"
          variant="outlined"
          density="comfortable"
          hide-details
          style="max-width: 260px"
        />
      </div>

      <v-btn
        v-if="canCreate"
        color="primary"
        class="ml-4"
        prepend-icon="mdi-plus"
        height="42"
        @click="$emit('create')"
      >
        Add Subject
      </v-btn>
    </div>

    <!-- GROUPED SECTIONS -->
    <div v-if="groupedYears.length">
      <div
        v-for="year in groupedYears"
        :key="year.year_level_number"
        class="mb-6"
      >
        <!-- YEAR HEADER -->
        <div class="d-flex align-center mb-1">
          <h2 class="text-h6 font-weight-bold mr-4">
            {{ year.year_label }}
          </h2>
          <v-divider class="flex-grow-1" />
        </div>

        <!-- SEMESTER PANELS -->
        <v-row>
          <v-col
            v-for="sem in year.semesters"
            :key="sem.code"
            cols="12"
          >
            <v-card elevation="1" class="mb-4">
              <div class="d-flex justify-space-between align-center px-4 pt-3">
                <h3 class="text-subtitle-1 font-weight-bold">
                  {{ sem.label }}
                </h3>
                <span class="text-caption text-grey-darken-1">
                  {{ sem.subjects.length }} subject(s)
                </span>
              </div>

              <v-divider class="mt-2" />

              <v-table density="comfortable">
                <thead>
                  <tr>
                    <th class="text-left">Course Code</th>
                    <th class="text-left">Description</th>
                    <th class="text-center">Units</th>
                    <th class="text-center">Type</th>
                    <th class="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!sem.subjects.length">
                    <td colspan="5" class="text-center py-4 text-grey-darken-1">
                      No subjects for this semester.
                    </td>
                  </tr>

                  <tr
                    v-for="sub in sem.subjects"
                    :key="sub.id"
                  >
                    <td class="text-body-2">
                      {{ sub.course_code }}
                    </td>
                    <td class="text-body-2">
                      {{ sub.description }}
                    </td>
                    <td class="text-center">
                      {{ sub.units ?? 0 }}
                    </td>
                    <td class="text-center">
                      <v-chip
                        v-if="sub.is_gened"
                        size="small"
                        color="deep-purple-lighten-5"
                        text-color="deep-purple-darken-2"
                      >
                        GENED
                      </v-chip>
                      <span v-else class="text-caption text-grey-darken-1">
                        Major
                      </span>
                    </td>
                    <td class="text-center">
                      <v-btn
                        v-if="canEdit && canEdit(sub)"
                        icon
                        size="small"
                        variant="text"
                        color="indigo"
                        @click="$emit('edit', sub)"
                      >
                        <v-icon>mdi-pencil</v-icon>
                      </v-btn>

                      <v-btn
                        v-if="canDelete && canDelete(sub)"
                        icon
                        size="small"
                        variant="text"
                        color="red"
                        @click="$emit('delete', sub)"
                      >
                        <v-icon>mdi-delete</v-icon>
                      </v-btn>

                      <span
                        v-if="(!canEdit || !canEdit(sub)) && (!canDelete || !canDelete(sub))"
                        class="text-caption text-grey-darken-1"
                      >
                        —
                      </span>
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-card>
          </v-col>
        </v-row>
      </div>
    </div>

    <div v-else class="text-center pa-8 text-grey-darken-1">
      No subjects found.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import type { Subject } from "../../types/Subject"

const props = defineProps<{
  subjects: Subject[]
  departments: { id: string; name: string }[]
  role: "ADMIN" | "DEAN" | "GENED"
  canCreate?: boolean
  canEdit?: (subject: Subject) => boolean
  canDelete?: (subject: Subject) => boolean
  showDepartmentFilter?: boolean
}>()

defineEmits<{
  (e: "create"): void
  (e: "edit", subject: Subject): void
  (e: "delete", subject: Subject): void
}>()

const search = ref("")
const selectedDeptId = ref<string | null>(null)

const departmentItems = computed(() => [
  { label: "All Departments", value: null },
  ...props.departments.map((d) => ({ label: d.name, value: d.id }))
])

const semesterOrder: Record<string, number> = {
  "1ST": 1,
  "2ND": 2,
  "SUMMER": 3
}

function yearLabelFromNumber(n: number): string {
  if (n === 1) return "1st Year"
  if (n === 2) return "2nd Year"
  if (n === 3) return "3rd Year"
  if (n === 4) return "4th Year"
  return `${n}th Year`
}

const filtered = computed(() => {
  let list = [...props.subjects]

  // Department filter (Admin + GenEd dean)
  if (props.showDepartmentFilter && selectedDeptId.value) {
    list = list.filter((s) => s.department_id === selectedDeptId.value)
  }

  // Search filter
  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (s) =>
        s.course_code.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    )
  }

  return list
})

const groupedYears = computed(() => {
  const byYear = new Map<number, { year_level_number: number; year_label: string; semesters: { code: string; label: string; subjects: Subject[] }[] }>()

  for (const s of filtered.value) {
    const yearNum = s.year_level_number || 0
    if (!yearNum) continue

    if (!byYear.has(yearNum)) {
      byYear.set(yearNum, {
        year_level_number: yearNum,
        year_label: yearLabelFromNumber(yearNum),
        semesters: [
          { code: "1ST", label: "First Semester", subjects: [] },
          { code: "2ND", label: "Second Semester", subjects: [] },
          { code: "SUMMER", label: "Summer", subjects: [] }
        ]
      })
    }

    const group = byYear.get(yearNum)!
    const sem = group.semesters.find((x) => x.code === s.semester) ?? group.semesters[0]!
    sem.subjects.push(s)
  }

  // Sort semesters & drop empty year groups if no subjects
  const result = Array.from(byYear.values())
    .map((year) => {
      const semsWithSubjects = year.semesters
        .map((s) => ({
          ...s,
          subjects: [...s.subjects].sort((a, b) =>
            a.course_code.localeCompare(b.course_code)
          )
        }))
        .filter((s) => s.subjects.length > 0) // hide completely empty semester groups

      return {
        ...year,
        semesters: semsWithSubjects
      }
    })
    .filter((y) => y.semesters.length > 0) // hide empty year groups
    .sort((a, b) => a.year_level_number - b.year_level_number)

  // Within each year, sort semesters in defined order
  for (const y of result) {
    y.semesters.sort((a, b) => (semesterOrder[a.code] || 99) - (semesterOrder[b.code] || 99))
  }

  return result
})
</script>
