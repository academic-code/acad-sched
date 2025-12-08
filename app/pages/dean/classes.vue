<template>
  <div>
    <h1 class="text-h5 font-weight-bold mb-6">Classes</h1>

    <!-- CLASS FORM (PROGRAM DEAN ONLY) -->
    <ClassForm
      v-if="!isGenEdDean"
      v-model="formModal"
      :data="selected"
      :academic-terms="academicTerms"
      :faculty="adviserOptions"
      :saving="saving"
      @save="handleSave"
    />

    <!-- DELETE CONFIRM (PROGRAM DEAN ONLY) -->
    <v-dialog v-model="deleteDialog" width="480" v-if="!isGenEdDean">
      <v-card class="pa-4">
        <h3 class="text-h6 font-weight-medium mb-2">Delete Class</h3>
        <p class="mb-4">
          Are you sure you want to delete
          <strong>{{ pendingDelete?.class_name }}</strong>?
        </p>

        <p class="text-body-2 text-red-darken-1">
          This action cannot be undone. You cannot delete a class if it is already
          used in schedules or other records.
        </p>

        <div class="d-flex justify-end mt-4">
          <v-btn variant="text" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn
            color="red"
            class="ml-2"
            :loading="deleting"
            @click="executeDelete"
          >
            Delete
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- CLASSES TABLE -->
    <ClassTable
      :classes="classesForTable"
      :departments="departments"
      :role="isGenEdDean ? 'GENED' : 'DEAN'"
      @create="openCreate"
      @edit="openEdit"
      @delete="requestDelete"
    />

    <AppAlert />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import ClassTable from "~/components/ClassTable.vue"
import ClassForm from "~/components/ClassForm.vue"
import AppAlert from "~/components/AppAlert.vue"
import { useAlert } from "~/composables/useAlert"
import type {
  AcademicTerm,
  FacultyOption,
  ClassFormPayload
} from "../../../types/Class"

definePageMeta({ layout: "dean" })

const { $supabase } = useNuxtApp()
const { showAlert } = useAlert()

/* ---------- STATE ---------- */

const classes = ref<any[]>([])
const departments = ref<{ id: string; name: string }[]>([])
const academicTerms = ref<AcademicTerm[]>([])
const faculty = ref<FacultyOption[]>([])

const deanDepartmentId = ref<string | null>(null)
const deanUserId = ref<string | null>(null)
const isGenEdDean = ref(false)

/* FORM STATE (PROGRAM DEAN) */
const formModal = ref(false)
const saving = ref(false)
const selected = ref<ClassFormPayload | null>(null)

/* DELETE STATE (PROGRAM DEAN) */
const deleteDialog = ref(false)
const pendingDelete = ref<any | null>(null)
const deleting = ref(false)

/* ---------- COMPUTED ---------- */

// Advisers dropdown: program dean → only same department; GenEd dean (read-only) still uses names
const adviserOptions = computed<FacultyOption[]>(() => faculty.value)

// Map classes with adviser_name + term_label for table
const classesForTable = computed(() => {
  const termMap = new Map(
    academicTerms.value.map((t) => [
      t.id,
      `${t.academic_year} - ${t.semester}`
    ])
  )

  const facultyMap = new Map(
    faculty.value.map((f) => [f.id, f.full_name])
  )

  return classes.value.map((c: any) => ({
    ...c,
    adviser_name: c.adviser_id ? facultyMap.get(c.adviser_id) || "" : "",
    term_label: c.academic_term_id
      ? termMap.get(c.academic_term_id) || ""
      : ""
  }))
})

/* ---------- LOADERS ---------- */

async function loadDeanContext() {
  const { data } = await $supabase.auth.getUser()
  const authUser = data?.user
  if (!authUser) return

  const { data: userRow, error: userErr } = await $supabase
    .from("users")
    .select("id, department_id")
    .eq("auth_user_id", authUser.id)
    .maybeSingle()

  if (userErr || !userRow?.department_id) {
    showAlert("error", "Unable to load dean profile.")
    return
  }

  deanDepartmentId.value = userRow.department_id
  deanUserId.value = userRow.id

  const { data: deptRow } = await $supabase
    .from("departments")
    .select("type")
    .eq("id", userRow.department_id)
    .maybeSingle()

  isGenEdDean.value = deptRow?.type === "GENED"
}

async function loadDepartments() {
  const { data, error } = await $supabase
    .from("departments")
    .select("id, name")
    .order("name", { ascending: true })

  if (error) {
    showAlert("error", "Failed to load departments.")
    return
  }

  departments.value = (data || []) as { id: string; name: string }[]
}

async function loadAcademicTerms() {
  const { data, error } = await $supabase
    .from("academic_terms")
    .select("id, academic_year, semester")
    .order("academic_year", { ascending: false })
    .order("semester", { ascending: false })

  if (error) {
    showAlert("error", "Failed to load academic terms.")
    return
  }

  academicTerms.value = (data || []) as AcademicTerm[]
}

async function loadFaculty() {
  // GenEd dean is read-only, but for display they can see adviser names across departments
  let query = $supabase
    .from("faculty")
    .select("id, first_name, last_name, department_id, is_active")

  if (!isGenEdDean.value && deanDepartmentId.value) {
    query = query.eq("department_id", deanDepartmentId.value)
  }

  const { data, error } = await query

  if (error) {
    showAlert("error", "Failed to load faculty.")
    return
  }

  faculty.value =
    (data || []).map((f: any) => ({
      id: f.id,
      full_name: `${f.last_name}, ${f.first_name}`
    })) as FacultyOption[]
}

async function loadClasses() {
  const role = isGenEdDean.value ? "GENED" : "DEAN"

  const query: Record<string, string> = {
    role
  }

  if (!isGenEdDean.value && deanDepartmentId.value) {
    query.department_id = deanDepartmentId.value
  }

  const res = await $fetch("/api/classes/list", {
    query
  })

  classes.value = Array.isArray(res) ? (res as any[]) : []
}

/* ---------- FORM HANDLERS (PROGRAM DEAN) ---------- */

function openCreate() {
  if (isGenEdDean.value) return
  selected.value = null
  formModal.value = true
}

function openEdit(row: any) {
  if (isGenEdDean.value) return
  if (row.department_id !== deanDepartmentId.value) {
    showAlert("error", "You can only edit classes in your own department.")
    return
  }

  const payload: ClassFormPayload = {
    id: row.id,
    class_name: row.class_name,
    program_name: row.program_name,
    year_level_number: row.year_level_number,
    section: row.section,
    adviser_id: row.adviser_id || null,
    remarks: row.remarks || "",
    academic_term_id: row.academic_term_id
  }

  selected.value = payload
  formModal.value = true
}

async function handleSave(payload: ClassFormPayload) {
  if (!deanDepartmentId.value || !deanUserId.value) {
    showAlert("error", "Dean context not loaded.")
    return
  }

  saving.value = true

  const body: any = {
    ...payload,
    department_id: deanDepartmentId.value,
    created_by: deanUserId.value
  }

  try {
    if (payload.id) {
      const res: any = await $fetch("/api/classes/update", {
        method: "PUT",
        body
      })
      if (res?.error) throw new Error(res.error)
      showAlert("success", "Class updated.")
    } else {
      const res: any = await $fetch("/api/classes/create", {
        method: "POST",
        body
      })
      if (res?.error) throw new Error(res.error)
      showAlert("success", "Class created.")
    }

    selected.value = null
    await loadClasses()
  } catch (err: any) {
    showAlert("error", err?.message || "Failed to save class.")
  } finally {
    saving.value = false
  }
}

/* ---------- DELETE FLOW (PROGRAM DEAN) ---------- */

function requestDelete(row: any) {
  if (isGenEdDean.value) return
  if (row.department_id !== deanDepartmentId.value) {
    showAlert("error", "You can only delete classes in your own department.")
    return
  }

  pendingDelete.value = row
  deleteDialog.value = true
}

async function executeDelete() {
  if (!pendingDelete.value) return
  deleting.value = true

  try {
    const res: any = await $fetch("/api/classes/delete", {
      method: "DELETE",
      body: { id: pendingDelete.value.id }
    })

    if (res?.error) throw new Error(res.error)

    showAlert("success", "Class deleted.")
    deleteDialog.value = false
    pendingDelete.value = null
    await loadClasses()
  } catch (err: any) {
    showAlert("error", err?.message || "Failed to delete class.")
  } finally {
    deleting.value = false
  }
}

/* ---------- INIT ---------- */

onMounted(async () => {
  await loadDeanContext()
  await loadDepartments()
  await loadAcademicTerms()
  await loadFaculty()
  await loadClasses()
})
</script>
