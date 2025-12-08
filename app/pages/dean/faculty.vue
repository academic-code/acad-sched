<template>
  <div>
    <h1 class="text-h5 font-weight-bold mb-6">Manage Faculty</h1>

    <!-- TOP BAR -->
    <div class="d-flex mb-4 justify-space-between align-center">
      <v-text-field
        v-model="search"
        prepend-inner-icon="mdi-magnify"
        placeholder="Search faculty..."
        variant="outlined"
        density="comfortable"
        style="max-width: 300px"
      />

      <v-btn color="primary" prepend-icon="mdi-account-plus" @click="openCreate">
        Invite Faculty
      </v-btn>
    </div>

    <!-- TABLE -->
    <v-card elevation="1">
      <v-data-table
        :headers="headers"
        :items="filteredFaculty"
        :items-per-page="10"
        class="text-body-2"
      >
        <!-- STATUS TOGGLE -->
        <template #item.status="{ item }">
          <v-switch
            v-model="item.is_active"
            inset
            hide-details
            :color="item.is_active ? 'green' : 'red'"
            @change="toggleStatus(item)"
          />
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
            No faculty found.
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- CREATE / EDIT MODAL -->
    <v-dialog v-model="modal" width="460">
      <v-card class="pa-4">
        <h3 class="text-h6 font-weight-medium mb-4">
          {{ editing ? "Edit Faculty" : "Invite Faculty" }}
        </h3>

        <v-text-field
          v-model="form.employee_no"
          label="Employee No."
          variant="outlined"
          density="comfortable"
          class="mb-3"
        />

        <v-text-field
          v-model="form.first_name"
          label="First Name"
          variant="outlined"
          density="comfortable"
          class="mb-3"
        />

        <v-text-field
          v-model="form.last_name"
          label="Last Name"
          variant="outlined"
          density="comfortable"
          class="mb-3"
        />

        <v-text-field
          v-if="!editing"
          v-model="form.email"
          label="Email"
          type="email"
          variant="outlined"
          density="comfortable"
          class="mb-3"
        />

        <v-select
          v-model="form.faculty_type"
          :items="['Full-Time', 'Part-Time']"
          label="Faculty Type"
          variant="outlined"
          density="comfortable"
          class="mb-3"
        />

        <v-switch
          v-model="form.is_active"
          label="Active"
          hide-details
          :color="form.is_active ? 'green' : 'red'"
        />

        <div class="d-flex justify-end mt-4">
          <v-btn variant="text" @click="modal = false">Cancel</v-btn>
          <v-btn color="primary" class="ml-2" :loading="loading" @click="save">
            Save
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- DELETE CONFIRMATION -->
    <v-dialog v-model="deleteDialog" width="420">
      <v-card class="pa-4">
        <h3 class="text-h6 font-weight-medium mb-4">Delete Faculty</h3>
        <p>Are you sure you want to delete <b>{{ selected?.full_name }}</b>?</p>

        <div class="d-flex justify-end mt-4">
          <v-btn variant="text" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="red" class="ml-2" :loading="loading" @click="deleteFaculty">
            Delete
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <AppAlert />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue"

import { useRefreshRouter } from "~/composables/useRefreshRouter"

import AppAlert from "~/components/AppAlert.vue"
import { useAlert } from "~/composables/useAlert"
import type { DataTableHeader } from "vuetify"

definePageMeta({ layout: "dean" })

const supabase = useNuxtApp().$supabase
const { showAlert } = useAlert()

type FacultyRow = {
  id: string
  employee_no: string | null
  first_name: string
  last_name: string
  email: string
  faculty_type: string | null
  is_active: boolean
  department_id: string
  auth_user_id: string | null
  full_name?: string
}

const deanDepartmentId = ref<string | null>(null)

const faculty = ref<FacultyRow[]>([])
const search = ref("")
const modal = ref(false)
const deleteDialog = ref(false)
const loading = ref(false)
const editing = ref(false)
const selected = ref<FacultyRow | null>(null)

const form = ref({
  id: null as string | null,
  employee_no: "",
  first_name: "",
  last_name: "",
  email: "",
  faculty_type: "Full-Time",
  is_active: true,
  auth_user_id: null as string | null
})

/** ---- FIXED HEADERS ---- **/
const headers: DataTableHeader[] = [
  { title: "Employee No.", key: "employee_no", align: "start" },
  { title: "Name", key: "full_name", align: "start" },
  { title: "Email", key: "email", align: "start" },
  { title: "Type", key: "faculty_type", align: "center" },
  { title: "Status", key: "status", align: "center" },
  { title: "Actions", key: "actions", align: "center", sortable: false }
]

const filteredFaculty = computed(() =>
  faculty.value.filter((f) => {
    const q = search.value.toLowerCase()
    return (
      (f.full_name || "").toLowerCase().includes(q) ||
      (f.email || "").toLowerCase().includes(q) ||
      (f.employee_no || "").toLowerCase().includes(q)
    )
  })
)

async function loadDeanDepartment() {
  const { data } = await supabase.auth.getUser()
  const authUser = data.user
  if (!authUser) {
    navigateTo("/login")
    return
  }

  const { data: userRow, error } = await supabase
    .from("users")
    .select("department_id")
    .eq("auth_user_id", authUser.id)
    .maybeSingle()

  if (error || !userRow) {
    showAlert("error", "Unable to detect dean department.")
    navigateTo("/login")
    return
  }

  deanDepartmentId.value = userRow.department_id
}

async function loadFaculty() {
  if (!deanDepartmentId.value) return

  const { data, error } = await supabase
    .from("faculty")
    .select("*")
    .eq("department_id", deanDepartmentId.value)
    .order("last_name")

  if (error) {
    console.error(error)
    showAlert("error", "Failed to load faculty list.")
    return
  }

  faculty.value = (data || []).map((f: any) => ({
    ...f,
    full_name: `${f.first_name} ${f.last_name}`
  }))
}

function openCreate() {
  editing.value = false
  form.value = {
    id: null,
    employee_no: "",
    first_name: "",
    last_name: "",
    email: "",
    faculty_type: "Full-Time",
    is_active: true,
    auth_user_id: null
  }
  modal.value = true
}

function openEdit(item: FacultyRow) {
  editing.value = true
  selected.value = item
  form.value = {
    id: item.id,
    employee_no: item.employee_no || "",
    first_name: item.first_name,
    last_name: item.last_name,
    email: item.email,
    faculty_type: item.faculty_type || "Full-Time",
    is_active: item.is_active,
    auth_user_id: item.auth_user_id || null
  }
  modal.value = true
}

async function save() {
  if (!form.value.first_name || !form.value.last_name || !form.value.employee_no) {
    showAlert("error", "Employee No, first name, and last name are required.")
    return
  }

  loading.value = true

  if (!editing.value) {
    const res: any = await $fetch("/api/faculty/create", {
      method: "POST",
      body: {
        ...form.value,
        department_id: deanDepartmentId.value
      }
    })

    loading.value = false

    if (res.error) return showAlert("error", res.error)

    showAlert("success", "Faculty invitation sent.")
    modal.value = false
    return loadFaculty()
  }

  const res: any = await $fetch("/api/faculty/update", {
    method: "PUT",
    body: form.value
  })

  loading.value = false

  if (res.error) return showAlert("error", res.error)

  showAlert("success", "Faculty updated.")
  modal.value = false
  loadFaculty()
}

function confirmDelete(item: FacultyRow) {
  selected.value = item
  deleteDialog.value = true
}

async function deleteFaculty() {
  if (!selected.value) return

  loading.value = true

  const res: any = await $fetch("/api/faculty/delete", {
    method: "DELETE",
    body: {
      faculty_id: selected.value.id,
      auth_user_id: selected.value.auth_user_id
    }
  })

  loading.value = false
  deleteDialog.value = false

  if (res.error) return showAlert("error", res.error)

  showAlert("success", "Faculty deleted.")
  loadFaculty()
}

async function toggleStatus(item: FacultyRow) {
  const prev = item.is_active
  const { error } = await supabase
    .from("faculty")
    .update({ is_active: item.is_active })
    .eq("id", item.id)

  if (error) {
    item.is_active = !prev
    return showAlert("error", "Failed to update status.")
  }

  showAlert("success", `Faculty is now ${item.is_active ? "Active" : "Inactive"}.`)
}

onMounted(async () => {
  await loadDeanDepartment()
  await loadFaculty()
})

/* ---------------------- 🔄 AUTO REFRESH ---------------------- */
useRefreshRouter({
  faculty: loadFaculty
})
</script>