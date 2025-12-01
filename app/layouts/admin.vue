<template>
  <v-app>
    <v-navigation-drawer
      v-model="drawer"
      app
      width="260"
      elevation="1"
      color="white"
      :temporary="isMobile"
    >
      <!-- LOGO -->
      <div class="pa-4 d-flex justify-center">
        <v-img src="/Logo.png" width="70" />
      </div>

      <!-- SIDEBAR MENU -->
      <v-list nav density="comfortable">
        <v-list-item
          v-for="item in menu"
          :key="item.to"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.label"
          active-class="nav-active"
          class="mx-2 my-1"
          rounded="lg"
        />
      </v-list>
    </v-navigation-drawer>

    <v-app-bar app elevation="1" color="white">
      <v-btn icon variant="text" @click="drawer = !drawer">
        <v-icon color="primary">mdi-menu</v-icon>
      </v-btn>

      <v-toolbar-title class="ml-2 font-weight-medium text-grey-darken-3">
        Admin Panel
      </v-toolbar-title>

      <v-spacer />

      <!-- PROFILE DROPDOWN -->
      <v-menu>
        <template #activator="{ props }">
          <v-btn icon variant="text" v-bind="props">
            <v-icon color="primary">mdi-account-circle</v-icon>
          </v-btn>
        </template>

        <v-list>
          <v-list-item>
            <v-list-item-title class="text-caption">
              {{ currentUser.email }}<br />
              ({{ currentRole }})
            </v-list-item-title>
          </v-list-item>

          <v-divider />

          <v-list-item @click="logout">
            <v-list-item-title>Logout</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar>

    <v-main class="bg-grey-lighten-4">
      <v-container fluid class="pa-6">
        <slot />
      </v-container>
    </v-main>

    <AppAlert />
  </v-app>
</template>

<script setup>
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"
import AppAlert from "~/components/AppAlert.vue"

const router = useRouter()

const drawer = ref(true)
const isMobile = ref(false)

const currentUser = { email: "admin@example.com" }
const currentRole = "Admin"

const menu = [
  { label: "Dashboard", to: "/admin", icon: "mdi-view-dashboard" },
  { label: "Departments", to: "/admin/departments", icon: "mdi-domain" },
  { label: "Periods", to: "/admin/periods", icon: "mdi-clock-outline" },
  { label: "Subjects", to: "/admin/subjects", icon: "mdi-book-open-page-variant" },
  { label: "Teachers", to: "/admin/faculty", icon: "mdi-account-group-outline" },
  { label: "Classes", to: "/admin/classes", icon: "mdi-google-classroom" },
  { label: "Rooms", to: "/admin/rooms", icon: "mdi-door-sliding" },
  { label: "Schedules", to: "/admin/schedules", icon: "mdi-calendar-clock" }
]

function logout() {
  router.push("/login")
}

if (process.client) {
  const updateSize = () => {
    isMobile.value = window.innerWidth < 960
    if (isMobile.value) drawer.value = false
  }

  onMounted(() => {
    updateSize()
    window.addEventListener("resize", updateSize)
  })
}
</script>

<style scoped>
.nav-active {
  background-color: #e3f2fd !important;
  color: #1976d2 !important;
}
</style>
