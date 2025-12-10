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

        <!-- View toggle -->
        <div class="d-flex align-center">
          <span class="font-weight-medium mr-2">View:</span>
          <v-btn-toggle
            v-model="viewMode"
            density="comfortable"
            mandatory
          >
            <v-btn value="CLASS">Class</v-btn>
            <v-btn value="FACULTY">Faculty</v-btn>
            <v-btn value="ROOM">Room</v-btn>
          </v-btn-toggle>
        </div>

        <!-- Target selector (class / faculty / room) -->
        <div class="d-flex align-center">
          <span class="font-weight-medium mr-2">
            {{ targetLabel }}:
          </span>

          <v-select
            v-if="viewMode === 'CLASS'"
            v-model="selectedClassId"
            :items="classOptions"
            item-title="label"
            item-value="value"
            density="comfortable"
            variant="outlined"
            hide-details
            style="min-width: 260px"
            @update:model-value="reloadSchedules"
          />

          <v-select
            v-else-if="viewMode === 'FACULTY'"
            v-model="selectedFacultyId"
            :items="facultyOptions"
            item-title="label"
            item-value="value"
            density="comfortable"
            variant="outlined"
            hide-details
            style="min-width: 260px"
            @update:model-value="reloadSchedules"
          />

          <v-select
            v-else
            v-model="selectedRoomId"
            :items="roomOptions"
            item-title="label"
            item-value="value"
            density="comfortable"
            variant="outlined"
            hide-details
            style="min-width: 220px"
            @update:model-value="reloadSchedules"
          />
        </div>
      </div>
    </v-card>

    <!-- Calendar -->
    <v-card>
      <ScheduleCalendar
        :loading="loading"
        :days="days"
        :periods="periods"
        :events="events"
        @create-range="handleCreateRange"
        @event-click="handleEventClick"
      />
    </v-card>

    <!-- Simple Schedule Drawer (create/edit) -->
    <v-navigation-drawer
      v-model="drawerOpen"
      location="right"
      temporary
      width="420"
    >
      <v-card flat class="pa-4">
        <div class="d-flex justify-space-between align-center mb-3">
          <h3 class="text-h6 font-weight-medium">
            {{ editingEvent ? "Edit Schedule" : "Create Schedule" }}
          </h3>
          <v-btn icon variant="text" @click="drawerOpen = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </div>

        <v-alert
          v-if="isGenEdDean && form.subject_is_major"
          type="warning"
          border="start"
          class="mb-3"
        >
          GenEd dean can only manage GenEd subjects.
        </v-alert>

        <!-- Class (readonly in CLASS view, selectable in others) -->
        <v-select
          v-if="viewMode !== 'CLASS'"
          v-model="form.class_id"
          :items="classOptions"
          label="Class"
          item-title="label"
          item-value="value"
          density="comfortable"
          variant="outlined"
          class="mb-3"
        />
        <v-text-field
          v-else
          label="Class"
          :model-value="currentClassLabel"
          variant="outlined"
          density="comfortable"
          class="mb-3"
          readonly
        />

        <!-- Subject -->
        <v-select
          v-model="form.subject_id"
          :items="subjectOptions"
          label="Subject"
          item-title="label"
          item-value="value"
          density="comfortable"
          variant="outlined"
          class="mb-3"
        />

        <!-- Faculty -->
        <v-select
          v-model="form.faculty_id"
          :items="facultyOptions"
          label="Faculty (optional)"
          item-title="label"
          item-value="value"
          density="comfortable"
          variant="outlined"
          class="mb-3"
          clearable
        />

        <!-- Room -->
        <v-select
          v-model="form.room_id"
          :items="roomOptions"
          label="Room (optional)"
          item-title="label"
          item-value="value"
          density="comfortable"
          variant="outlined"
          class="mb-3"
          clearable
        />

        <!-- Mode -->
        <v-select
          v-model="form.mode"
          :items="modeOptions"
          label="Mode"
          density="comfortable"
          variant="outlined"
          class="mb-3"
        />

        <!-- Day -->
        <v-select
          v-model="form.day"
          :items="days"
          label="Day"
          item-title="label"
          item-value="value"
          density="comfortable"
          variant="outlined"
          class="mb-3"
        />

        <!-- Time Range -->
        <v-row>
          <v-col cols="6">
            <v-select
              v-model="form.period_start_id"
              :items="periodOptions"
              label="Start"
              item-title="label"
              item-value="value"
              density="comfortable"
              variant="outlined"
            />
          </v-col>
          <v-col cols="6">
            <v-select
              v-model="form.period_end_id"
              :items="periodOptions"
              label="End"
              item-title="label"
              item-value="value"
              density="comfortable"
              variant="outlined"
            />
          </v-col>
        </v-row>

        <div class="text-right mt-4">
          <v-btn variant="text" class="mr-2" @click="drawerOpen = false">
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            :loading="saving"
            @click="saveSchedule(false)"
          >
            Save
          </v-btn>
        </div>
      </v-card>
    </v-navigation-drawer>

    <!-- Bottom-center toast for conflicts / undo -->
    <v-snackbar
      v-model="snackbar.show"
      location="bottom"
      :timeout="snackbar.timeout"
    >
      {{ snackbar.message }}
      <template #actions>
        <v-btn
          v-if="snackbar.canUndo && snackbar.undoId"
          variant="text"
          @click="handleUndo"
        >
          UNDO
        </v-btn>
        <v-btn variant="text" @click="snackbar.show = false">
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import ScheduleCalendar from "~/components/schedule/ScheduleCalendar.vue"
import type { Ref } from "vue"

definePageMeta({ layout: "dean" })

const { $supabase } = useNuxtApp()

/* ---------- STATE ---------- */

const loading = ref(false)
const saving = ref(false)

const isGenEdDean = ref(false)
const deanDepartmentId = ref<string | null>(null)

const academicTerms = ref<any[]>([])
const selectedTermId = ref<string | null>(null)

const periods = ref<any[]>([])
const classes = ref<any[]>([])
const faculty = ref<any[]>([])
const rooms = ref<any[]>([])
const subjects = ref<any[]>([])

const events: Ref<any[]> = ref([])

const viewMode = ref<"CLASS" | "FACULTY" | "ROOM">("CLASS")
const selectedClassId = ref<string | null>(null)
const selectedFacultyId = ref<string | null>(null)
const selectedRoomId = ref<string | null>(null)

/* Drawer + form */
const drawerOpen = ref(false)
const editingEvent = ref<any | null>(null)
const form = ref<any>({
  class_id: null,
  subject_id: null,
  faculty_id: null,
  room_id: null,
  mode: "F2F",
  day: "MON",
  period_start_id: null,
  period_end_id: null,
  subject_is_major: false
})

/* Snackbar */
const snackbar = ref<{
  show: boolean
  message: string
  canUndo: boolean
  undoId: string | null
  timeout: number
}>({
  show: false,
  message: "",
  canUndo: false,
  undoId: null,
  timeout: 10000
})

/* ---------- CONSTANTS ---------- */

const days = [
  { value: "MON", label: "Mon" },
  { value: "TUE", label: "Tue" },
  { value: "WED", label: "Wed" },
  { value: "THU", label: "Thu" },
  { value: "FRI", label: "Fri" },
  { value: "SAT", label: "Sat" }
]

const modeOptions = [
  { value: "F2F", title: "Face to Face" },
  { value: "ONLINE", title: "Online" },
  { value: "ASYNC", title: "Asynchronous" }
]

/* ---------- COMPUTED ---------- */

const termOptions = computed(() =>
  academicTerms.value.map((t: any) => ({
    value: t.id,
    label: `${t.academic_year} - ${t.semester}${t.is_active ? " ⭐" : ""}`
  }))
)

const classOptions = computed(() =>
  classes.value
    .filter(c => c.academic_term_id === selectedTermId.value)
    .map(c => ({
      value: c.id,
      label: `${c.program_name} ${c.year_level_label} ${c.section} – ${c.class_name}`
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

const periodOptions = computed(() =>
  periods.value.map((p: any) => ({
    value: p.id,
    label: `${p.start_time?.slice(0, 5)} - ${p.end_time?.slice(0, 5)}`
  }))
)

const subjectOptions = computed(() =>
  subjects.value.map((s: any) => ({
    value: s.id,
    label: `${s.course_code} — ${s.description}`,
    is_gened: s.is_gened
  }))
)

const targetLabel = computed(() => {
  if (viewMode.value === "CLASS") return "Class"
  if (viewMode.value === "FACULTY") return "Faculty"
  return "Room"
})

const currentClassLabel = computed(() => {
  if (!selectedClassId.value) return ""
  const found = classOptions.value.find(c => c.value === selectedClassId.value)
  return found?.label || ""
})

/* ---------- LOADERS ---------- */

async function loadDeanContext() {
  const { data } = await $supabase.auth.getUser()
  const authUser = data?.user
  if (!authUser) return

  const { data: userRow } = await $supabase
    .from("users")
    .select("department_id")
    .eq("auth_user_id", authUser.id)
    .maybeSingle()

  deanDepartmentId.value = userRow?.department_id || null

  if (deanDepartmentId.value) {
    const { data: deptRow } = await $supabase
      .from("departments")
      .select("type")
      .eq("id", deanDepartmentId.value)
      .maybeSingle()

    isGenEdDean.value = deptRow?.type === "GENED"
  }
}

async function loadAcademicTerms() {
  const { data } = await $supabase
    .from("academic_terms")
    .select("id, academic_year, semester, is_active")
    .order("academic_year", { ascending: false })
    .order("semester", { ascending: false })

  academicTerms.value = data || []
  // auto-select active
  const active = academicTerms.value.find((t: any) => t.is_active)
  selectedTermId.value = active?.id || (academicTerms.value[0]?.id ?? null)
}

async function loadPeriods() {
  const { data } = await $supabase
    .from("periods")
    .select("*")
    .order("slot_index", { ascending: true })

  periods.value = data || []
}

async function loadClasses() {
  // Reuse existing classes endpoint with auth header
  const { data: { session } } = await $supabase.auth.getSession()
  const res = await $fetch("/api/classes/list", {
    headers: {
      Authorization: `Bearer ${session?.access_token}`
    },
    query: {}
  })

  classes.value = Array.isArray(res) ? (res as any[]) : []
  if (!selectedClassId.value && classes.value.length > 0) {
    selectedClassId.value = classes.value[0].id
  }
}

async function loadFaculty() {
  const { data } = await $supabase
    .from("faculty")
    .select("id, first_name, last_name")
    .order("last_name", { ascending: true })

  faculty.value = data || []
}

async function loadRooms() {
  const { data } = await $supabase
    .from("rooms")
    .select("id, name, department_id")
    .order("name", { ascending: true })

  // option: filter by dean dept if you want
  rooms.value = data || []
}

async function loadSubjects() {
  // Use subjects/list with auth header (we already fixed backend)
  const { data: { session } } = await $supabase.auth.getSession()

  const res = await $fetch("/api/subjects/list", {
    headers: {
      Authorization: `Bearer ${session?.access_token}`
    }
  })

  subjects.value = Array.isArray(res) ? (res as any[]) : []
}

async function loadSchedules() {
  const { data: { session } } = await $supabase.auth.getSession()
  if (!selectedTermId.value) return

  let target_id: string | null = null
  if (viewMode.value === "CLASS") target_id = selectedClassId.value
  else if (viewMode.value === "FACULTY") target_id = selectedFacultyId.value
  else target_id = selectedRoomId.value

  if (!target_id) return

  loading.value = true
  try {
    const res = await $fetch("/api/schedules/list", {
      headers: {
        Authorization: `Bearer ${session?.access_token}`
      },
      query: {
        view: viewMode.value,
        target_id,
        academic_term_id: selectedTermId.value
      }
    })

    const rows = Array.isArray(res) ? (res as any[]) : []
    events.value = rows.map((s: any) => {
      return {
        ...s,
        // convenience fields for calendar layout
        startSlot: s.period_start?.slot_index ?? 0,
        endSlot: s.period_end?.slot_index ?? 0,
        label: s.subject?.course_code
          ? `${s.subject.course_code} – ${s.subject.description}`
          : "Untitled",
        classLabel: s.class
          ? `${s.class.program_name} ${s.class.year_level_label} ${s.class.section}`
          : ""
      }
    })
  } finally {
    loading.value = false
  }
}

async function reloadSchedules() {
  await loadSchedules()
}

/* ---------- CALENDAR HANDLERS ---------- */

type CreateRangePayload = {
  day: string
  period_start_id: string
  period_end_id: string
}

function resetForm() {
  form.value = {
    class_id: viewMode.value === "CLASS" ? selectedClassId.value : null,
    subject_id: null,
    faculty_id: null,
    room_id: viewMode.value === "ROOM" ? selectedRoomId.value : null,
    mode: "F2F",
    day: "MON",
    period_start_id: null,
    period_end_id: null,
    subject_is_major: false
  }
}

function handleCreateRange(payload: CreateRangePayload) {
  resetForm()
  form.value.day = payload.day
  form.value.period_start_id = payload.period_start_id
  form.value.period_end_id = payload.period_end_id

  drawerOpen.value = true
  editingEvent.value = null
}

function handleEventClick(ev: any) {
  // Later: support editing
  editingEvent.value = ev
  form.value = {
    class_id: ev.class_id,
    subject_id: ev.subject_id,
    faculty_id: ev.faculty_id,
    room_id: ev.room_id,
    mode: ev.mode,
    day: ev.day,
    period_start_id: ev.period_start_id,
    period_end_id: ev.period_end_id,
    subject_is_major: !ev.subject?.is_gened
  }
  drawerOpen.value = true
}

/* ---------- SAVE / UNDO ---------- */

async function saveSchedule(force: boolean) {
  if (!selectedTermId.value) return
  if (!form.value.class_id && viewMode.value === "CLASS") {
    form.value.class_id = selectedClassId.value
  }

  saving.value = true
  try {
    const { data: { session } } = await $supabase.auth.getSession()

    const payload = {
      class_id: form.value.class_id,
      subject_id: form.value.subject_id,
      faculty_id: form.value.faculty_id,
      room_id: form.value.room_id,
      period_start_id: form.value.period_start_id,
      period_end_id: form.value.period_end_id,
      day: form.value.day,
      mode: form.value.mode,
      academic_term_id: selectedTermId.value,
      force
    }

    const res: any = await $fetch("/api/schedules/create", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.access_token}`
      },
      body: payload
    })

    // Success
    drawerOpen.value = false
    snackbar.value = {
      show: true,
      message: res.warnings?.length
        ? res.warnings.join(" ")
        : "Schedule created.",
      canUndo: true,
      undoId: res.undo_id,
      timeout: 10000
    }

    await loadSchedules()
  } catch (err: any) {
    const data = err?.data

    // Soft-flex: faculty / room conflict
    if (data?.data?.type === "FACULTY_CONFLICT") {
      snackbar.value = {
        show: true,
        message: "Teacher is already booked at this time — tap to override.",
        canUndo: false,
        undoId: null,
        timeout: 8000
      }
      // On next save, send force: true
      await saveSchedule(true)
      return
    }

    if (data?.data?.type === "ROOM_CONFLICT") {
      snackbar.value = {
        show: true,
        message: "Room is already used at this time — tap to override.",
        canUndo: false,
        undoId: null,
        timeout: 8000
      }
      await saveSchedule(true)
      return
    }

    snackbar.value = {
      show: true,
      message: data?.message || "Failed to save schedule.",
      canUndo: false,
      undoId: null,
      timeout: 6000
    }
  } finally {
    saving.value = false
  }
}

async function handleUndo() {
  if (!snackbar.value.undoId) return
  const { data: { session } } = await $supabase.auth.getSession()

  try {
    await $fetch("/api/schedules/undo", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.access_token}`
      },
      body: { id: snackbar.value.undoId }
    })
    snackbar.value.show = false
    await loadSchedules()
  } catch (err: any) {
    snackbar.value = {
      show: true,
      message: "Failed to undo (maybe expired).",
      canUndo: false,
      undoId: null,
      timeout: 6000
    }
  }
}

/* ---------- INIT ---------- */

onMounted(async () => {
  await loadDeanContext()
  await loadAcademicTerms()
  await Promise.all([
    loadPeriods(),
    loadClasses(),
    loadFaculty(),
    loadRooms(),
    loadSubjects()
  ])
  await loadSchedules()
})
</script>
