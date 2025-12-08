<template>
  <div>
    <!-- PAGE TITLE -->
    <h1 class="text-h5 font-weight-bold mb-6">Departments</h1>

    <!-- TOP BAR -->
    <div class="d-flex justify-space-between align-center mb-4">
      <!-- SEARCH -->
      <v-text-field
        v-model="search"
        placeholder="Search department..."
        variant="outlined"
        prepend-inner-icon="mdi-magnify"
        density="comfortable"
        hide-details
        style="max-width: 300px"
        class="mr-4"
      />

      <!-- ADD BUTTON -->
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        @click="openCreate"
        height="42"
      >
        Add Department
      </v-btn>
    </div>

    <!-- DEPARTMENT TABLE -->
    <v-card elevation="1">
      <v-data-table
        :headers="headers"
        :items="filteredDepartments"
        :items-per-page="itemsPerPage"
        class="text-body-2"
      >
        <!-- TYPE COLUMN -->
        <template #item.type="{ item }">
          <v-chip size="small" color="blue-lighten-4" text-color="blue-darken-3">
            {{ item.type }}
          </v-chip>
        </template>

        <!-- ACTIONS -->
        <template #item.actions="{ item }">
          <v-btn icon size="small" variant="text" color="indigo" @click="openEdit(item)">
            <v-icon>mdi-pencil</v-icon>
          </v-btn>

          <v-btn icon size="small" variant="text" color="red" @click="confirmDelete(item)">
            <v-icon>mdi-delete</v-icon>
          </v-btn>
        </template>

        <!-- NO DATA -->
        <template #no-data>
          <div class="text-center pa-5 text-grey-darken-1">
            No departments found.
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- CREATE/EDIT MODAL -->
    <v-dialog v-model="modal" width="450">
      <v-card class="pa-4">
        <h3 class="text-h6 font-weight-medium mb-4">
          {{ isEditing ? "Edit Department" : "Create Department" }}
        </h3>

        <v-text-field
          v-model="form.name"
          label="Department Name"
          variant="outlined"
          density="comfortable"
          class="mb-4"
        />

        <v-select
          v-model="form.type"
          :items="['NORMAL', 'GENED']"
          label="Type"
          variant="outlined"
          density="comfortable"
        />

        <div class="d-flex justify-end mt-4">
          <v-btn variant="text" @click="modal = false">Cancel</v-btn>

          <v-btn
            color="primary"
            :loading="loading"
            class="ml-2"
            @click="save"
          >
            Save
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- DELETE CONFIRMATION -->
    <v-dialog v-model="deleteDialog" width="400">
      <v-card class="pa-4">
        <h3 class="text-h6 font-weight-medium mb-4">Delete Department</h3>

        <p>Are you sure you want to delete <b>{{ selected?.name }}</b>?</p>

        <div class="d-flex justify-end mt-4">
          <v-btn variant="text" @click="deleteDialog = false">Cancel</v-btn>

          <v-btn
            color="red"
            :loading="loading"
            class="ml-2"
            @click="deleteDepartment"
          >
            Delete
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <AppAlert />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue"
import { useAlert } from "~/composables/useAlert"
import { useRefreshRouter } from "~/composables/useRefreshRouter"

definePageMeta({ layout: "admin" })

const { showAlert } = useAlert()
const { $supabase } = useNuxtApp()

/* -----------------------
   STATE
----------------------- */
const modal = ref(false)
const deleteDialog = ref(false)
const loading = ref(false)
const search = ref("")
const isEditing = ref(false)

const departments = ref([])
const selected = ref(null)

const itemsPerPage = ref(10)

const form = ref({
  id: null,
  name: "",
  type: "NORMAL",
})

/* -----------------------
   TABLE HEADERS
----------------------- */
const headers = [
  { title: "Department Name", key: "name" },
  { title: "Type", key: "type", align: "center" },
  { title: "Actions", key: "actions", align: "center", sortable: false },
]

/* -----------------------
   FILTERED SEARCH
----------------------- */
const filteredDepartments = computed(() => {
  if (!search.value) return departments.value

  return departments.value.filter(d =>
    d.name.toLowerCase().includes(search.value.toLowerCase())
  )
})

/* -----------------------
   LOAD DATA
----------------------- */
async function loadDepartments() {
  const { data, error } = await $supabase
    .from("departments")
    .select("*")
    .order("name")

  if (error) {
    showAlert("error", error.message)
    return
  }

  departments.value = data || []
}

/* -----------------------
   INIT
----------------------- */
onMounted(loadDepartments)

/* 🔄 AUTO REFRESH — listen to changes */
useRefreshRouter({
  departments: loadDepartments
})

/* -----------------------
   OPEN MODAL
----------------------- */
function openCreate() {
  isEditing.value = false
  form.value = { id: null, name: "", type: "NORMAL" }
  modal.value = true
}

function openEdit(item) {
  isEditing.value = true
  form.value = { ...item }
  modal.value = true
}

/* -----------------------
   NORMALIZE KEY
----------------------- */
function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

/* -----------------------
   SAVE
----------------------- */
async function save() {
  if (!form.value.name.trim()) {
    return showAlert("error", "Department name is required.")
  }

  loading.value = true

  const normalized_key = normalize(form.value.name)

  // Check duplicate
  const { data: existing } = await $supabase
    .from("departments")
    .select("id, normalized_key")

  const isDuplicate = existing?.some(
    d => d.normalized_key === normalized_key && d.id !== form.value.id
  )

  if (isDuplicate) {
    loading.value = false
    return showAlert("warning", "A department with this name already exists.")
  }

  if (!isEditing.value) {
    const { error } = await $supabase.from("departments").insert({
      name: form.value.name,
      type: form.value.type,
      normalized_key,
    })

    loading.value = false

    if (error) return showAlert("error", error.message)

    modal.value = false
    return showAlert("success", "Department created!")
  }

  const { error } = await $supabase
    .from("departments")
    .update({
      name: form.value.name,
      type: form.value.type,
      normalized_key
    })
    .eq("id", form.value.id)

  loading.value = false

  if (error) return showAlert("error", error.message)

  modal.value = false
  showAlert("success", "Department updated.")
}

/* -----------------------
   DELETE
----------------------- */
function confirmDelete(item) {
  selected.value = item
  deleteDialog.value = true
}

async function deleteDepartment() {
  if (!selected.value) return

  loading.value = true

  try {
    await $supabase.from("departments").delete().eq("id", selected.value.id)

    showAlert("success", "Department deleted.")
  } catch (err) {
    showAlert("error", err.message || "Failed to delete department.")
  }

  loading.value = false
  deleteDialog.value = false
}
</script>


<style scoped>
.v-data-table {
  border-radius: 8px;
}
</style>
