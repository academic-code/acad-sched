<template>
  <div class="max-w-600">
    <h1 class="text-h5 font-weight-bold mb-6">Edit Department</h1>

    <v-card class="pa-6" v-if="loaded">
      <v-text-field
        v-model="name"
        label="Department Name"
        prepend-icon="mdi-domain"
        variant="outlined"
        class="mb-4"
        required
      />

      <v-select
        v-model="type"
        label="Department Type"
        :items="['NORMAL','GENED']"
        prepend-icon="mdi-tag"
        variant="outlined"
        class="mb-6"
        :disabled="originalType === 'GENED'"
      />

      <div class="d-flex gap-3">
        <v-btn color="primary" @click="update" :loading="loading">
          Save Changes
        </v-btn>

        <v-btn variant="tonal" color="grey" @click="back">
          Cancel
        </v-btn>
      </div>
    </v-card>
  </div>
</template>

<script setup>
import { useAlert } from "~/composables/useAlert"
const { showAlert } = useAlert()
const { $supabase } = useNuxtApp()
const router = useRouter()
const route = useRoute()

definePageMeta({ layout: "admin" })

const id = route.params.id
const name = ref("")
const type = ref("NORMAL")
const loading = ref(false)
const loaded = ref(false)
const originalType = ref("NORMAL")

function normalize(str) {
  return str.toLowerCase().replace(/\s+/g, "_").replace(/[^\w_]/g, "")
}

function back() {
  router.push("/admin/departments")
}

async function load() {
  const { data, error } = await $supabase
    .from("departments")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !data) {
    showAlert("error", "Department not found.")
    router.push("/admin/departments")
    return
  }

  name.value = data.name
  type.value = data.type
  originalType.value = data.type
  loaded.value = true
}

async function update() {
  if (!name.value.trim()) {
    showAlert("error", "Name is required.")
    return
  }

  loading.value = true
  const normalized_key = normalize(name.value)

  // Check duplicate normalized_key against other rows
  const { count, error: dupErr } = await $supabase
    .from("departments")
    .select("*", { count: "exact", head: true })
    .eq("normalized_key", normalized_key)
    .not("id", "eq", id)

  if (dupErr) {
    loading.value = false
    showAlert("error", dupErr.message)
    return
  }

  if (count > 0) {
    loading.value = false
    showAlert("error", "Another department with this name exists.")
    return
  }

  const { error } = await $supabase
    .from("departments")
    .update({
      name: name.value,
      normalized_key,
      type: type.value,
    })
    .eq("id", id)

  loading.value = false
  if (error) {
    showAlert("error", error.message)
    return
  }

  showAlert("success", "Department updated.")
  router.push("/admin/departments")
}

onMounted(load)
</script>

<style scoped>
.max-w-600 {
  max-width: 600px;
}
</style>
