<template>
  <div>
    <!-- PAGE TITLE -->
    <h1 class="text-h5 font-weight-bold mb-6">Deans</h1>

    <!-- TOP BAR -->
    <div class="d-flex justify-space-between align-center mb-4">
      <!-- SEARCH -->
      <v-text-field
        v-model="search"
        placeholder="Search dean..."
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
        density="comfortable"
        hide-details
        style="max-width: 300px"
        class="mr-4"
      />

      <!-- INVITE BUTTON -->
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        height="42"
        @click="openCreate"
      >
        Invite Dean
      </v-btn>
    </div>

    <!-- TABLE -->
    <v-card elevation="1">
      <v-data-table
        :headers="headers"
        :items="filteredDeans"
        :items-per-page="itemsPerPage"
        class="text-body-2"
      >
        <!-- DEPARTMENT NAME COLUMN -->
        <template #item.department="{ item }">
          {{ item.departments?.name || "—" }}
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

        <template #no-data>
          <div class="text-center pa-5 text-grey-darken-1">
            No deans found.
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- CREATE / EDIT MODAL -->
    <v-dialog v-model="modal" width="450">
      <v-card class="pa-4">
        <h3 class="text-h6 font-weight-medium mb-4">
          {{ isEditing ? "Edit Dean" : "Invite Dean" }}
        </h3>

        <!-- FULL NAME -->
        <v-text-field
          v-model="form.full_name"
          label="Full Name"
          variant="outlined"
          density="comfortable"
          class="mb-3"
        />

        <!-- EMAIL FIELD (ONLY WHEN CREATING) -->
        <v-text-field
          v-if="!isEditing"
          v-model="form.email"
          type="email"
          label="Email Address"
          variant="outlined"
          density="comfortable"
          class="mb-3"
        />

        <!-- DEPARTMENT -->
        <v-select
          v-model="form.department_id"
          :items="departments"
          item-title="name"
          item-value="id"
          label="Department"
          variant="outlined"
          density="comfortable"
          class="mb-4"
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
    <v-dialog v-model="deleteDialog" width="420">
      <v-card class="pa-4">
        <h3 class="text-h6 font-weight-medium mb-4">Delete Dean</h3>

        <p>Are you sure you want to delete <b>{{ selected?.full_name }}</b>?</p>

        <div class="d-flex justify-end mt-4">
          <v-btn variant="text" @click="deleteDialog = false">Cancel</v-btn>

          <v-btn
            color="red"
            class="ml-2"
            :loading="loading"
            @click="deleteDean"
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

const itemsPerPage = ref(10)
const selected = ref(null)

const deans = ref([])
const departments = ref([])

const form = ref({
  id: null,
  full_name: "",
  email: "",
  department_id: "",
  auth_id: null
})

/* -----------------------
   TABLE HEADERS
----------------------- */
const headers = [
  { title: "Full Name", key: "full_name" },
  { title: "Email", key: "email" },
  { title: "Department", key: "department" },
  { title: "Actions", key: "actions", align: "center", sortable: false },
]

/* -----------------------
   FILTERED DATA
----------------------- */
const filteredDeans = computed(() => {
  if (!search.value) return deans.value

  return deans.value.filter(d =>
    d.full_name.toLowerCase().includes(search.value.toLowerCase()) ||
    d.email.toLowerCase().includes(search.value.toLowerCase())
  )
})

/* -----------------------
   LOAD INITIAL DATA
----------------------- */
async function loadDeans() {
  const { data, error } = await $supabase
    .from("deans")
    .select("*, departments(name)")

  if (error) return showAlert("error", error.message)
  deans.value = data
}

async function loadDepartments() {
  const { data } = await $supabase.from("departments").select("*")
  departments.value = data || []
}

onMounted(() => {
  loadDeans()
  loadDepartments()
})

/* -----------------------
   OPEN MODALS
----------------------- */
function openCreate() {
  isEditing.value = false
  form.value = { id: null, full_name: "", email: "", department_id: "" }
  modal.value = true
}

function openEdit(item) {
  isEditing.value = true
  form.value = {
    id: item.id,
    full_name: item.full_name,
    email: item.email,
    department_id: item.department_id,
    auth_id: item.auth_id
  }
  modal.value = true
}

/* -----------------------
   SAVE — CREATE OR UPDATE
----------------------- */
async function save() {
  loading.value = true

  if (!form.value.full_name.trim()) {
    loading.value = false
    return showAlert("error", "Dean name is required.")
  }

  if (!isEditing.value && !form.value.email.trim()) {
    loading.value = false
    return showAlert("error", "Dean email is required.")
  }

  if (!form.value.department_id) {
    loading.value = false
    return showAlert("error", "Please select a department.")
  }

  // CREATE (invite dean)
  if (!isEditing.value) {
    const res = await $fetch("/api/invite-dean", {
      method: "POST",
      body: {
        email: form.value.email,
        full_name: form.value.full_name,
        department_id: form.value.department_id
      }
    })

    loading.value = false

    if (res.error) return showAlert("error", res.error)

    modal.value = false
    showAlert("success", "Dean invitation sent.")
    return loadDeans()
  }

  // UPDATE
  const { error } = await $supabase
    .from("deans")
    .update({
      full_name: form.value.full_name,
      department_id: form.value.department_id
    })
    .eq("id", form.value.id)

  loading.value = false

  if (error) return showAlert("error", error.message)

  modal.value = false
  showAlert("success", "Dean updated.")
  loadDeans()
}

/* -----------------------
   DELETE
----------------------- */
function confirmDelete(item) {
  selected.value = item
  deleteDialog.value = true
}

async function deleteDean() {
  loading.value = true

  const res = await $fetch("/api/deans/delete", {
    method: "DELETE",
    body: {
      id: selected.value.id,
      auth_id: selected.value.auth_id
    }
  })

  loading.value = false
  deleteDialog.value = false

  if (res.error) return showAlert("error", res.error)

  showAlert("success", "Dean deleted.")
  loadDeans()
}
</script>

<style scoped>
.v-data-table {
  border-radius: 8px;
}
</style>
