<template>
  <div>
    <h1 class="text-h5 font-weight-bold mb-6">Dean Dashboard</h1>

    <!-- WELCOME CARD -->
    <v-card class="pa-5 mb-6" elevation="2">
      <div class="d-flex align-center">
        <v-avatar size="52" color="primary">
          <v-icon size="34" color="white">mdi-account-tie</v-icon>
        </v-avatar>

        <div class="ml-4">
          <div class="font-weight-bold text-h6">{{ deanName }}</div>
          <div class="text-body-2 text-grey-darken-1">
            {{ departmentName }} Department
          </div>
        </div>
      </div>
    </v-card>

    <!-- STATS -->
    <h2 class="text-subtitle-1 font-weight-medium mb-3">Overview</h2>

    <v-row dense>
      <v-col v-for="card in stats" :key="card.label" cols="12" sm="6" md="4">
        <v-card class="pa-4 rounded-lg" elevation="1">
          <div class="d-flex justify-space-between align-center mb-2">
            <span class="font-weight-medium">{{ card.label }}</span>
            <v-icon>mdi-information-outline</v-icon>
          </div>

          <div class="d-flex align-center">
            <v-icon :color="card.color" size="32" class="mr-3">
              {{ card.icon }}
            </v-icon>
            <span class="text-h4 font-weight-bold">
              <v-skeleton-loader v-if="loading" type="text" width="40" />
              <span v-else>{{ card.value }}</span>
            </span>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- QUICK ACTIONS -->
    <h2 class="text-subtitle-1 font-weight-medium mt-8 mb-3">Quick Actions</h2>

    <v-row dense>
      <v-col v-for="item in actions" :key="item.label" cols="12" sm="6" md="4">
        <v-card class="pa-4 action-card" elevation="1" @click="navigateTo(item.to)">
          <div class="d-flex align-center">
            <v-icon :color="item.color" size="32" class="mr-3">{{ item.icon }}</v-icon>
            <div>
              <div class="font-weight-medium">{{ item.label }}</div>
              <div class="text-caption text-grey-darken-1">{{ item.desc }}</div>
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <AppAlert />
  </div>
</template>

<script setup>
definePageMeta({ layout: "dean" })

import { ref, onMounted, onBeforeUnmount } from "vue"
import AppAlert from "~/components/AppAlert.vue"
import { useAlert } from "~/composables/useAlert"

const supabase = useNuxtApp().$supabase
const { showAlert } = useAlert()

const deanName = ref("Loading...")
const departmentName = ref("")
const departmentId = ref("")
const isGenEdDean = ref(false)

const loading = ref(true)

const stats = ref([
  { label: "Faculty", icon: "mdi-account-group", color: "green", value: 0 },
  { label: "Classes", icon: "mdi-google-classroom", color: "orange", value: 0 },
  { label: "Subjects", icon: "mdi-book-open-page-variant", color: "deep-purple", value: 0 }
])

/* -------------------------------------------------------------------
   QUICK ACTIONS (FULL LIST, THEN FILTER FOR GENED DEAN)
------------------------------------------------------------------- */
const actions = ref([
  { label: "Manage Faculty", icon: "mdi-account-group", color: "green", desc: "Add or assign teachers", to: "/dean/faculty" },
  { label: "Manage Classes", icon: "mdi-google-classroom", color: "orange", desc: "Create or modify classes", to: "/dean/classes" },
  { label: "Create Schedule", icon: "mdi-calendar-clock", color: "indigo", desc: "Build class timetable", to: "/dean/schedule" }
])

const subscriptions = []

/* -------------------------------------------------------------------
   LOAD DEAN INFO
------------------------------------------------------------------- */
async function loadDeanInfo() {
  const { data } = await supabase.auth.getUser()
  if (!data.user) return navigateTo("/login")

  const { data: userRow } = await supabase
    .from("users")
    .select("full_name, department_id")
    .eq("auth_user_id", data.user.id)
    .single()

  deanName.value = userRow.full_name
  departmentId.value = userRow.department_id

  const { data: dept } = await supabase
    .from("departments")
    .select("name, type")
    .eq("id", userRow.department_id)
    .single()

  departmentName.value = dept.name
  isGenEdDean.value = dept.type === "GENED"

  filterActionsForGenEd()
}

/* -------------------------------------------------------------------
   FILTER QUICK ACTION BUTTONS FOR GENED DEAN
------------------------------------------------------------------- */
function filterActionsForGenEd() {
  if (isGenEdDean.value) {
    actions.value = actions.value.filter(a =>
      a.label !== "Manage Classes" &&
      a.label !== "Create Schedule"
    )
  }
}

/* -------------------------------------------------------------------
   LOAD DASHBOARD COUNTS
------------------------------------------------------------------- */
async function loadCounts() {
  let facultyCount = 0
  let classCount = 0
  let subjectCount = 0

  if (isGenEdDean.value) {
    // GenEd Dean sees only GenEd Subjects Count
    const { count: genedSubjects } = await supabase
      .from("subjects")
      .select("*", { count: "exact", head: true })
      .eq("is_gened", true)

    subjectCount = genedSubjects
  } else {
    // Normal Dean → count everything related to their department
    const [facultyRes, classesRes, subjectsRes] = await Promise.all([
      supabase.from("faculty").select("*", { count: "exact", head: true }).eq("department_id", departmentId.value),
      supabase.from("classes").select("*", { count: "exact", head: true }).eq("department_id", departmentId.value),
      supabase.from("subjects").select("*", { count: "exact", head: true }).eq("department_id", departmentId.value)
    ])

    facultyCount = facultyRes.count
    classCount = classesRes.count
    subjectCount = subjectsRes.count
  }

  stats.value[0].value = facultyCount
  stats.value[1].value = classCount
  stats.value[2].value = subjectCount

  loading.value = false
}

/* -------------------------------------------------------------------
   REALTIME UPDATES
------------------------------------------------------------------- */
function enableRealtime() {
  subscriptions.forEach(sub => supabase.removeChannel(sub))

  const tables = ["subjects"]

  if (!isGenEdDean.value) {
    tables.push("faculty", "classes")
  }

  tables.forEach(table => {
    const channel = supabase
      .channel(`realtime-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => loadCounts())
      .subscribe()

    subscriptions.push(channel)
  })
}

/* -------------------------------------------------------------------
   LIFECYCLE
------------------------------------------------------------------- */
onMounted(async () => {
  await loadDeanInfo()
  await loadCounts()
  enableRealtime()
})

onBeforeUnmount(() => {
  subscriptions.forEach(sub => supabase.removeChannel(sub))
})
</script>

<style scoped>
.action-card {
  cursor: pointer;
  transition: 0.2s;
}
.action-card:hover {
  background: #e6f0ff;
}
</style>
