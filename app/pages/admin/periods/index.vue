<template>
  <div>
    <h1 class="text-h5 font-weight-bold mb-6">Periods</h1>

    <v-card class="pa-4 mb-4">
      <v-btn color="primary" :loading="loading" @click="generate(false)">
        Generate 6AM → 9PM (If Empty)
      </v-btn>

      <v-btn color="red" variant="outlined" class="ml-3" :loading="loading" @click="generate(true)">
        Overwrite Existing
      </v-btn>

      <v-btn class="ml-3" variant="tonal" color="green" @click="openCreate">
        Add Custom Period
      </v-btn>
    </v-card>

    <v-card>
      <v-data-table :headers="headers" :items="periods" class="text-body-2">

        <template #item.start_time="{ item }">
          {{ formatTime(item.start_time) }}
        </template>

        <template #item.end_time="{ item }">
          {{ formatTime(item.end_time) }}
        </template>

        <template #item.actions="{ item }">
          <v-btn icon size="small" variant="text" color="indigo" @click="openEdit(item)">
            <v-icon>mdi-pencil</v-icon>
          </v-btn>

          <v-btn icon size="small" variant="text" color="red" @click="confirmDelete(item)">
            <v-icon>mdi-delete</v-icon>
          </v-btn>
        </template>
      </v-data-table>
    </v-card>

    <!-- MODAL -->
    <v-dialog v-model="modal" width="400">
      <v-card class="pa-4">
        <h3 class="text-h6 font-weight-medium mb-4">
          {{ isEditing ? "Edit Period" : "Create Period" }}
        </h3>

        <v-text-field v-model="form.start_time" label="Start (24h e.g., 13:30:00)" />
        <v-text-field v-model="form.end_time" label="End (24h e.g., 14:00:00)" />
        <v-text-field v-model="form.slot_index" label="Slot #" type="number" />

        <div class="d-flex justify-end mt-4">
          <v-btn variant="text" @click="modal=false">Cancel</v-btn>

          <v-btn :loading="loading" color="primary" class="ml-2" @click="save">
            Save
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <AppAlert />
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue"
import { useAlert } from "~/composables/useAlert"

definePageMeta({ layout: "admin" })

const { showAlert } = useAlert()
const { $supabase } = useNuxtApp()

const loading = ref(false)
const modal = ref(false)
const periods = ref([])

const form = ref({ id: null, start_time: "", end_time: "", slot_index: "" })
const isEditing = ref(false)
let deleteTarget = ref(null)

const headers = [
  { title: "Slot", key: "slot_index" },
  { title: "Start", key: "start_time" },
  { title: "End", key: "end_time" },
  { title: "Actions", key: "actions", sortable: false, align: "center" }
]

function formatTime(time) {
  const [h, m] = time.split(":")
  const hour = Number(h)
  const suffix = hour >= 12 ? "PM" : "AM"
  const adj = hour % 12 || 12
  return `${adj}:${m} ${suffix}`
}

async function load() {
  const { data } = await $supabase.from("periods").select("*").order("slot_index")
  periods.value = data || []
}

async function generate(overwrite) {
  loading.value = true
  const res = await $fetch("/api/periods/generate", { method: "POST", body: { overwrite } })
  loading.value = false

  if (res.error) return showAlert("error", res.error)

  showAlert("success", `${res.count} periods generated.`)
  load()
}

function openCreate() {
  isEditing.value = false
  form.value = { id: null, start_time: "", end_time: "", slot_index: "" }
  modal.value = true
}

function openEdit(item) {
  isEditing.value = true
  form.value = { ...item }
  modal.value = true
}

async function save() {
  loading.value = true

  const endpoint = isEditing.value ? "/api/periods/update" : "/api/periods/create"

  const res = await $fetch(endpoint, { method: isEditing.value ? "PUT" : "POST", body: form.value })
  loading.value = false

  if (res.error) return showAlert("error", res.error)

  modal.value = false
  showAlert("success", "Saved successfully.")
  load()
}

function confirmDelete(item) {
  deleteTarget.value = item
  deletePeriod()
}

async function deletePeriod() {
  loading.value = true
  await $fetch("/api/periods/delete", { method:"DELETE", body:{ id: deleteTarget.value.id } })
  loading.value = false

  showAlert("success", "Period deleted.")
  load()
}

onMounted(load)
</script>
