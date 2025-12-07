<template>
  <v-dialog v-model="model" width="1000">
    <v-card class="pa-4">
      <h3 class="text-h6 font-weight-medium mb-4">
        {{ local.id ? "Edit Subject" : "Create Subject" }}
      </h3>

      <!-- TOP ROW -->
      <v-row class="mb-4">
        <v-col cols="12" md="4">
          <v-select
            v-model="local.year_level_number"
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
            v-model="local.semester"
            :items="semesterItems"
            item-title="label"
            item-value="value"
            label="Semester"
            variant="outlined"
            density="comfortable"
          />
        </v-col>
      </v-row>

      <!-- INLINE FORM ROW -->
      <v-row class="mb-2" align="center">
        <v-col cols="12" md="2">
          <v-text-field
            v-model="local.course_code"
            label="Course Code"
            variant="outlined"
            density="comfortable"
          />
        </v-col>

        <v-col cols="12" md="3">
          <v-text-field
            v-model="local.description"
            label="Description"
            variant="outlined"
            density="comfortable"
          />
        </v-col>

        <v-col cols="4" md="1">
          <v-text-field
            v-model.number="local.lec"
            type="number"
            min="0"
            label="Lec"
            variant="outlined"
            density="comfortable"
          />
        </v-col>

        <v-col cols="4" md="1">
          <v-text-field
            v-model.number="local.lab"
            type="number"
            min="0"
            label="Lab"
            variant="outlined"
            density="comfortable"
          />
        </v-col>

        <v-col cols="4" md="2">
          <v-text-field
            :model-value="local.units"
            label="Units"
            readonly
            variant="outlined"
            density="comfortable"
          />
        </v-col>

        <v-col cols="12" md="3" class="d-flex align-center">
          <v-switch
            v-model="local.is_gened"
            inset
            color="deep-purple-darken-2"
            hide-details
          >
            <template #label>
              <span class="text-body-2">Gen Ed Subject</span>
            </template>
          </v-switch>
        </v-col>
      </v-row>

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
          Save
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue"
import type { Subject } from "../../types/Subject"

const props = defineProps<{
  modelValue: boolean
  data: Subject | null
  saving?: boolean
}>()

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void
  (e: "save", payload: {
    id?: string
    year_level_number: number
    year_level_label: string
    semester: string
    course_code: string
    description: string
    lec: number
    lab: number
    units: number
    is_gened: boolean
  }): void
}>()

const model = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val)
})

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

const local = ref({
  id: undefined as string | undefined,
  year_level_number: 1,
  year_level_label: "1st Year",
  semester: "1ST",
  course_code: "",
  description: "",
  lec: 0,
  lab: 0,
  units: 0,
  is_gened: false
})

function yearLabelFromNumber(n: number): string {
  return `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"} Year`
}

/* ---------- LOAD DATA WHEN EDITING ---------- */
watch(
  () => props.data,
  (val) => {
    if (!val) {
      resetForm()
      return
    }

    local.value = {
      id: val.id,
      year_level_number: val.year_level_number,
      year_level_label: yearLabelFromNumber(val.year_level_number),
      semester: val.semester,
      course_code: val.course_code,
      description: val.description,
      lec: Number(val.lec ?? 0),
      lab: Number(val.lab ?? 0),
      units: Number(val.units ?? 0),
      is_gened: !!val.is_gened
    }
  },
  { immediate: true }
)

/* ---------- AUTO UNIT CALC ---------- */
watch(
  () => [local.value.lec, local.value.lab],
  () => {
    local.value.units = Number(local.value.lec || 0) + Number(local.value.lab || 0)
  },
  { immediate: true }
)

/* ---------- VALIDATION ---------- */
const isValid = computed(() =>
  !!local.value.course_code.trim() &&
  !!local.value.description.trim()
)

const saving = computed(() => props.saving ?? false)

/* ---------- RESET FORM ---------- */
function resetForm() {
  local.value = {
    id: undefined,
    year_level_number: 1,
    year_level_label: "1st Year",
    semester: "1ST",
    course_code: "",
    description: "",
    lec: 0,
    lab: 0,
    units: 0,
    is_gened: false
  }
}

/* ---------- SAVE ACTION ---------- */
function emitSave() {
  if (!isValid.value) return

  emit("save", {
    id: local.value.id,
    year_level_number: local.value.year_level_number,
    year_level_label: yearLabelFromNumber(local.value.year_level_number),
    semester: local.value.semester,
    course_code: local.value.course_code.trim(),
    description: local.value.description.trim(),
    lec: Number(local.value.lec),
    lab: Number(local.value.lab),
    units: Number(local.value.units),
    is_gened: !!local.value.is_gened
  })

  // reset after save
  resetForm()
}

function close() {
  model.value = false
}
</script>
