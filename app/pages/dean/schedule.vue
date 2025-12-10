<!-- app/pages/dean/schedule.vue -->
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
              @update:model-value="reloadSchedules"
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
              :placeholder="targetPlaceholder"
              hide-details
              style="min-width:260px"
              @update:model-value="reloadSchedules"
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
              :placeholder="targetPlaceholder"
              hide-details
              style="min-width:220px"
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
      :loading="loading"
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
      :faculty="faculty"
      :periods="periods"
      :rooms="rooms"
      :days="days"
      :lock-day="drawerLockDay"
      :lock-time="drawerLockTime"
      :current-term-semester="selectedTermId"
      @save="handleDrawerSave"
    />

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.show" location="bottom" :timeout="snackbar.timeout">
      {{ snackbar.message }}

      <template #actions>
        <v-btn v-if="snackbar.canUndo" variant="text" @click="handleUndo">UNDO</v-btn>
        <v-btn variant="text" @click="snackbar.show = false">Close</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import ScheduleCalendar from "~/components/schedule/ScheduleCalendar.vue"
import ScheduleDrawer from "~/components/schedule/ScheduleDrawer.vue"

definePageMeta({ layout: "dean" })
const { $supabase } = useNuxtApp()

/* ------------------------ STATE ------------------------ */
const loading = ref(false)
const saving = ref(false)

const academicTerms = ref<any[]>([])
const selectedTermId = ref<string | null>(null)

const classes = ref<any[]>([])
const faculty = ref<any[]>([])
const rooms = ref<any[]>([])
const subjects = ref<any[]>([])
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

/* ------------------------ COMPUTED ------------------------ */

const targetLabel = computed(() => ({
  CLASS: "Class",
  FACULTY: "Faculty",
  ROOM: "Room"
}[viewMode.value]))

const targetPlaceholder = computed(() => ({
  CLASS: "Select Class",
  FACULTY: "Select Faculty",
  ROOM: "Select Room"
}[viewMode.value]))

/* Require selection before showing calendar */
const requiresSelection = computed(() => {
  if (viewMode.value === "CLASS") return !selectedClassId.value
  if (viewMode.value === "FACULTY") return !selectedFacultyId.value
  return !selectedRoomId.value
})

const days = [
  { value: "MON", label: "Mon" }, { value: "TUE", label: "Tue" },
  { value: "WED", label: "Wed" }, { value: "THU", label: "Thu" },
  { value: "FRI", label: "Fri" }, { value: "SAT", label: "Sat" }
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
    .sort((a, b) => a.label.localeCompare(b.label))
)



const facultyOptions = computed(() =>
  faculty.value.map(f => ({ value: f.id, label: `${f.last_name}, ${f.first_name}` }))
)

const roomOptions = computed(() =>
  rooms.value.map(r => ({ value: r.id, label: r.name }))
)

/* ------------------------ LOADERS ------------------------ */

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

  faculty.value = (await $supabase.from("faculty").select("*")).data || []
  rooms.value = (await $supabase.from("rooms").select("*")).data || []
  periods.value = (await $supabase.from("periods").select("*").order("slot_index")).data || []
}

async function loadSchedules() {
  if (requiresSelection.value || !selectedTermId.value) return

  const { data: { session } } = await $supabase.auth.getSession()
  const headers = { Authorization: `Bearer ${session?.access_token}` }

  let target_id =
    viewMode.value === "CLASS" ? selectedClassId.value :
    viewMode.value === "FACULTY" ? selectedFacultyId.value :
    selectedRoomId.value

  const res = await $fetch("/api/schedules/list", {
    headers,
    query: { view: viewMode.value, target_id, academic_term_id: selectedTermId.value }
  })

events.value = (res as any[]).map((s: any) => ({
  ...s,
  startSlot: s?.period_start?.slot_index ?? 0,
  endSlot: s?.period_end?.slot_index ?? 0,
  label: `${s?.subject?.course_code || ""} – ${s?.subject?.description || ""}`
}))

}

async function reloadSchedules() {
  await loadSchedules()
}

/* ------------------------ CALENDAR HANDLERS ------------------------ */

function handleCreateRange(payload: any) {
  drawerMode.value = "CREATE"
  drawerPayload.value = payload
  drawerLockDay.value = true
  drawerLockTime.value = true
  drawerOpen.value = true
}

function handleUpdateEvent(payload: any) {
  drawerMode.value = "RESIZE"
  drawerPayload.value = payload
  drawerOpen.value = true
}

function handleOpenEditor({ id }: { id: string }) {
  drawerMode.value = "MOVE"
  drawerPayload.value = events.value.find(e => e.id === id)
  drawerOpen.value = true
}

/* ------------------------ SAVE & UNDO ------------------------ */

async function handleDrawerSave(payload: any) {
  const { data: { session } } = await $supabase.auth.getSession()

  await $fetch("/api/schedules/save", {
    method: "POST",
    headers: { Authorization: `Bearer ${session?.access_token}` },
    body: payload
  })

  snackbar.value = {
    show: true,
    message: payload.operation === "CREATE" ? "Schedule added." :
      payload.operation === "MOVE" ? "Schedule moved." : "Updated.",
    canUndo: false,
    undoId: null,
    timeout: 5000
  }

  drawerOpen.value = false
  await loadSchedules()
}

async function handleUndo() {
  if (!snackbar.value.undoId) return

  const { data: { session } } = await $supabase.auth.getSession()
  await $fetch("/api/schedules/undo", {
    method: "POST",
    headers: { Authorization: `Bearer ${session?.access_token}` },
    body: { id: snackbar.value.undoId }
  })

  snackbar.value.show = false
  await loadSchedules()
}

/* ------------------------ INIT ------------------------ */
onMounted(async () => {
  await loadAcademicTerms()
  await loadLists()
  await loadSchedules()
})
</script>
