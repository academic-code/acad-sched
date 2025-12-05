<template>
  <v-snackbar
    v-model="show"
    :color="color"
    location="top right"
    timeout="2000"
    rounded="lg"
    elevation="6"
    width="380"
  >
    <div class="d-flex align-center">
      <v-icon size="30" class="mr-3">
        {{ icon }}
      </v-icon>

      <span class="text-body-1 font-weight-medium">
        {{ message }}
      </span>
    </div>
  </v-snackbar>
</template>

<script setup lang="ts">
import { show, message, color, icon } from "~/composables/useAlert"
</script>

<style scoped>
.v-snackbar {
  padding: 75px 15px !important;
  font-size: 16px !important;
}
</style>
