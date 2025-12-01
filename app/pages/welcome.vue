<script setup>
const nuxt = useNuxtApp()
const supabase = nuxt.$supabase

const password = ref("")
const loading = ref(false)
const error = ref("")
const success = ref(false)

const route = useRoute()
const accessToken = route.query.access_token

async function setPassword() {
  loading.value = true
  error.value = ""

  const { error: err } = await supabase.auth.updateUser(
    { password: password.value },
    { accessToken }
  )

  loading.value = false

  if (err) {
    error.value = err.message
  } else {
    success.value = true
    setTimeout(() => navigateTo("/login"), 1400)
  }
}
</script>

<template>
  <div class="max-w-md mx-auto mt-20 px-4">
    <h2 class="text-2xl font-semibold mb-4">Set Your Password</h2>

    <div v-if="success" class="p-3 bg-green-100 border border-green-300 rounded">
      Password updated! Redirecting to login...
    </div>

    <div v-else>
      <input
        v-model="password"
        type="password"
        placeholder="Enter your new password"
        class="w-full border p-3 rounded mb-3"
      />

      <button
        @click="setPassword"
        class="bg-blue-600 hover:bg-blue-700 text-white w-full p-3 rounded"
        :disabled="loading"
      >
        {{ loading ? "Saving..." : "Save Password" }}
      </button>

      <p v-if="error" class="text-red-500 mt-3">{{ error }}</p>
    </div>
  </div>
</template>
