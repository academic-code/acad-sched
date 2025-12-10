<template>
  <div class="event" @click="$emit('edit')">
    {{ event.subject_code || "Schedule" }}
  </div>
</template>

<script setup lang="ts">
defineProps<{ event: any; periods: any[] }>()
</script>

<style scoped>
.event {
  position: absolute;
  background: #2196f3;
  color: white;
  padding: 4px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}
</style>
