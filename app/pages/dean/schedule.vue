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
            style="min-width:220px"
          />
        </div>

        <!-- View -->
        <div class="d-flex align-center">
          <span class="font-weight-medium mr-2">View:</span>
          <v-btn-toggle v-model="viewMode" mandatory density="comfortable">
            <v-btn value="CLASS">Class</v-btn>
            <v-btn value="FACULTY">Faculty</v-btn>
            <v-btn value="ROOM">Room</v-btn>
          </v-btn-toggle>
        </div>

        <!-- Target -->
        <div class="d-flex align-center">
          <span class="font-weight-medium mr-2">{{ targetLabel }}:</span>

          <v-select
            v-if="viewMode === 'CLASS'"
            v-model="selectedClassId"
            :items="classOptions"
            item-title="label"
            item-value="value"
            clearable
            density="comfortable"
            variant="outlined"
            style="min-width:260px"
          />

          <v-select
            v-else-if="viewMode === 'FACULTY'"
            v-model="selectedFacultyId"
            :items="facultyOptions"
            item-title="label"
            item-value="value"
            clearable
            density="comfortable"
            variant="outlined"
            style="min-width:260px"
          />

          <v-select
            v-else
            v-model="selectedRoomId"
            :items="roomOptions"
            item-title="label"
            item-value="value"
            clearable
            density="comfortable"
            variant="outlined"
            style="min-width:220px"
          />
        </div>
      </div>
    </v-card>

    <!-- Require selection -->
    <v-alert
      v-if="requiresSelection"
      type="info"
      variant="tonal"
      border="start"
      class="mb-4"
    >
      Please select a {{ targetLabel.toLowerCase() }} to view the schedule.
    </v-alert>

    <!-- Calendar -->
    <ScheduleCalendar
      v-if="!requiresSelection"
      :days="days"
      :periods="periods"
      :events="calendarEvents"
      @create-range="handleCreateRange"
      @event-drop="handleUpdateEvent"
      @open-editor="handleOpenEditor"
    />

    <!-- Drawer -->
    <ScheduleDrawer
      v-model="drawerOpen"
      role="DEAN"
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
      :current-term-id="selectedTermId ?? null"
      @save="handleDrawerSave"
    />

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.show" location="bottom" :timeout="snackbar.timeout">
      {{ snackbar.message }}
      <template #actions>
        <v-btn variant="text" @click="snackbar.show = false">Close</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue"
import { useScheduleStore } from "@/stores/useScheduleStore"
import ScheduleCalendar from "@/components/schedule/ScheduleCalendar.vue"
import ScheduleDrawer from "@/components/schedule/ScheduleDrawer.vue"

definePageMeta({ layout: "dean" })

const { $supabase } = useNuxtApp()
const scheduleStore = useScheduleStore()

/* ---------------- STATE ---------------- */
const academicTerms = ref<any[]>([])
const selectedTermId = ref<string | null>(null)

const classes = ref<any[]>([])
const subjects = ref<any[]>([])
const classSubjects = ref<any[]>([])
const faculty = ref<any[]>([])
const rooms = ref<any[]>([])
const periods = ref<any[]>([])

const viewMode = ref<"CLASS" | "FACULTY" | "ROOM">("CLASS")
const selectedClassId = ref<string | null>(null)
const selectedFacultyId = ref<string | null>(null)
const selectedRoomId = ref<string | null>(null)

/* Drawer */
const drawerOpen = ref(false)
const drawerMode = ref<"CREATE" | "MOVE" | "RESIZE">("CREATE")
const drawerPayload = ref<any>(null)
const drawerLockDay = ref(false)
const drawerLockTime = ref(false)

/* Snackbar */
const snackbar = ref({
  show: false,
  message: "",
  timeout: 4000
})

/* ---------------- COMPUTED ---------------- */

/**
 * ✅ THIS IS THE MOST IMPORTANT FIX
 * Calendar now receives FULL event objects
 */
const calendarEvents = computed(() =>
  scheduleStore.sorted.map(s => ({
    id: s.id,
    day: s.day,
    startSlot: s.period_start?.slot_index ?? 0,
    endSlot: s.period_end?.slot_index ?? 0,
    mode: s.mode,

    // ✅ RESTORE NESTED OBJECTS (THIS FIXES EVERYTHING)
    subject: s.subject
      ? {
          course_code: s.subject.course_code,
          description: s.subject.description
        }
      : null,

    faculty: s.faculty
      ? {
          first_name: s.faculty.first_name,
          last_name: s.faculty.last_name
        }
      : null
  }))
)


const targetLabel = computed(() =>
  ({ CLASS: "Class", FACULTY: "Faculty", ROOM: "Room" }[viewMode.value])
)

const requiresSelection = computed(() => {
  if (viewMode.value === "CLASS") return !selectedClassId.value
  if (viewMode.value === "FACULTY") return !selectedFacultyId.value
  return !selectedRoomId.value
})

const days = [
  { value: "MON", label: "Mon" },
  { value: "TUE", label: "Tue" },
  { value: "WED", label: "Wed" },
  { value: "THU", label: "Thu" },
  { value: "FRI", label: "Fri" },
  { value: "SAT", label: "Sat" }
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
      label: `${c.class_name} ${c.year_level_label} - ${c.section}`
    }))
)

const facultyOptions = computed(() =>
  faculty.value.map((f: any) => ({
    value: f.id,
    label: `${f.last_name}, ${f.first_name}`
  }))
)

const roomOptions = computed(() =>
  rooms.value.map((r: any) => ({
    value: r.id,
    label: r.name
  }))
)

const currentTermSemester = computed(() => {
  const t = academicTerms.value.find(x => x.id === selectedTermId.value)
  return t?.semester ?? null
})

/* ---------------- LOADERS ---------------- */
async function loadAcademicTerms() {
  const { data } = await $supabase.from("academic_terms").select("*")
  academicTerms.value = data || []
  selectedTermId.value = academicTerms.value.find(t => t.is_active)?.id || null
}

async function loadLists() {
  const { data: { session } } = await $supabase.auth.getSession()
  const headers = { Authorization: `Bearer ${session?.access_token}` }

  classes.value = await $fetch("/api/classes/list", { headers })
  subjects.value = await $fetch("/api/subjects/list", { headers })
  classSubjects.value = await $fetch("/api/class-subjects/list", { headers })

  faculty.value = (await $supabase.from("faculty").select("*")).data || []
  rooms.value = (await $supabase.from("rooms").select("*")).data || []
  periods.value = (await $supabase.from("periods").select("*").order("slot_index")).data || []
}

async function loadSchedules() {
  if (requiresSelection.value || !selectedTermId.value) return

  const targetId =
    viewMode.value === "CLASS"
      ? selectedClassId.value
      : viewMode.value === "FACULTY"
      ? selectedFacultyId.value
      : selectedRoomId.value

  if (!targetId) return

  await scheduleStore.load(viewMode.value, targetId, selectedTermId.value)
}

/* ---------------- WATCHERS ---------------- */
watch(
  [viewMode, selectedClassId, selectedFacultyId, selectedRoomId, selectedTermId],
  loadSchedules
)

/* ---------------- CALENDAR HANDLERS ---------------- */
function attachView(base: any) {
  const payload = { ...base }
  if (viewMode.value === "CLASS") payload.class_id = selectedClassId.value
  if (viewMode.value === "FACULTY") payload.faculty_id = selectedFacultyId.value
  if (viewMode.value === "ROOM") payload.room_id = selectedRoomId.value
  payload.academic_term_id = selectedTermId.value
  return payload
}

function handleCreateRange(payload: any) {
  drawerMode.value = "CREATE"
  drawerPayload.value = attachView(payload)

  drawerLockDay.value = true
  drawerLockTime.value = true

  drawerOpen.value = true
}

function handleUpdateEvent(payload: any) {
  drawerMode.value = "RESIZE"
  drawerPayload.value = attachView(payload)
  drawerOpen.value = true
}

function handleOpenEditor({ id }: { id: string }) {
  const ev = scheduleStore.schedules.find(s => s.id === id)
  if (!ev) return

  drawerMode.value = "MOVE"
  drawerPayload.value = attachView(ev)

  // 🔒 RULES
  drawerLockDay.value = viewMode.value !== "CLASS"
  drawerLockTime.value = viewMode.value !== "CLASS"

  drawerOpen.value = true
}

/* ---------------- SAVE ---------------- */
function handleDrawerSave() {
  snackbar.value = {
    show: true,
    message: "Schedule saved successfully.",
    timeout: 3000
  }
  drawerOpen.value = false
}

/* ---------------- INIT ---------------- */
onMounted(async () => {
  await loadAcademicTerms()
  await loadLists()
  await loadSchedules()
})
</script>
