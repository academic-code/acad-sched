<template>
  <v-dialog v-model="model" width="800">
    <v-card class="pa-4">

      <h3 class="text-h6 font-weight-medium mb-4">
        {{ local.id ? "Edit Class" : "Create Class" }}
      </h3>

      <!-- Academic Term -->
      <v-select
        v-model="local.academic_term_id"
        :items="termOptions"
        item-title="label"
        item-value="value"
        label="Academic Term"
        variant="outlined"
        density="comfortable"
        class="mb-3"
        :disabled="!editing"
      />

      <!-- Class Name (Manual Input) -->
      <v-text-field
        v-model="local.class_name"
        label="Class Name (Manual Input)"
        variant="outlined"
        density="comfortable"
        class="mb-3"
      />

      <!-- Program Name -->
      <v-text-field
        v-model="local.program_name"
        label="Program Name"
        variant="outlined"
        density="comfortable"
        class="mb-3"
      />

      <!-- Year Level & Section -->
      <v-row>
        <v-col cols="6">
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

        <v-col cols="6">
          <v-select
            v-model="local.section"
            :items="sectionLetters"
            label="Section"
            variant="outlined"
            density="comfortable"
          />
        </v-col>
      </v-row>

      <!-- Adviser -->
      <v-select
        v-model="local.adviser_id"
        :items="facultyOptions"
        item-title="full_name"
        item-value="id"
        label="Class Adviser"
        variant="outlined"
        density="comfortable"
        class="mt-3"
      />

      <!-- Remarks -->
      <v-textarea
        v-model="local.remarks"
        label="Remarks (optional)"
        variant="outlined"
        density="comfortable"
        rows="2"
        class="mt-2"
      />

      <!-- Actions -->
      <div class="d-flex justify-end mt-4">
        <v-btn variant="text" @click="close">Cancel</v-btn>
        <v-btn
          :disabled="!isValid"
          :loading="saving"
          color="primary"
          class="ml-2"
          @click="emitSave"
        >
          {{ local.id ? "Update" : "Save" }}
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue"

import type { ClassFormPayload, FacultyOption } from "../../types/Class"
import type { AcademicTerm } from "../../types/AcademicTerm"

const props = defineProps<{
  modelValue: boolean
  data: ClassFormPayload | null
  academicTerms: AcademicTerm[]
  faculty: FacultyOption[]
  saving?: boolean
}>()

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void
  (e: "save", payload: ClassFormPayload): void
}>()

const model = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val)
})

/* ----------------------- OPTIONS ----------------------- */

const yearLevelItems = [
  { label: "1st Year", value: 1 },
  { label: "2nd Year", value: 2 },
  { label: "3rd Year", value: 3 },
  { label: "4th Year", value: 4 }
]

// Allowed Section Letters (A–Z)
const sectionLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")

const termOptions = computed(() =>
  props.academicTerms.map(t => ({
    value: t.id,
    label: `${t.academic_year} - ${t.semester}`
  }))
)

const facultyOptions = computed(() => props.faculty)

/* ----------------------- ACTIVE TERM HELPER ----------------------- */

const activeTerm = computed<AcademicTerm | null>(() => {
  return props.academicTerms?.find(t => t.is_active) || null
})

/* ----------------------- LOCAL FORM ----------------------- */

const local = ref<ClassFormPayload>({
  id: undefined,
  class_name: "",
  program_name: "",
  year_level_number: 1,
  section: "",
  adviser_id: null,
  remarks: "",
  academic_term_id: null
})

const editing = ref(false)

/* ----------------------- LOAD DATA ----------------------- */
watch(
  () => props.data,
  (val) => {
    if (val) {
      // Edit mode
      editing.value = true
      local.value = { ...val }
    } else {
      // Create mode — reset and try to auto-select active term
      editing.value = false
      resetForm()
    }
  },
  { immediate: true }
)

/* Also react when dialog opens (for create) and active term is known */
watch(
  () => model.value,
  (isOpen) => {
    if (!isOpen) return
    if (editing.value) return
    if (local.value.academic_term_id) return

    if (activeTerm.value) {
      local.value.academic_term_id = activeTerm.value.id
    }
  }
)

/* ----------------------- VALIDATION ----------------------- */
const isValid = computed(() =>
  !!local.value.class_name.trim() &&
  !!local.value.program_name.trim() &&
  !!local.value.section.trim() &&
  !!local.value.academic_term_id
)

const saving = computed(() => props.saving ?? false)

/* ----------------------- METHODS ----------------------- */

function resetForm() {
  local.value = {
    id: undefined,
    class_name: "",
    program_name: "",
    year_level_number: 1,
    section: "",
    adviser_id: null,
    remarks: "",
    academic_term_id: null
  }

  // If there is an active term, pre-select it
  if (activeTerm.value) {
    local.value.academic_term_id = activeTerm.value.id
  }
}

function emitSave() {
  emit("save", { ...local.value })
  model.value = false
}

function close() {
  model.value = false
}
</script>
