<template>
  <v-navigation-drawer
    v-model="drawerModel"
    location="right"
    width="480"
    temporary
  >
    <v-card flat class="pa-4">
      <!-- Header -->
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

      <!-- Validation -->
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

      <!-- Class -->
      <v-select
        v-model="local.class_id"
        :items="classesSafe"
        :item-title="classLabel"
        item-value="id"
        label="Class"
        density="comfortable"
        variant="outlined"
        class="mb-3"
        :disabled="role === 'ADMIN'"
        clearable
      />

      <!-- Subject -->
      <v-select
        v-model="local.subject_id"
        :items="filteredSubjects"
        :item-title="subjectLabel"
        item-value="id"
        label="Subject"
        density="comfortable"
        variant="outlined"
        class="mb-3"
        :disabled="!local.class_id || role === 'ADMIN'"
        clearable
      />

      <!-- Faculty -->
      <v-select
        v-model="local.faculty_id"
        :items="facultyList"
        item-title="full_name"
        item-value="id"
        label="Teacher (optional)"
        density="comfortable"
        variant="outlined"
        class="mb-3"
        :disabled="role === 'ADMIN'"
        clearable
      />

      <!-- Room -->
      <v-select
        v-model="local.room_id"
        :items="roomsSafe"
        item-title="name"
        item-value="id"
        label="Room (optional — F2F only)"
        density="comfortable"
        variant="outlined"
        class="mb-3"
        :disabled="roomDisabled || role === 'ADMIN'"
        clearable
      />

      <!-- Mode -->
      <v-select
        v-model="local.mode"
        :items="modeItems"
        :item-title="modeLabel"
        item-value="value"
        label="Mode"
        density="comfortable"
        variant="outlined"
        class="mb-3"
        :disabled="role === 'ADMIN'"
      />

      <!-- Day -->
      <v-select
        v-model="local.day"
        :items="daysSafe"
        :item-title="dayLabel"
        item-value="value"
        label="Day"
        density="comfortable"
        variant="outlined"
        class="mb-3"
      />

      <!-- Time -->
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
          />
        </v-col>
      </v-row>

      <v-divider class="my-4" />

      <div class="d-flex justify-end">
        <v-btn variant="text" @click="close">Cancel</v-btn>

        <v-btn
          color="primary"
          class="ml-2"
          :disabled="!isValid || saving"
          :loading="saving"
          @click="handleSaveClick"
        >
          {{ isEdit ? "Update" : "Save" }}
        </v-btn>
      </div>
    </v-card>

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

// Optional mapping of known error messages to friendly messages
const ERROR_MAP: Record<string, string> = {
  "Validation failed": "Please check the form fields and try again."
}

//
// --------------------------------------------------
// STRICT INTERFACES (FIXES ALL TS ERRORS)
// --------------------------------------------------
interface ClassItem {
  id: string
  class_name: string
  year_level_number: number
  year_level_label: string
  section: string
}

interface SubjectItem {
  id: string
  course_code: string
  description: string
  year_level_number: number
  semester: string
  is_gened?: boolean
}

interface PeriodItem {
  id: string
  label?: string
  start_time?: string
  end_time?: string
  slot_index: number
}

interface ClassSubjectMap {
  class_id: string
  subject_id: string
  academic_term_id: string
}

//
// Props & Emits
//
const props = defineProps({
  modelValue: Boolean,
  role: String,
  mode: String,
  payload: Object,
  classes: Array,
  subjects: Array,
  classSubjects: Array,
  faculty: Array,
  periods: Array,
  rooms: Array,
  days: Array,
  lockDay: Boolean,
  lockTime: Boolean,
  currentTermSemester: String,
  currentTermId: String
})

const emit = defineEmits(["update:modelValue", "save"])

const scheduleStore = useScheduleStore()

//
// Safe casts
//
const classesSafe = computed(() => props.classes as ClassItem[] ?? [])
const subjectsSafe = computed(() => props.subjects as SubjectItem[] ?? [])
const facultySafe = computed(() => props.faculty as any[] ?? [])
const periodsSafe = computed(() => props.periods as PeriodItem[] ?? [])
const roomsSafe = computed(() => props.rooms as any[] ?? [])
const daysSafe = computed(
  () =>
    (props.days as { value: string; label: string }[]) ?? [
      { value: "MONDAY", label: "Mon" },
      { value: "TUESDAY", label: "Tue" },
      { value: "WEDNESDAY", label: "Wed" },
      { value: "THURSDAY", label: "Thu" },
      { value: "FRIDAY", label: "Fri" },
      { value: "SATURDAY", label: "Sat" }
    ]
)

//
// Local model
//
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
  academic_term_id: props.currentTermId ?? null
})

//
// Label formatters — rewritten for Vuetify type compatibility
//
const classLabel = (c: any) =>
  `${c?.class_name ?? ""} ${c?.year_level_label ?? ""} - ${c?.section ?? ""}`

const subjectLabel = (s: any) =>
  `${s?.course_code ?? ""} — ${s?.description ?? ""}`

const periodLabel = (p: any) =>
  p?.label ?? `${p?.start_time ?? ""} - ${p?.end_time ?? ""}`

const dayLabel = (d: any) => d?.label ?? ""

const modeItems = [
  { value: "F2F", label: "Face to Face" },
  { value: "ONLINE", label: "Online" },
  { value: "ASYNC", label: "Asynchronous" }
]

const modeLabel = (m: any) => m?.label ?? ""

//
// Faculty list
//
const facultyList = computed(() =>
  facultySafe.value.map((f: any) => ({
    ...f,
    full_name: `${f.last_name}, ${f.first_name}`
  }))
)

//
// Room rule
//
const roomDisabled = computed(() => local.value.mode !== "F2F")

watch(
  () => local.value.mode,
  m => {
    if (m !== "F2F") local.value.room_id = null
  }
)

//
// Subject filtering — fully typed and correct
//
const filteredSubjects = computed((): SubjectItem[] => {
  if (!local.value.class_id) return []

  const cls = classesSafe.value.find(c => c.id === local.value.class_id)
  if (!cls) return []

  const classYear = cls.year_level_number
  const termSemester = props.currentTermSemester ?? null

  let eligible = subjectsSafe.value.filter(
    s => s.year_level_number === classYear && s.semester === termSemester
  )

  const overrideIds = (props.classSubjects as ClassSubjectMap[] ?? [])
    .filter(cs => cs.class_id === cls.id && cs.academic_term_id === props.currentTermId)
    .map(cs => cs.subject_id)

  const overrideSubs = subjectsSafe.value.filter(s =>
    overrideIds.includes(s.id)
  )

  return [...eligible, ...overrideSubs].filter(
    (v, i, arr) => arr.findIndex(x => x.id === v.id) === i
  )
})

//
// Header title
//
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

//
// Summary label
//
const summaryLabel = computed(() => {
  if (!local.value.day || !local.value.period_start_id) return ""
  const dayTxt = daysSafe.value.find(d => d.value === local.value.day)?.label
  const start = periodsSafe.value.find(p => p.id === local.value.period_start_id)
  if (!start) return dayTxt ?? ""
  return `${dayTxt} · ${periodLabel(start)}`
})

//
// Validation
//
const validationMessage = computed(() => {
  if (!local.value.class_id) return "Please select a class."
  if (!local.value.subject_id) return "Please select a subject."
  if (!local.value.day) return "Please select a day."

  const start = periodsSafe.value.find(p => p.id === local.value.period_start_id)
  const end = periodsSafe.value.find(p => p.id === local.value.period_end_id)
  if (!start || !end) return "Please select start and end time."

  if (start.slot_index > end.slot_index)
    return "End time must be after start time."

  if (local.value.mode !== "F2F" && local.value.room_id)
    return "Rooms are only allowed for Face-to-Face mode."

  return ""
})

const isValid = computed(() => validationMessage.value === "")

//
// Watch payload
//
watch(
  () => props.payload,
  val => {
    if (!val) {
      local.value = {
        id: null,
        class_id: null,
        subject_id: null,
        faculty_id: null,
        room_id: null,
        mode: "F2F",
        day: null,
        period_start_id: null,
        period_end_id: null,
        academic_term_id: props.currentTermId ?? null
      }
      return
    }

    local.value = {
      id: val.id ?? null,
      class_id: val.class_id ?? null,
      subject_id: val.subject_id ?? null,
      faculty_id: val.faculty_id ?? null,
      room_id: val.mode === "F2F" ? val.room_id ?? null : null,
      mode: val.mode ?? "F2F",
      day: val.day ?? null,
      period_start_id:
        val.period_start_id ??
        val.period_start?.id ??
        periodsSafe.value.find(p => p.slot_index === val.startSlot)?.id ??
        null,
      period_end_id:
        val.period_end_id ??
        val.period_end?.id ??
        periodsSafe.value.find(p => p.slot_index === val.endSlot)?.id ??
        null,
      academic_term_id: props.currentTermId ?? val.academic_term_id ?? null
    }
  },
  { immediate: true }
)

//
// Save button handler
//
const saving = ref(false)
const snackbar = ref({ show: false, message: "", timeout: 6000 })

async function handleSaveClick() {
  if (!isValid.value) {
    snackbar.value = {
      show: true,
      message: validationMessage.value,
      timeout: 5000
    }
    return
  }

  saving.value = true

  try {
    const payload = {
      id: local.value.id ?? undefined,
      class_id: local.value.class_id,
      subject_id: local.value.subject_id,
      faculty_id: local.value.faculty_id ?? null,
      room_id: local.value.mode === "F2F" ? local.value.room_id ?? null : null,
      day: local.value.day,
      period_start_id: local.value.period_start_id,
      period_end_id: local.value.period_end_id,
      academic_term_id: local.value.academic_term_id,
      mode: local.value.mode,
      force: false
    }

    const res: any = await scheduleStore.saveSchedule(payload)

    if (res?.conflict) {
      snackbar.value = {
        show: true,
        message: "⛔ Conflict detected. Please resolve or force replace.",
        timeout: 7000
      }
      return
    }

    snackbar.value = {
      show: true,
      message: local.value.id
        ? "Successfully updated schedule."
        : "Successfully saved schedule.",
      timeout: 3000
    }

    setTimeout(() => close(), 300)

  } catch (err: any) {
    const msg =
      err?.data?.message ||
      err?.message ||
      "Failed to save schedule."

    snackbar.value = {
      show: true,
      message: msg,
      timeout: 7000
    }

    console.error("Schedule save error:", err)
  } finally {
    saving.value = false
  }
}



function close() {
  emit("update:modelValue", false)
}

//
// Drawer binding
//
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
