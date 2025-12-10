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

      <!-- Validation alert -->
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
        hint="Filtered by selected class & term"
        persistent-hint
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
        label="Room (optional)"
        density="comfortable"
        variant="outlined"
        class="mb-3"
        :disabled="role === 'ADMIN'"
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
        :disabled="lockDay || role === 'ADMIN'"
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
            :disabled="lockTime || role === 'ADMIN'"
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
            :disabled="lockTime || role === 'ADMIN'"
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
          :loading="saving"
          @click="handleSaveClick"
        >
          {{ isEdit ? "Update" : "Save" }}
        </v-btn>
      </div>
    </v-card>

    <!-- Snackbar -->
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

//
// Types matching your schema
//
interface ClassItem {
  id: string
  class_name: string
  year_level_number: number
  year_level_label: string
  section: string
  academic_term_id?: string | null
}

interface SubjectItem {
  id: string
  course_code: string
  description: string
  year_level_number: number
  year_level_label?: string
  semester: string
  is_gened?: boolean
}

interface FacultyItem {
  id: string
  first_name: string
  last_name: string
  subject_ids?: string[]
}

interface PeriodItem {
  id: string
  label: string
  start_time?: string
  end_time?: string
  slot_index?: number
}

interface DayItem {
  value: string
  label: string
}

type Role = "ADMIN" | "DEAN" | "GENED" | "FACULTY"
type DrawerMode = "CREATE" | "MOVE" | "RESIZE"

//
// Props
//
const props = defineProps<{
  modelValue: boolean
  role?: Role
  mode: DrawerMode
  payload?: any | null
  classes?: any[] | null
  subjects?: any[] | null
  classSubjects?: any[] | null
  faculty?: any[] | null
  periods?: any[] | null
  rooms?: any[] | null
  days?: any[] | null
  lockDay?: boolean
  lockTime?: boolean
  currentTermSemester?: string | null   // STRING: "1ST" | "2ND" | "SUMMER"
  currentTermId?: string | null         // UUID — FIXED HERE
}>();
const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void
  (e: "save", payload: Record<string, any>): void
}>()

//
// Local reactive model
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

const saving = ref(false)
const snackbar = ref({ show: false, message: "", timeout: 6000 })

//
// Safe fallbacks for possibly undefined props
//
const classesSafe = computed(() => props.classes ?? [])
const subjectsSafe = computed(() => props.subjects ?? [])
const classSubjectsSafe = computed(() => props.classSubjects ?? [])
const facultySafe = computed(() => props.faculty ?? [])
const periodsSafe = computed(() => props.periods ?? [])
const roomsSafe = computed(() => props.rooms ?? [])
const daysSafe = computed(() => props.days ?? [
  { value: "MON", label: "Mon" },
  { value: "TUE", label: "Tue" },
  { value: "WED", label: "Wed" },
  { value: "THU", label: "Thu" },
  { value: "FRI", label: "Fri" },
  { value: "SAT", label: "Sat" }
])

//
// UI helpers (named to avoid 'unknown' TS issues in templates)
//
const classLabel = (c: ClassItem) => `${c.class_name} ${c.year_level_label} - ${c.section}`
const subjectLabel = (s?: SubjectItem) =>
  s ? `${s.course_code} — ${s.description}` : ""
const facultyLabel = (f: any) => `${f.last_name}, ${f.first_name}`
const periodLabel = (p: PeriodItem) => p.label ?? `${p.start_time ?? ""} - ${p.end_time ?? ""}`
const dayLabel = (d: DayItem) => d.label
const role = props.role ?? "DEAN"

const modeItems = [
  { value: "F2F", label: "Face to Face" },
  { value: "ONLINE", label: "Online" },
  { value: "ASYNC", label: "Asynchronous" }
]
const modeLabel = (m: { value: string; label: string }) => m.label

//
// Computeds & filters
//
const facultyList = computed(() =>
  facultySafe.value.map(f => ({ ...f, full_name: facultyLabel(f) }))
)

/**
 * Filter subjects using class_subjects table (server-driven)
 * Only include subjects assigned to selected class for the current academic term.
 */
const filteredSubjects = computed(() => {
  if (!local.value.class_id) return []

  const cls = classesSafe.value.find(c => c.id === local.value.class_id)
  if (!cls) return []

  const classYear = cls.year_level_number
  const termSemester = props.currentTermSemester // 1ST / 2ND / SUMMER

  // 1 — subjects that match CLASS YEAR + TERM SEMESTER
  let eligible = subjectsSafe.value.filter(s =>
    s.year_level_number === classYear &&
    s.semester === termSemester
  )

  // 2 — include additional subjects explicitly added in class_subjects
  const overrideIds = classSubjectsSafe.value
    .filter(cs => cs.class_id === cls.id && cs.academic_term_id === props.currentTermId)
    .map(cs => cs.subject_id)

  const overrideSubs = subjectsSafe.value.filter(s => overrideIds.includes(s.id))

  // 3 — merge + dedupe
  const combined = [...eligible, ...overrideSubs]
  const unique = combined.filter((s, i, arr) => arr.findIndex(t => t.id === s.id) === i)

  return unique
})


//
// Header / summary
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

const summaryLabel = computed(() => {
  if (!local.value.day || !local.value.period_start_id) return ""
  const dayTxt = daysSafe.value.find(d => d.value === local.value.day)?.label ?? ""
  const start = periodsSafe.value.find(p => p.id === local.value.period_start_id)
  const end = periodsSafe.value.find(p => p.id === local.value.period_end_id)
  if (!start || !end) return dayTxt
  return `${dayTxt} · ${periodLabel(start)}`
})

//
// Validation
//
const validationMessage = computed(() => {
  if (!local.value.class_id) return "Please select a class."
  if (!local.value.subject_id) return "Please select a subject."
  if (!local.value.day) return "Please select a day."
  if (!local.value.period_start_id || !local.value.period_end_id) return "Please select both start and end time."

  const startIdx = periodsSafe.value.find(p => p.id === local.value.period_start_id)?.slot_index ?? null
  const endIdx = periodsSafe.value.find(p => p.id === local.value.period_end_id)?.slot_index ?? null
  if (startIdx == null || endIdx == null) return "Invalid time selection."
  if (endIdx < startIdx) return "End time must be after start time."
  return ""
})
const isValid = computed(() => validationMessage.value === "")

//
// Watchers
//

// Sync incoming payload -> local state, but preserve calendar-chosen time when creating a new range
watch(
  () => props.payload,
  (val) => {
    // Preserve any previously selected day/time (this allows calendar's selection to survive opening the drawer)
    const preserved = {
      day: local.value.day,
      start: local.value.period_start_id,
      end: local.value.period_end_id
    }

    // If payload missing -> new blank but prefer preserved times
    if (!val) {
      local.value = {
        id: null,
        class_id: null,
        subject_id: null,
        faculty_id: null,
        room_id: null,
        mode: "F2F",
        day: preserved.day ?? null,
        period_start_id: preserved.start ?? null,
        period_end_id: preserved.end ?? null,
        academic_term_id: props.currentTermId ?? null
      }
      return
    }

    // Merge payload into local but robustly extract period ids:
    const periodStartId =
      val.period_start_id ??
      (val.period_start?.id ? val.period_start.id : null) ??
      (typeof val.startSlot === "number"
        ? periodsSafe.value.find(p => p.slot_index === val.startSlot)?.id
        : null)

    const periodEndId =
      val.period_end_id ??
      (val.period_end?.id ? val.period_end.id : null) ??
      (typeof val.endSlot === "number"
        ? periodsSafe.value.find(p => p.slot_index === val.endSlot)?.id
        : null)

    local.value = {
      id: val.id ?? null,
      class_id: val.class_id ?? val.class ?? null,
      subject_id: val.subject_id ?? null,
      faculty_id: val.faculty_id ?? null,
      room_id: val.room_id ?? null,
      mode: val.mode ?? "F2F",
      day: val.day ?? null,
      period_start_id: periodStartId ?? preserved.start ?? null,
      period_end_id: periodEndId ?? preserved.end ?? null,
     academic_term_id: props.currentTermId ?? val.academic_term_id ?? null
    }

    // If create-range (no id) but preserved slot exists keep preserved
    if (!val.id && preserved.start && preserved.end) {
      local.value.day = preserved.day ?? local.value.day
      local.value.period_start_id = preserved.start
      local.value.period_end_id = preserved.end
    }
  },
  { immediate: true }
)

// When class changes -> reset subject (auto-pick if only 1 available)
watch(
  () => local.value.class_id,
  () => {
    local.value.subject_id = null
    const subs = Array.isArray(filteredSubjects?.value)
      ? filteredSubjects.value
      : []
    if (subs.length === 1) local.value.subject_id = subs[0]?.id ?? null
  }
)

// If filteredSubjects no longer contains the selected subject, clear it
watch(
  () => filteredSubjects.value.map(s => s.id).join(","),
  () => {
    if (local.value.subject_id && !filteredSubjects.value.some(s => s.id === local.value.subject_id)) {
      local.value.subject_id = null
    }
  }
)

// Sync incoming faculty id (e.g., when open-from-faculty view)
watch(
  () => props.payload?.faculty_id,
  (val) => {
    if (val) local.value.faculty_id = val
  },
  { immediate: true }
)

//
// Methods
//
function handleSaveClick() {
  if (!isValid.value) {
    snackbar.value = { show: true, message: validationMessage.value ?? "Fix the form.", timeout: 6000 }
    return
  }

  saving.value = true
  try {
    emit("save", { ...local.value, operation: props.mode })
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
  set: (v: boolean) => emit("update:modelValue", v)
})
</script>

<style scoped>
/* small UX polish */
.v-navigation-drawer .v-card {
  min-height: 100%;
}
</style>
