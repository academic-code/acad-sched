<template>
  <div class="redirect-container">
    <!-- Logo -->
    <v-img
      src="/Logo.png"
      width="95"
      height="95"
      class="logo"
      contain
    />

    <!-- Spinner -->
    <v-progress-circular
      indeterminate
      size="55"
      width="6"
      color="primary"
      class="mt-5"
    />

    <!-- Text -->
    <p class="mt-3 text-grey-darken-2 text-body-2 fade-text">
      Checking session, please wait...
    </p>
  </div>
</template>

<script setup>
const { $supabase } = useNuxtApp()

onMounted(async () => {
  const { data } = await $supabase.auth.getSession()
  const session = data?.session

  // Slight pause for nice transition (optional)
  await new Promise(resolve => setTimeout(resolve, 600))

  if (session) {
    return navigateTo("/login")
  }

  return navigateTo("/login")
})
</script>

<style scoped>
.redirect-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  animation: fade-in 0.5s ease-in-out;
}

.logo {
  animation: float 2s ease-in-out infinite;
}

.fade-text {
  animation: fade-text 2s infinite;
}

/* Floating animation for the logo */
@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
  100% { transform: translateY(0px); }
}

/* Pulse text animation */
@keyframes fade-text {
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
}

/* Smooth container fade-in */
@keyframes fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
