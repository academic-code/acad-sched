<template>
  <v-app>
    <!-- SIDEBAR -->
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

      <!-- MENU -->
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

    <!-- TOP BAR -->
    <v-app-bar app elevation="1" color="white">
      <v-btn icon variant="text" @click="drawer = !drawer">
        <v-icon color="primary">mdi-menu</v-icon>
      </v-btn>

      <v-toolbar-title class="ml-2 font-weight-medium text-grey-darken-3">
        Dean Panel
      </v-toolbar-title>

      <v-spacer />

      <!-- PROFILE MENU -->
      <v-menu>
        <template #activator="{ props }">
          <v-btn icon variant="text" v-bind="props">
            <v-icon color="primary">mdi-account-circle</v-icon>
          </v-btn>
        </template>

        <v-list>
          <v-list-item>
            <v-list-item-title class="text-caption">
              {{ userEmail }}<br />
              (Dean)
            </v-list-item-title>
          </v-list-item>

          <v-divider />

          <v-list-item @click="logout">
            <v-list-item-title>Logout</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar>

    <!-- MAIN CONTENT -->
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
import { useAlert } from "~/composables/useAlert"
import AppAlert from "~/components/AppAlert.vue"

const supabase = useNuxtApp().$supabase
const { showAlert } = useAlert()

const drawer = ref(true)
const isMobile = ref(false)
const userEmail = ref("Loading...")

// Dean menu
const menu = [
  { label: "Dashboard", to: "/dean", icon: "mdi-view-dashboard" },
  { label: "Faculty", to: "/dean/faculty", icon: "mdi-account-group" },
  { label: "Classes", to: "/dean/classes", icon: "mdi-google-classroom" },
  { label: "Subjects", to: "/dean/subjects", icon: "mdi-book-open-page-variant" },
  { label: "Schedule", to: "/dean/schedule", icon: "mdi-calendar-clock" }
]

async function loadUser() {
  const { data } = await supabase.auth.getUser()
  if (!data.user) return navigateTo("/login")
  userEmail.value = data.user.email
}

async function logout() {
  await supabase.auth.signOut()
  showAlert("success", "Logged out successfully.")
  navigateTo("/login")
}

if (process.client) {
  const updateSize = () => {
    isMobile.value = window.innerWidth < 960
    if (isMobile.value) drawer.value = false
  }

  onMounted(() => {
    loadUser()
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
