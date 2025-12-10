<template>
  <v-navigation-drawer
    v-model="model"
    location="right"
    width="480"
    temporary
  >
    <v-card flat class="pa-4">

      <!-- Header -->
      <div class="d-flex justify-space-between align-center">
        <h3 class="text-h6 font-weight-medium">
          {{ isEdit ? "Update Schedule" : "Create Schedule" }}
        </h3>

        <v-btn icon variant="text" @click="close">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </div>

      <v-divider class="my-3" />

      <!-- Role Notice -->
      <v-alert
        v-if="role === 'ADMIN'"
        type="info"
        variant="tonal"
        border="start"
        density="compact"
      >
        Read-Only Mode — Admin cannot create schedules.
      </v-alert>


      <!-- Class -->
      <v-select
        v-model="local.class_id"
        :items="filteredClasses"
        item-title="class_name"
        item-value="id"
        label="Class"
        variant="outlined"
        density="comfortable"
        :disabled="role === 'ADMIN'"
        class="mb-3"
      />

      <!-- Subject -->
      <v-select
        v-model="local.subject_id"
        :items="filteredSubjects"
        item-title="description"
        item-value="id"
        label="Subject"
        variant="outlined"
        density="comfortable"
        :disabled="!local.class_id || role === 'ADMIN'"
        class="mb-3"
      />

      <!-- Faculty -->
      <v-select
        v-model="local.faculty_id"
        :items="filteredFaculty"
        item-title="full_name"
        item-value="id"
        label="Teacher"
        variant="outlined"
        density="comfortable"
        :disabled="role === 'ADMIN'"
        class="mb-3"
      />

      <!-- Room -->
      <v-select
        v-model="local.room_id"
        :items="rooms"
        item-title="name"
        item-value="id"
        label="Room"
        variant="outlined"
        density="comfortable"
        :disabled="role === 'ADMIN'"
        class="mb-3"
      />

      <!-- Mode -->
      <v-select
        v-model="local.mode"
        :items="modes"
        label="Mode"
        density="comfortable"
        variant="outlined"
        :disabled="role === 'ADMIN'"
        class="mb-3"
      />

      <!-- Time -->
      <v-row>
        <v-col>
          <v-select
            v-model="local.period_start_id"
            :items="periods"
            item-title="label"
            item-value="id"
            label="Start Time"
            density="comfortable"
            variant="outlined"
            :disabled="role === 'ADMIN'"
          />
        </v-col>
        <v-col>
          <v-select
            v-model="local.period_end_id"
            :items="periods"
            item-title="label"
            item-value="id"
            label="End Time"
            density="comfortable"
            variant="outlined"
            :disabled="role === 'ADMIN'"
          />
        </v-col>
      </v-row>

      <v-divider class="my-4" />

      <!-- Actions -->
      <div class="d-flex justify-end">
        <v-btn variant="text" @click="close">Cancel</v-btn>

        <v-btn
          v-if="role !== 'ADMIN'"
          color="primary"
          class="ml-2"
          :disabled="!isValid"
          @click="emitSave"
        >
          {{ isEdit ? "Update" : "Save" }}
        </v-btn>
      </div>
    </v-card>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue"

const props = defineProps<{
  modelValue: boolean
  role: "ADMIN" | "DEAN" | "GENED" | "FACULTY"
  data?: any | null
  classes: any[]
  subjects: any[]
  faculty: any[]
  periods: { id: string; label: string }[]
  rooms: any[]
}>()

const emit = defineEmits(["update:modelValue", "save"])

const model = computed({
  get: () => props.modelValue,
  set: v => emit("update:modelValue", v)
})

const local = ref<any>({
  id: null,
  class_id: null,
  subject_id: null,
  faculty_id: null,
  room_id: null,
  mode: "F2F",
  period_start_id: null,
  period_end_id: null,
})

const modes = ["F2F", "ONLINE", "ASYNC"]

const isEdit = computed(() => !!local.value.id)

watch(
  () => props.data,
  (val) => {
    local.value = val ? { ...val } : { ...local.value, id: null }
  },
  { immediate: true }
)

// Filtering logic based on role
const filteredClasses = computed(() =>
  props.role === "DEAN"
    ? props.classes
    : props.role === "GENED"
    ? props.classes.filter(c => c.is_gened || true) // GenEd sees all classes (read only)
    : props.classes
)

const filteredSubjects = computed(() => {
  if (!local.value.class_id) return []
  return props.subjects.filter(s =>
    s.year_level_number ===
    props.classes.find(c => c.id === local.value.class_id)?.year_level_number
  )
})

const filteredFaculty = computed(() => {
  if (!local.value.subject_id) return []
  return props.faculty // filtering later (Phase C logic)
})

const isValid = computed(() =>
  !!local.value.class_id &&
  !!local.value.subject_id &&
  !!local.value.period_start_id &&
  !!local.value.period_end_id
)

function emitSave() {
  emit("save", { ...local.value })
  model.value = false
}

function close() {
  model.value = false
}
</script>
