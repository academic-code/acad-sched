<template>
  <div>

    <!-- Title -->
    <h1 class="text-h5 font-weight-bold mb-6">Dashboard</h1>

    <!-- MODULE OVERVIEW -->
    <h2 class="text-subtitle-1 font-weight-medium mb-3">Module Overview</h2>

    <!-- ROW 1 -->
    <v-row dense class="mb-4">
      <v-col
        v-for="card in row1"
        :key="card.label"
        cols="12"
        sm="6"
        md="4"
      >
        <v-card elevation="1" class="pa-4 rounded-lg">
          <div class="d-flex justify-space-between align-center mb-2">
            <span class="font-weight-medium">{{ card.label }}</span>
            <v-icon color="grey-darken-1">mdi-information-outline</v-icon>
          </div>

          <div class="d-flex align-center">
            <v-icon :color="card.color" class="mr-3" size="32">
              {{ card.icon }}
            </v-icon>

            <span class="text-h4 font-weight-bold">
              <v-skeleton-loader
                v-if="loading"
                type="text"
                width="40"
              />
              <span v-else>{{ card.value }}</span>
            </span>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- ROW 2 -->
    <v-row dense class="mb-8">
      <v-col
        v-for="card in row2"
        :key="card.label"
        cols="12"
        sm="6"
        md="4"
      >
        <v-card elevation="1" class="pa-4 rounded-lg">
          <div class="d-flex justify-space-between align-center mb-2">
            <span class="font-weight-medium">{{ card.label }}</span>
            <v-icon color="grey-darken-1">mdi-information-outline</v-icon>
          </div>

          <div class="d-flex align-center">
            <v-icon :color="card.color" class="mr-3" size="32">
              {{ card.icon }}
            </v-icon>

            <span class="text-h4 font-weight-bold">
              <v-skeleton-loader
                v-if="loading"
                type="text"
                width="40"
              />
              <span v-else>{{ card.value }}</span>
            </span>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- QUICK ACTIONS -->
    <h2 class="text-subtitle-1 font-weight-medium mb-3">Quick Actions</h2>

    <v-row dense>

      <!-- CREATE DEPARTMENT -->
      <v-col cols="12" sm="6" md="4">
        <v-card
          elevation="1"
          class="pa-4 rounded-lg action-card"
          @click="router.push('/admin/departments?create=1')"
        >
          <div class="d-flex align-center">
            <v-icon color="primary" size="32" class="mr-3">
              mdi-domain-plus
            </v-icon>
            <div>
              <div class="font-weight-medium text-body-1">Create Department</div>
              <div class="text-caption text-grey-darken-1">
                Add a new college department
              </div>
            </div>
          </div>
        </v-card>
      </v-col>

      <!-- CREATE DEAN (will use new modal system later) -->
      <v-col cols="12" sm="6" md="4">
        <v-card
          elevation="1"
          class="pa-4 rounded-lg action-card"
          @click="router.push('/admin/deans?create=1')"
        >
          <div class="d-flex align-center">
            <v-icon color="indigo" size="32" class="mr-3">
              mdi-account-tie
            </v-icon>
            <div>
              <div class="font-weight-medium text-body-1">Create Dean</div>
              <div class="text-caption text-grey-darken-1">
                Assign a dean to a department
              </div>
            </div>
          </div>
        </v-card>
      </v-col>

    </v-row>

  </div>
</template>

<script setup>
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"

const router = useRouter()
const { $supabase } = useNuxtApp()

definePageMeta({ layout: "admin" })

const loading = ref(true)

/* --------------------------
   DASHBOARD ROW 1
-------------------------- */
const row1 = ref([
  { label: "Departments", icon: "mdi-town-hall", color: "blue", table: "departments", value: 0 },
  { label: "Deans", icon: "mdi-account-tie", color: "indigo", table: "deans", value: 0 },
  { label: "Teachers", icon: "mdi-account-group", color: "green", table: "faculty", value: 0 },
])

/* --------------------------
   DASHBOARD ROW 2
-------------------------- */
const row2 = ref([
  { label: "Subjects", icon: "mdi-book-open-page-variant", color: "deep-purple", table: "subjects", value: 0 },
  { label: "Classes", icon: "mdi-google-classroom", color: "orange", table: "classes", value: 0 },
  { label: "Schedules", icon: "mdi-calendar-month-outline", color: "pink", table: "schedules", value: 0 },
])

/* --------------------------
   FETCH COUNTS FROM SUPABASE
-------------------------- */
async function loadCounts() {
  loading.value = true

  const allCards = [...row1.value, ...row2.value]

  for (const card of allCards) {
    const { count, error } = await $supabase
      .from(card.table)
      .select("*", { count: "exact", head: true })

    card.value = error ? 0 : count
  }

  loading.value = false
}

onMounted(loadCounts)
</script>

<style scoped>
.action-card {
  cursor: pointer;
  transition: 0.2s ease;
}

.action-card:hover {
  background-color: #e3f2fd;
}
</style>
