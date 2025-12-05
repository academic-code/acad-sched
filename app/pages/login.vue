<template>
  <div class="login-container">
    <v-card class="pa-6" width="420" elevation="4">
      
      <!-- LOGO -->
        <div class="logo-wrapper">
        <v-img src="/Logo.png" width="85" height="85" contain />
        </div>


      <h2 class="text-h6 text-center font-weight-bold mb-4">
        Academic Scheduler Login
      </h2>

      <!-- EMAIL -->
      <v-text-field
        v-model="email"
        label="Email"
        type="email"
        prepend-inner-icon="mdi-email"
        variant="outlined"
        density="comfortable"
        class="mb-3"
        autocomplete="email"
      />

      <!-- PASSWORD -->
      <v-text-field
        v-model="password"
        :type="showPassword ? 'text' : 'password'"
        label="Password"
        prepend-inner-icon="mdi-lock"
        :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
        @click:append-inner="showPassword = !showPassword"
        variant="outlined"
        density="comfortable"
        autocomplete="current-password"
      />

      <!-- ERROR -->
      <p v-if="errorMessage" class="text-red text-caption text-center mt-2">
        {{ errorMessage }}
      </p>

      <!-- LOGIN BUTTON -->
      <v-btn
        block
        color="primary"
        height="44"
        class="mt-4"
        :loading="loading"
        @click="handleLogin"
      >
        Login
      </v-btn>
    </v-card>

    <AppAlert />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import AppAlert from "~/components/AppAlert.vue"
import { useAlert } from "~/composables/useAlert"

definePageMeta({
  layout: false
})

const { showAlert } = useAlert()
const supabase = useNuxtApp().$supabase

const email = ref("")
const password = ref("")
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref("")


/** --- Fetch role from database users table --- */
async function fetchUserRole(authId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("auth_user_id", authId)
    .maybeSingle()

  if (error || !data) return null
  return data.role
}


/** --- Redirect based on role --- */
function redirectByRole(role: string) {
  if (role === "ADMIN") return navigateTo("/admin")
  if (role === "DEAN") return navigateTo("/dean")
  if (role === "FACULTY") return navigateTo("/faculty")
  return navigateTo("/login")
}


/** --- Login handler --- */
async function handleLogin() {
  errorMessage.value = ""

  if (!email.value.trim() || !password.value.trim()) {
    errorMessage.value = "Please enter email and password."
    return
  }

  loading.value = true

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.value.trim(),
    password: password.value.trim()
  })

  loading.value = false

  if (error) {
    errorMessage.value = "Invalid email or password."
    return
  }

  const user = data.session?.user
  if (!user) return

  const role = await fetchUserRole(user.id)

  if (!role) {
    errorMessage.value = "Account exists but has no assigned role."
    return
  }

  showAlert("success", "Login successful!")
  redirectByRole(role)
}


/** --- Auto-redirect if already authenticated --- */
onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  const session = data.session

  if (!session) return

  const role = await fetchUserRole(session.user.id)

  // Only redirect once role is confirmed in DB
  if (role) redirectByRole(role)
})
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: #f5f8fc;
  animation: fade 0.3s ease-in-out;
}

.logo-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  margin-bottom: 16px;
}


.logo-wrapper img {
  transition: 0.3s ease;
}

.logo-wrapper:hover img {
  transform: scale(1.06);
}


@keyframes fade {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
