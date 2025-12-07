<template>
  <v-dialog v-model="model" width="1000">
    <v-card class="pa-4">
      <h3 class="text-h6 font-weight-medium mb-4">
        {{ editingMode ? "Edit Subject" : "Create Subjects" }}
      </h3>

      <!-- TOP ROW: YEAR + SEM -->
      <v-row class="mb-4">
        <v-col cols="12" md="4">
          <v-select
            v-model="header.year_level_number"
            :items="yearLevelItems"
            item-title="label"
            item-value="value"
            label="Year Level"
            variant="outlined"
            density="comfortable"
          />
        </v-col>

        <v-col cols="12" md="4">
          <v-select
            v-model="header.semester"
            :items="semesterItems"
            item-title="label"
            item-value="value"
            label="Semester"
            variant="outlined"
            density="comfortable"
          />
        </v-col>
      </v-row>

      <!-- MULTI ROW INPUT -->
      <div v-for="(row, index) in rows" :key="index" class="mb-2">
        <v-row align="center">
          <v-col cols="12" md="2">
            <v-text-field
              v-model="row.course_code"
              label="Course Code"
              variant="outlined"
              density="comfortable"
            />
          </v-col>

          <v-col cols="12" md="3">
            <v-text-field
              v-model="row.description"
              label="Description"
              variant="outlined"
              density="comfortable"
            />
          </v-col>

          <v-col cols="4" md="1">
            <v-text-field
              v-model.number="row.lec"
              type="number"
              min="0"
              label="Lec"
              variant="outlined"
              density="comfortable"
            />
          </v-col>

          <v-col cols="4" md="1">
            <v-text-field
              v-model.number="row.lab"
              type="number"
              min="0"
              label="Lab"
              variant="outlined"
              density="comfortable"
            />
          </v-col>

          <v-col cols="4" md="1">
            <v-text-field
              :model-value="row.units"
              label="Units"
              readonly
              variant="outlined"
              density="comfortable"
            />
          </v-col>

          <v-col cols="12" md="3" class="d-flex align-center">
            <v-switch
              v-model="row.is_gened"
              inset
              color="deep-purple-darken-2"
              hide-details
            >
              <template #label>
                <span class="text-body-2">Gen Ed</span>
              </template>
            </v-switch>
          </v-col>

          <!-- Remove Row (create mode only) -->
          <v-col cols="12" md="1" v-if="!editingMode && rows.length > 1">
            <v-btn icon color="red" size="small" @click="removeRow(index)">
              <v-icon size="18">mdi-delete</v-icon>
            </v-btn>
          </v-col>
        </v-row>

        <v-divider
          class="my-2"
          v-if="rows.length > 1 && index < rows.length - 1"
        />
      </div>

      <!-- ADD NEW ROW BUTTON (create mode only) -->
      <v-btn
        v-if=" !editingMode "
        block
        variant="tonal"
        color="primary"
        prepend-icon="mdi-plus"
        class="mb-4"
        @click="addRow"
      >
        Add Another Subject
      </v-btn>

      <!-- FOOTER ACTIONS -->
      <div class="d-flex justify-end mt-6">
        <v-btn variant="text" @click="close">Cancel</v-btn>
        <v-btn
          color="primary"
          class="ml-2"
          :loading="saving"
          :disabled="!isValid"
          @click="emitSave"
        >
          {{ editingMode ? "Update" : "Save All" }}
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue"
import type { Subject } from "../../types/Subject"

type Row = {
  id?: string
  course_code: string
  description: string
  lec: number
  lab: number
  units: number
  is_gened: boolean
}

type SavePayload = Row & {
  year_level_number: number
  year_level_label: string
  semester: string
}

const props = defineProps<{
  modelValue: boolean
  data: Subject | null
  saving?: boolean
}>()

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void
  (e: "save", payloads: SavePayload[]): void
}>()

/* ---------- DIALOG MODEL ---------- */
const model = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit("update:modelValue", val)
})

/* ---------- SELECT OPTIONS ---------- */
const semesterItems = [
  { label: "1ST SEMESTER", value: "1ST" },
  { label: "2ND SEMESTER", value: "2ND" },
  { label: "SUMMER", value: "SUMMER" }
]

const yearLevelItems = [
  { label: "1st Year", value: 1 },
  { label: "2nd Year", value: 2 },
  { label: "3rd Year", value: 3 },
  { label: "4th Year", value: 4 }
]

/* ---------- STATE ---------- */
const rows = ref<Row[]>([
  { course_code: "", description: "", lec: 0, lab: 0, units: 0, is_gened: false }
])

const header = ref({
  year_level_number: 1,
  semester: "1ST" as "1ST" | "2ND" | "SUMMER"
})

const editingMode = ref(false)

const saving = computed(() => props.saving ?? false)

/* ---------- HELPERS ---------- */
function yearLabelFromNumber(n: number): string {
  if (n === 1) return "1st Year"
  if (n === 2) return "2nd Year"
  if (n === 3) return "3rd Year"
  if (n === 4) return "4th Year"
  return `${n}th Year`
}

/* ---------- LOAD DATA WHEN EDITING ---------- */
watch(
  () => props.data,
  (val) => {
    if (val) {
      // EDIT MODE
      editingMode.value = true
      header.value.year_level_number = val.year_level_number
      header.value.semester = val.semester as "1ST" | "2ND" | "SUMMER"

      rows.value = [
        {
          id: val.id,
          course_code: val.course_code,
          description: val.description,
          lec: Number(val.lec ?? 0),
          lab: Number(val.lab ?? 0),
          units: Number(val.units ?? 0),
          is_gened: !!val.is_gened
        }
      ]
    } else {
      // CREATE MODE
      resetForm()
    }
  },
  { immediate: true }
)

/* ---------- AUTO COMPUTE UNITS ---------- */
watch(
  rows,
  () => {
    rows.value.forEach((r) => {
      r.units = Number(r.lec || 0) + Number(r.lab || 0)
    })
  },
  { deep: true, immediate: true }
)

/* ---------- VALIDATION ---------- */
const isValid = computed(() => {
  if (!header.value.year_level_number || !header.value.semester) return false
  const validRows = rows.value.filter(
    (r) => r.course_code.trim() && r.description.trim()
  )
  return validRows.length > 0
})

/* ---------- ACTIONS ---------- */
function addRow() {
  rows.value.push({
    course_code: "",
    description: "",
    lec: 0,
    lab: 0,
    units: 0,
    is_gened: false
  })
}

function removeRow(i: number) {
  rows.value.splice(i, 1)
}

function resetForm() {
  editingMode.value = false
  header.value.year_level_number = 1
  header.value.semester = "1ST"
  rows.value = [
    { course_code: "", description: "", lec: 0, lab: 0, units: 0, is_gened: false }
  ]
}

function emitSave() {
  if (!isValid.value) return

  const base = {
    year_level_number: header.value.year_level_number,
    year_level_label: yearLabelFromNumber(header.value.year_level_number),
    semester: header.value.semester
  }

  // Only include non-empty rows
  const payloads: SavePayload[] = rows.value
    .filter((r) => r.course_code.trim() && r.description.trim())
    .map((r) => ({
      ...base,
      id: r.id,
      course_code: r.course_code.trim(),
      description: r.description.trim(),
      lec: Number(r.lec || 0),
      lab: Number(r.lab || 0),
      units: Number(r.units || 0),
      is_gened: !!r.is_gened
    }))

  if (!payloads.length) return

  emit("save", payloads)

  // After save, reset + close
  resetForm()
  model.value = false
}

function close() {
  model.value = false
}
</script>
