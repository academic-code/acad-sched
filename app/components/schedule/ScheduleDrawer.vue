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
          <h3 class="text-h6 font-weight-medium">
            {{ headerTitle }}
          </h3>
          <div v-if="summaryLabel" class="text-caption text-medium-emphasis mt-1">
            {{ summaryLabel }}
          </div>
        </div>

        <v-btn icon variant="text" @click="close">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </div>

      <v-divider class="my-3" />

      <!-- Role notice -->
      <v-alert
        v-if="role === 'ADMIN'"
        type="info"
        variant="tonal"
        border="start"
        density="comfortable"
        class="mb-3"
      >
        Read-only mode — Admin cannot create or update schedules.
      </v-alert>

      <!-- Conflict / validation alert -->
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
        hint="Filtered by selected class & term"
        persistent-hint
      />

      <!-- Faculty -->
      <v-select
        v-model="local.faculty_id"
        :items="filteredFaculty"
        item-title="full_name"
        item-value="id"
        label="Teacher (optional)"
        variant="outlined"
        density="comfortable"
        :disabled="role === 'ADMIN'"
        class="mb-3"
        clearable
      />

      <!-- Room -->
      <v-select
        v-model="local.room_id"
        :items="rooms"
        item-title="name"
        item-value="id"
        label="Room (optional)"
        variant="outlined"
        density="comfortable"
        :disabled="role === 'ADMIN'"
        class="mb-3"
        clearable
      />

      <!-- Mode -->
      <v-select
        v-model="local.mode"
        :items="modeItems"
        item-title="label"
        item-value="value"
        label="Mode"
        density="comfortable"
        variant="outlined"
        :disabled="role === 'ADMIN'"
        class="mb-3"
      />

      <!-- Day (can be locked if calendar already chose the day) -->
      <v-select
        v-model="local.day"
        :items="dayItems"
        item-title="label"
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
            :items="periods"
            item-title="label"
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
            :items="periods"
            item-title="label"
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
        <v-btn variant="text" @click="close">
          Cancel
        </v-btn>

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

    <!-- Conflict / validation snackbar -->
    <v-snackbar
      v-model="snackbar.show"
      location="bottom"
      :timeout="snackbar.timeout"
    >
      {{ snackbar.message }}
      <template #actions>
        <v-btn variant="text" @click="snackbar.show = false">
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue"

type Role = "ADMIN" | "DEAN" | "GENED" | "FACULTY"
type DrawerMode = "CREATE" | "MOVE" | "RESIZE"

type PeriodOption = {
  id: string
  label: string
  slot_index?: number
  start_time?: string | null
  end_time?: string | null
}

type DrawerPayload = {
  id?: string | null
  class_id?: string | null
  subject_id?: string | null
  faculty_id?: string | null
  room_id?: string | null
  mode?: string | null
  day?: string | null
  period_start_id?: string | null
  period_end_id?: string | null
  academic_term_id?: string | null
}

// ---------- PROPS / EMITS ----------
const props = defineProps<{
  modelValue: boolean
  role: Role
  mode: DrawerMode              // CREATE / MOVE / RESIZE from calendar action
  payload?: DrawerPayload | null
  classes: any[]
  subjects: any[]
  faculty: any[]
  periods: PeriodOption[]
  rooms: any[]
  // Optional helpers for UX
  days?: { value: string; label: string }[]
  lockDay?: boolean            // true if calendar already picked day
  lockTime?: boolean           // true if calendar already picked start/end
  currentTermSemester?: string | number | null
}>()

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void
  (e: "save", payload: DrawerPayload & { operation: DrawerMode }): void
}>()

// ---------- MODEL ----------
const drawerModel = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit("update:modelValue", v)
})

const local = ref<DrawerPayload>({
  id: null,
  class_id: null,
  subject_id: null,
  faculty_id: null,
  room_id: null,
  mode: "F2F",
  day: null,
  period_start_id: null,
  period_end_id: null,
  academic_term_id: null
})

const saving = ref(false)

// ---------- CONSTANTS ----------
const defaultDayItems = [
  { value: "MON", label: "Mon" },
  { value: "TUE", label: "Tue" },
  { value: "WED", label: "Wed" },
  { value: "THU", label: "Thu" },
  { value: "FRI", label: "Fri" },
  { value: "SAT", label: "Sat" }
]

const dayItems = computed(() => props.days ?? defaultDayItems)

const modeItems = [
  { value: "F2F", label: "Face to Face" },
  { value: "ONLINE", label: "Online" },
  { value: "ASYNC", label: "Asynchronous" }
]

// ---------- DERIVED ----------
const isEdit = computed(() => !!local.value.id)

const headerTitle = computed(() => {
  if (props.mode === "MOVE") return "Move Schedule"
  if (props.mode === "RESIZE") return "Resize Schedule"
  if (isEdit.value) return "Update Schedule"
  return "Create Schedule"
})

// Build map of period → ordering
const periodOrderMap = computed(() => {
  const map = new Map<string, number>()
  props.periods.forEach((p, idx) => {
    const order = p.slot_index ?? idx
    map.set(p.id, order)
  })
  return map
})

function findPeriodById(id?: string | null): PeriodOption | null {
  if (!id) return null
  return props.periods.find(p => p.id === id) ?? null
}

function formatTimeLabel(p: PeriodOption | null): string {
  if (!p) return ""

  const start = p.start_time ?? ""
  const end = p.end_time ?? ""

  if (start && end) {
    const [rawSh, rawSm] = start.split(":")
    const [rawEh, rawEm] = end.split(":")

    const sh = rawSh ?? "00"
    const sm = rawSm ?? "00"
    const eh = rawEh ?? "00"
    const em = rawEm ?? "00"

    const format = (h: string, m: string) => {
      const hh = Number(h)
      if (isNaN(hh)) return ""
      const labelH = hh % 12 || 12
      const suffix = hh >= 12 ? "PM" : "AM"
      return `${labelH}:${m} ${suffix}`
    }

    // ⬇⬇ TS fix → explicit cast that format() receives guaranteed string
    return `${format(String(sh), String(sm))} – ${format(String(eh), String(em))}`
  }

  return p.label || ""
}




const summaryLabel = computed(() => {
  const day = dayItems.value.find(d => d.value === local.value.day)?.label ?? ""
  const startP = findPeriodById(local.value.period_start_id ?? null)
  const endP = findPeriodById(local.value.period_end_id ?? null)
  const timeText =
    startP && endP
      ? formatTimeLabel({
          ...startP,
          end_time: endP.end_time ?? startP.end_time ?? null
        })
      : ""

  const bits: string[] = []
  if (day) bits.push(day)
  if (timeText) bits.push(timeText)
  return bits.join(" · ")
})

// ---------- FILTERED OPTIONS ----------
const filteredClasses = computed(() => {
  // For now all classes are visible; role-based filter can be added if needed
  return props.classes
})

const filteredSubjects = computed(() => {
  if (!local.value.class_id) return []

  const cls = props.classes.find(c => c.id === local.value.class_id)
  if (!cls) return []

  const yearLevel = cls.year_level_number ?? cls.year_level ?? null
  const currentSem = props.currentTermSemester ?? null

  return props.subjects.filter((s: any) => {
    const sameYear =
      yearLevel == null ||
      s.year_level_number === yearLevel ||
      s.year_level === yearLevel

    const sameSem =
      currentSem == null ||
      s.semester === currentSem ||
      s.term === currentSem

    return sameYear && sameSem
  })
})

const filteredFaculty = computed(() => {
  // Here you could later filter by subject specialization, etc.
  return props.faculty
})

// ---------- VALIDATION ----------
const validationMessage = computed(() => {
  if (!local.value.class_id) return "Please select a class."
  if (!local.value.subject_id) return "Please select a subject."
  if (!local.value.day) return "Please select a day."
  if (!local.value.period_start_id || !local.value.period_end_id) {
    return "Please select both start and end time."
  }

  const startOrder = periodOrderMap.value.get(local.value.period_start_id)
  const endOrder = periodOrderMap.value.get(local.value.period_end_id)

  if (startOrder == null || endOrder == null) {
    return "Invalid time selection."
  }

  if (endOrder < startOrder) {
    return "End time must be after start time."
  }

  return ""
})

const isValid = computed(() => validationMessage.value === "")

// ---------- SNACKBAR ----------
const snackbar = ref({
  show: false,
  message: "",
  timeout: 6000
})

// ---------- WATCHERS ----------

// Sync local state from incoming payload
watch(
  () => props.payload,
  (val) => {
    const termId =
      props.currentTermSemester != null
        ? String(props.currentTermSemester)
        : null

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
        academic_term_id: termId
      }
    } else {
      local.value = {
        id: val.id ?? null,
        class_id: val.class_id ?? null,
        subject_id: val.subject_id ?? null,
        faculty_id: val.faculty_id ?? null,
        room_id: val.room_id ?? null,
        mode: val.mode ?? "F2F",
        day: val.day ?? null,
        period_start_id: val.period_start_id ?? null,
        period_end_id: val.period_end_id ?? null,
        academic_term_id: termId
      }
    }
  },
  { immediate: true }
)



// Smart autofill: when class changes → auto pick subject if only 1
watch(
  () => local.value.class_id,
  () => {
    // reset subject & faculty when class changes
    local.value.subject_id = null
    local.value.faculty_id = null

    const subs = filteredSubjects.value
    if (subs.length === 1) {
      local.value.subject_id = subs[0].id
    }
  }
)

// Smart autofill: when subject changes → try deduce teacher
watch(
  () => local.value.subject_id,
  (subjectId) => {
    if (!subjectId) {
      local.value.faculty_id = null
      return
    }

    // 1) Look for faculty with a custom mapping field (if your schema supports it)
    const specialized = props.faculty.find((f: any) => {
      if (Array.isArray(f.subject_ids)) {
        return f.subject_ids.includes(subjectId)
      }
      if (Array.isArray(f.specialization_subject_ids)) {
        return f.specialization_subject_ids.includes(subjectId)
      }
      return false
    })

    if (specialized) {
      local.value.faculty_id = specialized.id
      return
    }

    // 2) Fallback: if there is exactly one teacher, auto-select
    if (!local.value.faculty_id && props.faculty.length === 1) {
      local.value.faculty_id = props.faculty[0].id
    }
  }
)

// ---------- METHODS ----------
function handleSaveClick() {
  if (!isValid.value) {
    snackbar.value.message = validationMessage.value || "Please fix the form."
    snackbar.value.show = true
    return
  }

  saving.value = true
  try {
    emit("save", {
      ...(local.value as DrawerPayload),
      operation: props.mode
    })
    // Parent will actually call the API & handle conflicts.
  } finally {
    saving.value = false
  }
}

function close() {
  drawerModel.value = false
}
</script>

<style scoped>
/* (optional) You can add small tweaks here if needed */
</style>
