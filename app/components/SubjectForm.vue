<template>
  <v-dialog v-model="open" width="520">
    <v-card class="pa-4">
      <h3 class="text-h6 font-weight-medium mb-4">
        {{ form.id ? "Edit Subject" : "Create Subject" }}
      </h3>

      <v-text-field
        v-model="form.course_code"
        label="Course Code"
        variant="outlined"
        density="comfortable"
        class="mb-3"
      />

      <v-text-field
        v-model="form.description"
        label="Description"
        variant="outlined"
        density="comfortable"
        class="mb-3"
      />

      <v-row>
        <v-col cols="4">
          <v-text-field
            v-model.number="form.lec"
            type="number"
            label="Lec"
            variant="outlined"
            density="comfortable"
          />
        </v-col>

        <v-col cols="4">
          <v-text-field
            v-model.number="form.lab"
            type="number"
            label="Lab"
            variant="outlined"
            density="comfortable"
          />
        </v-col>

        <v-col cols="4">
          <v-text-field
            v-model.number="form.units"
            type="number"
            label="Units"
            variant="outlined"
            density="comfortable"
            readonly
          />
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="6">
          <v-select
            v-model="form.year_level_number"
            :items="yearLevelItems"
            label="Year Level"
            variant="outlined"
            density="comfortable"
          />
        </v-col>

        <v-col cols="6">
          <v-select
            v-model="form.semester"
            :items="['1ST', '2ND', 'SUMMER']"
            label="Semester"
            variant="outlined"
            density="comfortable"
          />
        </v-col>
      </v-row>

      <!-- FIXED: Dropdowns for academic + curriculum -->
      <v-row>
        <v-col cols="6">
          <v-select
            v-model="form.academic_year"
            :items="academicYears"
            label="Academic Year"
            variant="outlined"
            density="comfortable"
          />
        </v-col>

        <v-col cols="6">
          <v-select
            v-model="form.curriculum_year"
            :items="curriculumYears"
            label="Curriculum Year"
            variant="outlined"
            density="comfortable"
          />
        </v-col>
      </v-row>

      <!-- FIXED: Toggle now reacts to GenEd Dean role -->
      <v-switch
        v-model="form.is_gened"
        :disabled="canSetGenEd" 
        color="purple-darken-2"
        inset
        class="mt-2"
        :label="`General Education Subject${canSetGenEd ? ' (locked by GenEd Dean)' : ''}`"
      />


      <div class="d-flex justify-end mt-4">
        <v-btn variant="text" @click="close">Cancel</v-btn>
        <v-btn color="primary" class="ml-2" @click="handleSave">Save</v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import type { Subject } from "../../types/Subject"

const props = defineProps<{
  modelValue: boolean
  data: Subject | null
  canSetGenEd: boolean
}>()

const emit = defineEmits(["update:modelValue", "save"])

/* ---------- Dialog Binding ---------- */
const open = computed({
  get: () => props.modelValue,
  set: v => emit("update:modelValue", v)
})

/* ---------- Dropdown Arrays ---------- */
const academicYears = Array.from({ length: 42 }, (_, i) => {
  const start = 2008 + i
  return `${start}-${start + 1}`
})

const curriculumYears = Array.from({ length: 43 }, (_, i) =>
  (2008 + i).toString()
)

const yearLevelItems = [
  { title: "1st Year", value: 1 },
  { title: "2nd Year", value: 2 },
  { title: "3rd Year", value: 3 },
  { title: "4th Year", value: 4 }
]

const empty: Subject = {
  id: undefined,
  department_id: "",
  course_code: "",
  description: "",
  lec: 0,
  lab: 0,
  units: 0,
  year_level_number: 1,
  year_level_label: "1st Year",
  semester: "1ST",
  academic_year: "",
  curriculum_year: "",
  is_gened: false
}

const form = ref<Subject>({ ...empty })

/* ---------- Load Data When Editing ---------- */
watch(
  () => props.data,
  val => {
    form.value = val ? { ...val } : { ...empty }
  },
  { immediate: true }
)

/* ---------- Auto Compute Units ---------- */
watch(
  () => [form.value.lec, form.value.lab],
  () => {
    form.value.units =
      Number(form.value.lec || 0) + Number(form.value.lab || 0)
  }
)

/* ---------- Save Logic ---------- */
function handleSave() {
  const yearMap: Record<number, string> = {
    1: "1st Year",
    2: "2nd Year",
    3: "3rd Year",
    4: "4th Year"
  }

  form.value.year_level_label = yearMap[form.value.year_level_number]

  emit("save", { ...form.value })
}

function close() {
  emit("update:modelValue", false)
}
</script>