<template>
  <v-navigation-drawer
    v-model="drawerModel"
    location="right"
    width="480"
    temporary
  >
    <v-card flat class="pa-4">

      <!-- HEADER -->
      <div class="d-flex justify-space-between align-center mb-2">
        <div>
          <h3 class="text-h6 font-weight-medium">{{ headerTitle }}</h3>
          <div v-if="summaryLabel" class="text-caption text-medium-emphasis mt-1">
            {{ summaryLabel }}
          </div>
        </div>

        <v-btn icon variant="text" @click="close">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </div>

      <v-divider class="my-3" />

      <!-- VALIDATION MESSAGE -->
      <v-alert
        v-if="validationMessage"
        type="warning"
        variant="tonal"
        border="start"
        density="comfortable"
        class="mb-3"
      >
        {{ validationMessage }}
      </v-alert>

      <!-- CLASS -->
      <v-select
        v-model="local.class_id"
        :items="classesSafe"
        :item-title="classLabel"
        item-value="id"
        label="Class"
        density="comfortable"
        variant="outlined"
        class="mb-3"
        :disabled="classDisabled"
        clearable
      />

      <!-- SUBJECT -->
      <v-select
        v-model="local.subject_id"
        :items="filteredSubjects"
        :item-title="subjectLabel"
        item-value="id"
        label="Subject"
        density="comfortable"
        variant="outlined"
        class="mb-3"
        :disabled="!local.class_id || subjectDisabled"
        clearable
      />

      <!-- FACULTY -->
      <v-select
        v-model="local.faculty_id"
        :items="facultyList"
        item-title="full_name"
        item-value="id"
        label="Teacher (optional)"
        density="comfortable"
        variant="outlined"
        class="mb-3"
        :disabled="facultyDisabled"
        clearable
      />

      <!-- ROOM -->
      <v-select
        v-model="local.room_id"
        :items="roomsSafe"
        item-title="name"
        item-value="id"
        label="Room (Face-to-Face only)"
        density="comfortable"
        variant="outlined"
        class="mb-3"
        :disabled="roomDisabled"
        clearable
      />

      <!-- MODE -->
      <v-select
        v-model="local.mode"
        :items="modeItems"
        item-title="label"
        item-value="value"
        label="Mode"
        density="comfortable"
        variant="outlined"
        class="mb-3"
        :disabled="modeDisabled"
      />

      <!-- DAY -->
      <v-select
        v-model="local.day"
        :items="daysSafe"
        item-title="label"
        item-value="value"
        label="Day"
        density="comfortable"
        variant="outlined"
        class="mb-3"
        :disabled="dayDisabled"
      />

      <!-- TIME -->
      <v-row>
        <v-col>
          <v-select
            v-model="local.period_start_id"
            :items="periodsSafe"
            :item-title="periodLabel"
            item-value="id"
            label="Start Time"
            density="comfortable"
            variant="outlined"
            :disabled="timeDisabled"
          />
        </v-col>
        <v-col>
          <v-select
            v-model="local.period_end_id"
            :items="periodsSafe"
            :item-title="periodLabel"
            item-value="id"
            label="End Time"
            density="comfortable"
            variant="outlined"
            :disabled="timeDisabled"
          />
        </v-col>
      </v-row>

      <v-divider class="my-4" />

      <!-- ACTIONS -->
      <div class="d-flex justify-end">
        <v-btn variant="text" @click="close">Cancel</v-btn>
        <v-btn
          color="primary"
          class="ml-2"
          :loading="saving"
          :disabled="!isValid || saving"
          @click="handleSave"
        >
          {{ isEdit ? "Update" : "Save" }}
        </v-btn>
      </div>
    </v-card>

    <!-- SNACKBAR -->
    <v-snackbar v-model="snackbar.show" location="bottom" :timeout="snackbar.timeout">
      {{ snackbar.message }}
      <template #actions>
        <v-btn variant="text" @click="snackbar.show = false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue"
import { useScheduleStore } from "@/stores/useScheduleStore"

/* -------------------------------------------------- */
/* PROPS & EMITS */
/* -------------------------------------------------- */
const props = defineProps<{
  modelValue: boolean
  role: string
  mode: "CREATE" | "MOVE" | "RESIZE"
  payload: any
  classes: any[]
  subjects: any[]
  classSubjects: any[]
  faculty: any[]
  rooms: any[]
  periods: any[]
  days: { value: string; label: string }[]
  lockDay: boolean
  lockTime: boolean
  currentTermSemester: string | null
  currentTermId: string | null
}>()

const emit = defineEmits(["update:modelValue", "save"])

const scheduleStore = useScheduleStore()

/* -------------------------------------------------- */
/* SAFE DATA */
/* -------------------------------------------------- */
const classesSafe = computed(() => props.classes ?? [])
const subjectsSafe = computed(() => props.subjects ?? [])
const facultySafe = computed(() => props.faculty ?? [])
const roomsSafe = computed(() => props.rooms ?? [])
const periodsSafe = computed(() => props.periods ?? [])
const daysSafe = computed(() => props.days ?? [])

/* -------------------------------------------------- */
/* LOCAL MODEL */
/* -------------------------------------------------- */
const local = ref({
  id: null as string | null,
  class_id: null as string | null,
  subject_id: null as string | null,
  faculty_id: null as string | null,
  room_id: null as string | null,
  mode: "F2F",
  day: null as string | null,
  period_start_id: null as string | null,
  period_end_id: null as string | null,
  academic_term_id: props.currentTermId
})

/* -------------------------------------------------- */
/* LABEL HELPERS */
/* -------------------------------------------------- */
const classLabel = (c: any) =>
  `${c.class_name} ${c.year_level_label} - ${c.section}`

const subjectLabel = (s: any) =>
  `${s.course_code} — ${s.description}`

const periodLabel = (p: any) =>
  `${p.start_time} - ${p.end_time}`

/* -------------------------------------------------- */
/* MODE */
/* -------------------------------------------------- */
const modeItems = [
  { value: "F2F", label: "Face to Face" },
  { value: "ONLINE", label: "Online" },
  { value: "ASYNC", label: "Asynchronous" }
]

/* -------------------------------------------------- */
/* FACULTY DISPLAY */
/* -------------------------------------------------- */
const facultyList = computed(() =>
  facultySafe.value.map((f: any) => ({
    ...f,
    full_name: `${f.last_name}, ${f.first_name}`
  }))
)

/* -------------------------------------------------- */
/* LOCK RULES (CRITICAL) */
/* -------------------------------------------------- */
const classDisabled = computed(() =>
  props.mode !== "CREATE"
)

const subjectDisabled = computed(() =>
  props.role === "ADMIN"
)

const facultyDisabled = computed(() =>
  props.role === "ADMIN"
)

const modeDisabled = computed(() =>
  props.role === "ADMIN"
)

const dayDisabled = computed(() =>
  props.lockDay
)

const timeDisabled = computed(() =>
  props.lockTime
)

const roomDisabled = computed(() =>
  local.value.mode !== "F2F"
)

/* -------------------------------------------------- */
/* SUBJECT FILTER */
/* -------------------------------------------------- */
const filteredSubjects = computed(() => {
  if (!local.value.class_id) return []

  const cls = classesSafe.value.find(c => c.id === local.value.class_id)
  if (!cls) return []

  return subjectsSafe.value.filter(
    s =>
      s.year_level_number === cls.year_level_number &&
      s.semester === props.currentTermSemester
  )
})

/* -------------------------------------------------- */
/* HEADER & SUMMARY */
/* -------------------------------------------------- */
const isEdit = computed(() => !!local.value.id)

const headerTitle = computed(() =>
  props.mode === "MOVE"
    ? "Move Schedule"
    : props.mode === "RESIZE"
    ? "Resize Schedule"
    : isEdit.value
    ? "Update Schedule"
    : "Create Schedule"
)

const summaryLabel = computed(() => {
  if (!local.value.day || !local.value.period_start_id) return ""
  const day = daysSafe.value.find(d => d.value === local.value.day)?.label
  const p = periodsSafe.value.find(p => p.id === local.value.period_start_id)
  return `${day} · ${periodLabel(p)}`
})

/* -------------------------------------------------- */
/* VALIDATION */
/* -------------------------------------------------- */
const validationMessage = computed(() => {
  if (!local.value.class_id) return "Class is required."
  if (!local.value.subject_id) return "Subject is required."
  if (!local.value.day) return "Day is required."
  if (!local.value.period_start_id || !local.value.period_end_id)
    return "Start and end time are required."

  const start = periodsSafe.value.find(p => p.id === local.value.period_start_id)
  const end = periodsSafe.value.find(p => p.id === local.value.period_end_id)

  if (!start || !end) return "Invalid period selection."
  if (start.slot_index > end.slot_index)
    return "End time must be after start time."

  if (local.value.mode !== "F2F" && local.value.room_id)
    return "Room is only allowed for Face-to-Face mode."

  return ""
})

const isValid = computed(() => validationMessage.value === "")

/* -------------------------------------------------- */
/* PAYLOAD WATCH */
/* -------------------------------------------------- */
watch(
  () => props.payload,
  val => {
    if (!val) return
    local.value = {
      id: val.id ?? null,
      class_id: val.class_id ?? null,
      subject_id: val.subject_id ?? null,
      faculty_id: val.faculty_id ?? null,
      room_id: val.room_id ?? null,
      mode: val.mode ?? "F2F",
      day: val.day ?? null,
      period_start_id: val.period_start_id ?? val.period_start?.id ?? null,
      period_end_id: val.period_end_id ?? val.period_end?.id ?? null,
      academic_term_id: props.currentTermId
    }
  },
  { immediate: true }
)

/* -------------------------------------------------- */
/* SAVE */
/* -------------------------------------------------- */
const saving = ref(false)
const snackbar = ref({ show: false, message: "", timeout: 4000 })

async function handleSave() {
  if (!isValid.value) {
    snackbar.value = { show: true, message: validationMessage.value, timeout: 5000 }
    return
  }

  saving.value = true
  try {
const res = await scheduleStore.saveSchedule({
  ...local.value,
  force: false
})

if (res && "requires_force" in res && res.requires_force) {
  const { classConflicts, facultyConflicts, roomConflicts } =
    res.conflicts?.details ?? {}

  let msg = "⛔ Conflict detected."

  if (classConflicts?.length) msg += " Class conflict."
  if (facultyConflicts?.length) msg += " Faculty conflict."
  if (roomConflicts?.length) msg += " Room conflict."

  snackbar.value = {
    show: true,
    message: msg,
    timeout: 8000
  }
  return
}


    snackbar.value = {
      show: true,
      message: isEdit.value ? "Schedule updated." : "Schedule created.",
      timeout: 3000
    }

    emit("save")
    close()
  } catch (e: any) {
    snackbar.value = {
      show: true,
      message: e?.message ?? "Failed to save schedule.",
      timeout: 7000
    }
  } finally {
    saving.value = false
  }
}

function close() {
  emit("update:modelValue", false)
}

const drawerModel = computed({
  get: () => props.modelValue,
  set: v => emit("update:modelValue", v)
})
</script>

<style scoped>
.v-navigation-drawer .v-card {
  min-height: 100%;
}
</style>
