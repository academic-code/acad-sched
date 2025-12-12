<template>
  <div>
    <h1 class="text-h5 font-weight-bold mb-4">Schedule</h1>

    <!-- Toolbar -->
    <v-card class="mb-4 pa-3">
      <div class="d-flex flex-wrap gap-3 align-center justify-space-between">
        <!-- Term -->
        <div class="d-flex align-center">
          <span class="font-weight-medium mr-2">Term:</span>
          <v-select
            v-model="selectedTermId"
            :items="termOptions"
            item-title="label"
            item-value="value"
            density="comfortable"
            variant="outlined"
            hide-details
            style="min-width: 220px"
            :loading="loadingTerms"
            @update:model-value="reloadSchedules"
          />
        </div>

        <!-- View Toggle -->
        <div class="d-flex align-center">
          <span class="font-weight-medium mr-2">View:</span>
          <v-btn-toggle v-model="viewMode" density="comfortable" mandatory>
            <v-btn value="CLASS">Class</v-btn>
            <v-btn value="FACULTY">Faculty</v-btn>
            <v-btn value="ROOM">Room</v-btn>
          </v-btn-toggle>
        </div>

        <!-- Target Selection -->
        <div class="d-flex align-center">
          <span class="font-weight-medium mr-2">{{ targetLabel }}:</span>

          <!-- Class view -->
          <v-select
            v-if="viewMode === 'CLASS'"
            v-model="selectedClassId"
            :items="classOptions"
            item-title="label"
            item-value="value"
            clearable
            density="comfortable"
            variant="outlined"
            :placeholder="targetPlaceholder"
            hide-details
            style="min-width:260px"
            :loading="loadingLists"
            @update:model-value="reloadSchedules"
          />

          <!-- Faculty view -->
          <v-select
            v-else-if="viewMode === 'FACULTY'"
            v-model="selectedFacultyId"
            :items="facultyOptions"
            item-title="label"
            item-value="value"
            clearable
            density="comfortable"
            variant="outlined"
            :placeholder="targetPlaceholder"
            hide-details
            style="min-width:260px"
            :loading="loadingLists"
            @update:model-value="reloadSchedules"
          />

          <!-- Room view -->
          <v-select
            v-else
            v-model="selectedRoomId"
            :items="roomOptions"
            item-title="label"
            item-value="value"
            clearable
            density="comfortable"
            variant="outlined"
            :placeholder="targetPlaceholder"
            hide-details
            style="min-width:220px"
            :loading="loadingLists"
            @update:model-value="reloadSchedules"
          />
        </div>
      </div>
    </v-card>

    <!-- Require selection message -->
    <v-alert
      v-if="requiresSelection"
      type="info"
      variant="tonal"
      class="mb-4"
      border="start"
    >
      Please select a {{ targetLabel.toLowerCase() }} to view the schedule.
    </v-alert>

    <!-- Calendar -->
    <ScheduleCalendar
      v-if="!requiresSelection"
      :days="days"
      :periods="periods"
      :events="events"
      @create-range="handleCreateRange"
      @event-drop="handleUpdateEvent"
      @open-editor="handleOpenEditor"
    />

    <!-- Drawer -->
    <ScheduleDrawer
      v-model="drawerOpen"
      :role="'DEAN'"
      :mode="drawerMode"
      :payload="drawerPayload"
      :classes="classes"
      :subjects="subjects"
      :class-subjects="classSubjects"
      :faculty="faculty"
      :periods="periods"
      :rooms="rooms"
      :days="days"
      :lock-day="drawerLockDay"
      :lock-time="drawerLockTime"
      :current-term-semester="currentTermSemester"
      :current-term-id="selectedTermIdSafe"
      @save="handleDrawerSave"
    />

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.show" location="bottom" :timeout="snackbar.timeout">
      {{ snackbar.message }}

      <template #actions>
        <v-btn v-if="snackbar.canUndo && snackbar.undoId" variant="text" @click="handleUndo">UNDO</v-btn>
        <v-btn variant="text" @click="snackbar.show = false">Close</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import ScheduleCalendar from "~/components/schedule/ScheduleCalendar.vue"
import ScheduleDrawer from "~/components/schedule/ScheduleDrawer.vue"
import { useScheduleStore } from "@/stores/useScheduleStore"

definePageMeta({ layout: "dean" })

const scheduleStore = useScheduleStore()
const { $supabase } = useNuxtApp()

/* ------------------------ STATE ------------------------ */

const loading = ref(false)
const loadingTerms = ref(false)
const loadingLists = ref(false)
const saving = ref(false)

const academicTerms = ref<any[]>([])
const selectedTermId = ref<string | null>(null)

const classes = ref<any[]>([])
const subjects = ref<any[]>([])
const classSubjects = ref<any[]>([])
const faculty = ref<any[]>([])
const rooms = ref<any[]>([])
const periods = ref<any[]>([])
const events = ref<any[]>([])

const viewMode = ref<"CLASS" | "FACULTY" | "ROOM">("CLASS")
const selectedClassId = ref<string | null>(null)
const selectedFacultyId = ref<string | null>(null)
const selectedRoomId = ref<string | null>(null)

/* Drawer */
const drawerOpen = ref(false)
const drawerMode = ref<"CREATE" | "MOVE" | "RESIZE">("CREATE")
const drawerPayload = ref<any | null>(null)
const drawerLockDay = ref(false)
const drawerLockTime = ref(false)

/* Snackbar */
const snackbar = ref({
  show: false,
  message: "",
  canUndo: false,
  undoId: null as string | null,
  timeout: 6000
})

const selectedTermIdSafe = computed<string | undefined>(() =>
  selectedTermId.value ?? undefined
)

/* ------------------------ HELPERS ------------------------ */

function formatTime12h(time?: string | null) {
  if (!time) return ""
  const [h, m = "00"] = time.split(":")
  const hour = Number(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`
}

/* ------------------------ COMPUTED ------------------------ */

const targetLabel = computed(() =>
  ({ CLASS: "Class", FACULTY: "Faculty", ROOM: "Room" } as const)[viewMode.value]
)

const targetPlaceholder = computed(() =>
  ({ CLASS: "Select Class", FACULTY: "Select Faculty", ROOM: "Select Room" } as const)[viewMode.value]
)

const requiresSelection = computed(() => {
  if (viewMode.value === "CLASS") return !selectedClassId.value
  if (viewMode.value === "FACULTY") return !selectedFacultyId.value
  return !selectedRoomId.value
})

const days = [
  { value: "MONDAY", label: "Mon" },
  { value: "TUESDAY", label: "Tue" },
  { value: "WEDNESDAY", label: "Wed" },
  { value: "THURSDAY", label: "Thu" },
  { value: "FRIDAY", label: "Fri" },
  { value: "SATURDAY", label: "Sat" }
]

const termOptions = computed(() =>
  academicTerms.value.map(t => ({
    value: t.id,
    label: `${t.academic_year} - ${t.semester}${t.is_active ? " ⭐" : ""}`
  }))
)

const classOptions = computed(() =>
  classes.value
    .filter(c => c.academic_term_id === selectedTermId.value)
    .map(c => ({
      value: c.id,
      label: `${c.class_name} ${c.year_level_label ?? ""} - ${c.section ?? ""}`.trim()
    }))
)

const facultyOptions = computed(() =>
  faculty.value.map(f => ({
    value: f.id,
    label: `${f.last_name ?? ""}, ${f.first_name ?? ""}`
  }))
)

const roomOptions = computed(() =>
  rooms.value.map(r => ({ value: r.id, label: r.name ?? "" }))
)

const currentTermSemester = computed(() => {
  return academicTerms.value.find(t => t.id === selectedTermId.value)?.semester ?? null
})

/* ------------------------ LOADERS ------------------------ */

async function loadAcademicTerms() {
  loadingTerms.value = true
  try {
    const { data } = await $supabase.from("academic_terms").select("*")
    academicTerms.value = data ?? []
    selectedTermId.value =
      academicTerms.value.find(t => t.is_active)?.id ??
      academicTerms.value[0]?.id ??
      null
  } finally {
    loadingTerms.value = false
  }
}

async function loadLists() {
  loadingLists.value = true
  try {
    const { data: { session } } = await $supabase.auth.getSession()
    const headers = { Authorization: `Bearer ${session?.access_token}` }

    const cls = await $fetch("/api/classes/list", { headers })
    classes.value = Array.isArray(cls) ? cls : cls?.data ?? []

    const subj = await $fetch("/api/subjects/list", { headers })
    subjects.value = Array.isArray(subj) ? subj : subj?.data ?? []

    const cs = await $fetch("/api/class-subjects/list", { headers })
    classSubjects.value = Array.isArray(cs) ? cs : cs?.data ?? []

    faculty.value = (await $supabase.from("faculty").select("*")).data ?? []
    rooms.value = (await $supabase.from("rooms").select("*")).data ?? []

    const p = (await $supabase.from("periods").select("*").order("slot_index")).data ?? []
    periods.value = p.map(r => ({
      id: String(r.id),
      start_time: r.start_time ?? "",
      end_time: r.end_time ?? "",
      slot_index: r.slot_index ?? 0,
      label: `${formatTime12h(r.start_time)} - ${formatTime12h(r.end_time)}`
    }))
  } finally {
    loadingLists.value = false
  }
}

async function loadSchedules() {
  if (requiresSelection.value || !selectedTermId.value) {
    events.value = []
    return
  }

  const target_id =
    viewMode.value === "CLASS"
      ? selectedClassId.value
      : viewMode.value === "FACULTY"
      ? selectedFacultyId.value
      : selectedRoomId.value

  if (!target_id) {
    events.value = []
    return
  }

  loading.value = true
  try {
    await scheduleStore.load(viewMode.value, target_id, selectedTermId.value)
    const raw = scheduleStore.schedules ?? []

    events.value = raw.map(s => ({
      ...s,
      day: s.day,
      startSlot: s?.period_start?.slot_index ?? 0,
      endSlot: s?.period_end?.slot_index ?? 0,
      label: `${s?.subject?.course_code ?? ""} — ${s?.subject?.description ?? ""}`,
      mode: s?.mode
    }))
  } finally {
    loading.value = false
  }
}

async function reloadSchedules() {
  await loadSchedules()
}

/* ------------------------ HANDLERS ------------------------ */

function attachView(payload: any) {
  const base = { ...(payload ?? {}) }
  if (viewMode.value === "CLASS") base.class_id = selectedClassId.value
  if (viewMode.value === "FACULTY") base.faculty_id = selectedFacultyId.value
  if (viewMode.value === "ROOM") base.room_id = selectedRoomId.value
  base.academic_term_id = selectedTermId.value ?? undefined
  return base
}

function handleCreateRange(payload: any) {
  drawerMode.value = "CREATE"
  drawerPayload.value = attachView(payload)
  drawerLockDay.value = true
  drawerLockTime.value = true
  drawerOpen.value = true
}

function handleUpdateEvent(payload: any) {
  drawerMode.value =
    payload?.mode === "CREATE" || payload?.mode === "MOVE" || payload?.mode === "RESIZE"
      ? payload.mode
      : "RESIZE"

  drawerPayload.value = attachView(payload)
  drawerLockDay.value = false
  drawerLockTime.value = false
  drawerOpen.value = true
}

function handleOpenEditor({ id }: { id: string }) {
  const ev = events.value.find(e => String(e.id) === String(id))
  if (!ev) return

  drawerMode.value =
    ev.mode === "CREATE" || ev.mode === "MOVE" || ev.mode === "RESIZE"
      ? ev.mode
      : "MOVE"

  drawerPayload.value = attachView(ev)
  drawerLockDay.value = false
  drawerLockTime.value = false
  drawerOpen.value = true
}

/* ------------------------ SAVE & UNDO ------------------------ */

async function handleDrawerSave(payload: any) {
  saving.value = true
  try {
    const res: any = await scheduleStore.saveSchedule(payload)
    snackbar.value = {
      show: true,
      message:
        drawerMode.value === "CREATE"
          ? "Schedule added."
          : drawerMode.value === "MOVE"
          ? "Schedule moved."
          : "Schedule updated.",
      canUndo: !!res?.undo_id,
      undoId: res?.undo_id ?? null,
      timeout: 8000
    }

    drawerOpen.value = false
    drawerPayload.value = null
    drawerMode.value = "CREATE"
    drawerLockDay.value = false
    drawerLockTime.value = false

    await loadSchedules()
  } catch (err: any) {
    snackbar.value = {
      show: true,
      message: err?.data?.message ?? err?.message ?? "Error saving schedule.",
      canUndo: false,
      undoId: null,
      timeout: 9000
    }
  } finally {
    saving.value = false
  }
}

async function handleUndo() {
  if (!snackbar.value.undoId) return

  try {
    await scheduleStore.undoSchedule(snackbar.value.undoId)
    snackbar.value.show = false
    await loadSchedules()
  } catch (err) {
    snackbar.value = {
      show: true,
      message: "Failed to undo.",
      canUndo: false,
      undoId: null,
      timeout: 8000
    }
  }
}

/* ------------------------ INIT ------------------------ */

onMounted(async () => {
  await loadAcademicTerms()
  await loadLists()
  await loadSchedules()
})
</script>


