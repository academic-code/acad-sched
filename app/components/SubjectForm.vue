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

      <v-row>
        <v-col cols="6">
          <v-text-field
            v-model="form.academic_year"
            label="Academic Year (e.g. 2024-2025)"
            variant="outlined"
            density="comfortable"
          />
        </v-col>
        <v-col cols="6">
          <v-text-field
            v-model="form.curriculum_year"
            label="Curriculum Year (e.g. 2023)"
            variant="outlined"
            density="comfortable"
          />
        </v-col>
      </v-row>

      <v-switch
        v-model="form.is_gened"
        :disabled="!canSetGenEd"
        color="purple-darken-2"
        inset
        class="mt-2"
        :label="`General Education Subject${canSetGenEd ? '' : ' (locked)'}`"
      />

      <div class="d-flex justify-end mt-4">
        <v-btn variant="text" @click="close">Cancel</v-btn>
        <v-btn color="primary" class="ml-2" @click="handleSave">
          Save
        </v-btn>
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

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void
  (e: "save", payload: Subject): void
}>()

const open = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit("update:modelValue", val)
})

const yearLevelItems = [
  { title: "1st Year", value: 1 },
  { title: "2nd Year", value: 2 },
  { title: "3rd Year", value: 3 },
  { title: "4th Year", value: 4 },
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

watch(
  () => props.data,
  (val) => {
    if (val) {
      form.value = { ...val }
    } else {
      form.value = { ...empty }
    }
  },
  { immediate: true }
)

function close() {
  emit("update:modelValue", false)
}

function handleSave() {
  const yl = form.value.year_level_number
  if (yl === 1) form.value.year_level_label = "1st Year"
  else if (yl === 2) form.value.year_level_label = "2nd Year"
  else if (yl === 3) form.value.year_level_label = "3rd Year"
  else if (yl === 4) form.value.year_level_label = "4th Year"

  emit("save", { ...form.value })
}
</script>
