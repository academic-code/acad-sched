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

      <!-- Room (DISABLED for ONLINE + ASYNC) -->
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
          :disabled="!isValid || saving"
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
import { useScheduleStore } from "@/stores/useScheduleStore"   // <-- ensures connection to store & API composable

//
// Types
//
interface ClassItem {
  id: string;
  class_name: string;
  year_level_number: number;
  year_level_label: string;
  section: string;
}

interface SubjectItem {
  id: string;
  course_code: string;
  description: string;
  year_level_number: number;
  semester: string;
  is_gened?: boolean;
}

interface PeriodItem {
  id: string;
  label?: string;
  slot_index?: number;
  start_time?: string;
  end_time?: string;
}

//
// Props
//
const props = defineProps<{
  modelValue?: boolean;
  role?: "ADMIN" | "DEAN" | "GENED" | "FACULTY";
  mode?: "CREATE" | "MOVE" | "RESIZE";
  payload?: any;
  classes?: ClassItem[];
  subjects?: SubjectItem[];
  classSubjects?: { class_id: string; subject_id: string; academic_term_id: string }[];
  faculty?: any[];
  periods?: PeriodItem[];
  rooms?: any[];
  days?: any[];
  lockDay?: boolean;
  lockTime?: boolean;
  currentTermSemester?: string | null;
  currentTermId?: string | null;
}>()

const emit = defineEmits(["update:modelValue", "save"])

//
// Pinia store (uses your composable useSchedules internally)
//
const scheduleStore = useScheduleStore()

//
// Local model
//
interface LocalModel {
  id: string | null;
  class_id: string | null;
  subject_id: string | null;
  faculty_id: string | null;
  room_id: string | null;
  mode: string;
  day: string | null;
  period_start_id: string | null;
  period_end_id: string | null;
  academic_term_id: string | null;
}

const local = ref<LocalModel>({
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
})

//
// Safe lists
//
const classesSafe = computed(() => props.classes ?? [])
const subjectsSafe = computed(() => props.subjects ?? [])
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
// Labels
//
const classLabel = (c: unknown) => {
  const cc = c as ClassItem | undefined
  if (!cc) return ""
  return `${cc.class_name} ${cc.year_level_label} - ${cc.section}`
}
const subjectLabel = (s: unknown) => {
  const ss = s as SubjectItem | undefined
  return ss ? `${ss.course_code} — ${ss.description}` : ""
}
const periodLabel = (p: unknown) => {
  const pp = p as PeriodItem | undefined
  if (!pp) return ""
  return pp.label ?? `${pp.start_time ?? ""} - ${pp.end_time ?? ""}`
}
const dayLabel = (d: unknown) => {
  const dd = d as any
  return dd?.label ?? ""
}

//
// Mode selector
//
const modeItems = [
  { value: "F2F", label: "Face to Face" },
  { value: "ONLINE", label: "Online" },
  { value: "ASYNC", label: "Asynchronous" }
]
const modeLabel = (m: any) => m?.label ?? m?.value

//
// Faculty (computed name)
///
const facultyList = computed(() =>
  (facultySafe.value as any[]).map((f: any) => ({
    ...f,
    full_name: `${f.last_name}, ${f.first_name}`
  }))
)

//
// ROOM VALIDATION RULE
//
const roomDisabled = computed(() => local.value.mode !== "F2F")

// Auto-clear room when switching out of F2F
watch(
  () => local.value.mode,
  (newMode) => {
    if (newMode !== "F2F") {
      local.value.room_id = null
    }
  }
)

//
// Filter subjects
//
const filteredSubjects = computed(() => {
  if (!local.value.class_id) return []

  const cls = classesSafe.value.find(c => c.id === local.value.class_id)
  if (!cls) return []

  const classYear = cls.year_level_number
  const termSemester = props.currentTermSemester

  let eligible = subjectsSafe.value.filter(s =>
    s.year_level_number === classYear &&
    s.semester === termSemester
  )

  const overrideIds = (props.classSubjects ?? [])
    .filter(cs => cs.class_id === cls.id && cs.academic_term_id === props.currentTermId)
    .map(cs => cs.subject_id)

  const overrideSubs = subjectsSafe.value.filter(s => overrideIds.includes(s.id))

  const combined = [...eligible, ...overrideSubs]
  return combined.filter((v, i, arr) => arr.findIndex(x => x.id === v.id) === i)
})

//
// Titles
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
// Validation — includes room validation
//
const validationMessage = computed(() => {
  if (!local.value.class_id) return "Please select a class."
  if (!local.value.subject_id) return "Please select a subject."
  if (!local.value.day) return "Please select a day."

  const start = periodsSafe.value.find(p => p.id === local.value.period_start_id)
  const end = periodsSafe.value.find(p => p.id === local.value.period_end_id)
  if (!start || !end) return "Please select start and end time."
  if ((start.slot_index ?? 0) > (end.slot_index ?? 0))
    return "End time must be after start time."

  // ROOM VALIDATION
  if (local.value.mode !== "F2F" && local.value.room_id)
    return "Rooms are only allowed for Face-to-Face mode."

  return ""
})

const isValid = computed(() => validationMessage.value === "")

//
// Payload watcher (alignment with B3–B5)
//
watch(
  () => props.payload,
  (val) => {
    const preservedDay = local.value.day
    const preservedStart = local.value.period_start_id
    const preservedEnd = local.value.period_end_id

    if (!val) {
      local.value = {
        id: null,
        class_id: null,
        subject_id: null,
        faculty_id: null,
        room_id: null,
        mode: "F2F",
        day: preservedDay ?? null,
        period_start_id: preservedStart ?? null,
        period_end_id: preservedEnd ?? null,
        academic_term_id: props.currentTermId ?? null
      }
      return
    }

    const startId =
      val.period_start_id ??
      val.period_start?.id ??
      (typeof val.startSlot === "number"
        ? periodsSafe.value.find(p => p.slot_index === val.startSlot)?.id
        : null)

    const endId =
      val.period_end_id ??
      val.period_end?.id ??
      (typeof val.endSlot === "number"
        ? periodsSafe.value.find(p => p.slot_index === val.endSlot)?.id
        : null)

    local.value = {
      id: val.id ?? null,
      class_id: val.class_id ?? val.class ?? null,
      subject_id: val.subject_id ?? null,
      faculty_id: val.faculty_id ?? null,
      room_id: (val.mode === "F2F" ? (val.room_id ?? null) : null),
      mode: val.mode ?? "F2F",
      day: val.day ?? preservedDay ?? null,
      period_start_id: startId ?? preservedStart ?? null,
      period_end_id: endId ?? preservedEnd ?? null,
      academic_term_id: props.currentTermId ?? val.academic_term_id ?? null
    }

    if (local.value.mode !== "F2F") {
      local.value.room_id = null
    }
  },
  { immediate: true }
)

//
// Auto-reset subject when class changes
//
watch(
  () => local.value.class_id,
  () => {
    local.value.subject_id = null
    const subs = filteredSubjects.value
    if (subs.length === 1) local.value.subject_id = subs[0]?.id ?? null
  }
)

//
// Remove subject if no longer valid
//
watch(
  () => filteredSubjects.value.map(s => s.id).join(","),
  () => {
    if (
      local.value.subject_id &&
      !filteredSubjects.value.some(s => s.id === local.value.subject_id)
    ) {
      local.value.subject_id = null
    }
  }
)

//
// Save — uses scheduleStore (which calls useSchedules) and keeps backward emit("save", ...)
//
const saving = ref(false)
const snackbar = ref({ show: false, message: "", timeout: 6000 })

async function handleSaveClick() {
  if (!isValid.value) {
    snackbar.value = { show: true, message: validationMessage.value, timeout: 5000 }
    return
  }

  saving.value = true
  try {
    // Build payload exactly as endpoints expect
    const payload: any = {
      id: local.value.id ?? undefined,
      class_id: local.value.class_id,
      subject_id: local.value.subject_id,
      faculty_id: local.value.faculty_id ?? null,
      room_id: local.value.mode === "F2F" ? (local.value.room_id ?? null) : null,
      day: local.value.day,
      period_start_id: local.value.period_start_id,
      period_end_id: local.value.period_end_id,
      academic_term_id: local.value.academic_term_id,
      mode: local.value.mode,
      force: false // default — UI can extend to allow force later
    }

    // Use the store (which wraps API composable). Save handles create/update.
    const res: any = await scheduleStore.saveSchedule(payload)

    // Emit for parent compatibility (keeps existing event-driven logic)
    emit("save", res)

    // refresh current view list (store action already reloads in its internal calls)
    if (scheduleStore.view && scheduleStore.target_id && scheduleStore.academic_term_id) {
      await scheduleStore.load(scheduleStore.view, scheduleStore.target_id, scheduleStore.academic_term_id)
    }

    snackbar.value = { show: true, message: "Saved successfully.", timeout: 3000 }
    // close after small delay so user sees snackbar
    setTimeout(() => {
      close()
    }, 300)
  } catch (err: any) {
    // Grab message if available
    const msg = err?.message ?? (err?.data?.message) ?? "Save failed."
    snackbar.value = { show: true, message: msg, timeout: 6000 }
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
  get: () => !!props.modelValue,
  set: (v: boolean) => emit("update:modelValue", v)
})
</script>

<style scoped>
.v-navigation-drawer .v-card {
  min-height: 100%;
}
</style>
