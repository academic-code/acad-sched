<template>
  <div class="welcome-container">
    <v-card class="pa-8 text-center welcome-card" elevation="6" width="450">

      <!-- LOGO -->
      <v-img
        src="/Logo.png"
        width="90"
        class="mx-auto mb-4"
        contain
      />

      <h2 class="text-h5 font-weight-bold mb-2">
        Welcome 🎉
      </h2>

      <p class="text-body-2 text-grey-darken-1 mb-5">
        {{ displayName }} <br />
        <span class="text-caption">{{ userEmail }}</span>
      </p>

      <!-- PASSWORD SETUP FORM -->
      <div v-if="requiresPasswordSetup">
        <p class="text-body-2 mb-4">
          Before continuing, please set a secure password for your account.
        </p>

        <v-text-field
          v-model="newPassword"
          :type="showPassword ? 'text' : 'password'"
          label="Create Password"
          prepend-inner-icon="mdi-lock-outline"
          :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
          @click:append-inner="showPassword = !showPassword"
          variant="outlined"
          density="comfortable"
          class="mb-3"
        />

        <v-text-field
          v-model="confirmPassword"
          :type="showPassword ? 'text' : 'password'"
          label="Confirm Password"
          prepend-inner-icon="mdi-lock-check"
          variant="outlined"
          density="comfortable"
        />

        <v-btn
          block
          height="46"
          color="primary"
          class="mt-4"
          :loading="loading"
          @click="setPassword"
        >
          Save Password
        </v-btn>
      </div>

      <!-- CONTINUE BUTTON WHEN PASSWORD DONE -->
      <div v-else>
        <p class="text-body-2 mb-5">
          Your password setup is complete. Click below to enter your dashboard.
        </p>

        <v-btn
          block
          height="46"
          color="primary"
          class="mb-3"
          @click="goToDashboard"
        >
          Continue to Dashboard
        </v-btn>
      </div>

      <!-- LOGOUT -->
      <v-btn block variant="text" @click="logout">Logout</v-btn>
    </v-card>

    <AppAlert />
  </div>
</template>


<script setup lang="ts">
import { ref, onMounted } from "vue"
import { useAlert } from "~/composables/useAlert"
import AppAlert from "~/components/AppAlert.vue"

const supabase = useNuxtApp().$supabase
const { showAlert } = useAlert()

const userEmail = ref("")
const displayName = ref("User")
const requiresPasswordSetup = ref(true)

const newPassword = ref("")
const confirmPassword = ref("")
const showPassword = ref(false)
const loading = ref(false)


/** Load user info + detect if password is set */
async function loadUser() {
  const { data } = await supabase.auth.getUser()
  if (!data.user) return navigateTo("/login")

  const user = data.user
  userEmail.value = user.email || ""

  // Get role + password flag
  const { data: userDB } = await supabase
    .from("users")
    .select("full_name, role, password_set")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (userDB?.full_name) displayName.value = userDB.full_name

  // Detect if user needs to set password
  requiresPasswordSetup.value = !userDB?.password_set

  return userDB?.role
}


/** Save password for first-time login */
async function setPassword() {
  if (newPassword.value.length < 6) {
    return showAlert("error", "Password must be at least 6 characters.")
  }

  if (newPassword.value !== confirmPassword.value) {
    return showAlert("error", "Passwords do not match.")
  }

  loading.value = true

  const { data, error } = await supabase.auth.updateUser({
    password: newPassword.value
  })

  loading.value = false

  if (error) {
    return showAlert("error", error.message)
  }

  // Mark password as completed in DB
  await supabase
    .from("users")
    .update({ password_set: true })
    .eq("auth_user_id", data.user.id)

  requiresPasswordSetup.value = false
  showAlert("success", "Password saved successfully!")
}


/** Role-based dashboard redirect */
async function goToDashboard() {
  const role = await loadUser()

  if (role === "ADMIN") return navigateTo("/admin")
  if (role === "DEAN") return navigateTo("/dean")
  if (role === "FACULTY") return navigateTo("/faculty")

  showAlert("error", "No role assigned. Contact admin.")
}


/** Logout handler */
async function logout() {
  await supabase.auth.signOut()
  navigateTo("/login")
}

onMounted(loadUser)
</script>


<style scoped>
.welcome-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: #eef3ff;
}

.welcome-card {
  border-radius: 16px;
  animation: fade 0.25s ease-in-out;
}

@keyframes fade {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
