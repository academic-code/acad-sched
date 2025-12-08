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
          This action cannot be undone.
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
      :academic-terms="academicTerms"
      :role="isGenEdDean ? 'GENED' : 'DEAN'"
      @create="openCreate"
      @edit="openEdit"
      @delete="requestDelete"
      @assign="openAssignDrawer"
    />

    <!-- SUBJECT ASSIGN DRAWER -->
    <v-navigation-drawer
      v-model="assignDrawer"
      location="right"
      width="520"
      temporary
    >
      <v-card flat class="pa-4">
        <!-- Header -->
        <div class="d-flex justify-space-between align-center mb-2">
          <h3 class="text-h6 font-weight-medium">
            Assign Subjects — {{ selectedClass?.class_name }}
          </h3>

          <v-btn icon class="mr-n2" variant="text" @click="assignDrawer = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </div>

        <!-- Status -->
        <v-alert
          v-if="!canAssignToSelectedClass"
          type="warning"
          border="start"
          class="mb-3"
        >
          GenEd Dean — assignment disabled.
        </v-alert>

        <!-- Search -->
        <v-text-field
          v-model="search"
          prepend-inner-icon="mdi-magnify"
          label="Search subjects..."
          variant="outlined"
          hide-details
          density="comfortable"
          class="mb-4"
        />

        <!-- Available Subjects -->
        <h4 class="font-weight-medium text-subtitle-2 mb-2 d-flex align-center">
          📋 Available Subjects
          <v-chip size="small" class="ml-2" variant="flat">
            {{ filteredSubjects.length }}
          </v-chip>
        </h4>

        <v-sheet
          class="rounded border"
          style="max-height: 260px; overflow-y: auto;"
        >
          <v-list density="compact" nav>
            <v-list-item
              v-for="sub in filteredSubjects"
              :key="sub.id"
              class="d-flex justify-space-between"
            >
              <div>
                <strong>{{ sub.course_code }}</strong> — {{ sub.description }}
                <v-chip
                  size="x-small"
                  class="ml-2"
                  :color="sub.is_gened ? 'purple' : 'blue'"
                  variant="flat"
                >
                  {{ sub.is_gened ? "GENED" : "MAJOR" }}
                </v-chip>
              </div>

              <!-- Assign / Already Assigned Indicator -->
              <v-btn
                v-if="!isAssigned(sub.id)"
                icon="mdi-plus"
                color="green"
                variant="text"
                size="small"
                :disabled="!canAssignToSelectedClass"
                @click="assignSubject(sub.id)"
              />
              <v-btn
                v-else
                icon="mdi-check"
                color="grey"
                variant="text"
                size="small"
                disabled
              />
            </v-list-item>
          </v-list>
        </v-sheet>

        <!-- Divider -->
        <v-divider class="my-4" />

        <!-- Assigned Subjects Section -->
        <div class="d-flex justify-space-between align-center">
          <h4 class="font-weight-medium text-subtitle-2 mb-1">
            🎓 Assigned Subjects
          </h4>

          <v-chip size="small" variant="flat">
            {{ assignedSubjects.length }}
          </v-chip>
        </div>

        <v-sheet
          class="rounded border"
          style="max-height: 230px; overflow-y:auto;"
        >
          <v-table density="compact">
            <tbody>
              <tr v-for="as in assignedDetails" :key="as.id">
                <td class="py-1">{{ as.course_code }}</td>
                <td class="py-1">{{ as.description }}</td>
                <td class="py-1">
                  <v-chip
                    size="x-small"
                    variant="flat"
                    :color="as.is_gened ? 'purple' : 'blue'"
                  >
                    {{ as.is_gened ? "GENED" : "MAJOR" }}
                  </v-chip>
                </td>
                <td class="text-end">
                  <v-btn
                    icon
                    size="small"
                    color="red"
                    variant="text"
                    :disabled="!canAssignToSelectedClass"
                    @click="removeSubject(as.id)"
                  >
                    <v-icon>mdi-delete</v-icon>
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-sheet>

        <!-- Footer -->
        <v-divider class="my-3" />

        <div class="text-end">
          <v-btn
            color="primary"
            prepend-icon="mdi-auto-fix"
            :disabled="!canAssignToSelectedClass || filteredSubjects.length === 0"
            @click="autoAssign"
          >
            Auto Assign Remaining
          </v-btn>
        </div>
      </v-card>
    </v-navigation-drawer>

    <AppAlert />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, type Ref } from "vue"
import ClassTable from "~/components/ClassTable.vue"
import ClassForm from "~/components/ClassForm.vue"
import AppAlert from "~/components/AppAlert.vue"
import { useAlert } from "~/composables/useAlert"
import type { AcademicTerm, FacultyOption, ClassFormPayload } from "../../../types/Class"

definePageMeta({ layout: "dean" })

const { $supabase } = useNuxtApp()
const { showAlert } = useAlert()

/* ---------------------- STATE ---------------------- */

const classes = ref<any[]>([])
const departments = ref<any[]>([])
const academicTerms: Ref<AcademicTerm[]> = ref([])
const faculty = ref<FacultyOption[]>([])

const deanDepartmentId = ref<string | null>(null)
const deanUserId = ref<string | null>(null)
const isGenEdDean = ref(false)

/* FORM */
const formModal = ref(false)
const saving = ref(false)
const selected = ref<ClassFormPayload | null>(null)

/* DELETE */
const deleteDialog = ref(false)
const pendingDelete = ref<any | null>(null)
const deleting = ref(false)

/* SUBJECT ASSIGN */
const assignDrawer = ref(false)
const selectedClass = ref<any | null>(null)
const availableSubjects = ref<any[]>([])
const assignedSubjects = ref<string[]>([])
const loadingSubjects = ref(false)
const search = ref("")

/* ---------------------- COMPUTED ---------------------- */

const adviserOptions = computed(() => faculty.value)

const classesForTable = computed<any[]>(() => {
  const termMap = new Map(
    academicTerms.value.map(t => [t.id, `${t.academic_year} - ${t.semester}`])
  )
  const facultyMap = new Map(
    faculty.value.map(f => [f.id, f.full_name])
  )

  return (classes.value || []).map((c: any) => ({
    ...c,
    adviser_name: c.adviser_id ? (facultyMap.get(c.adviser_id) || "") : "",
    term_label: c.academic_term_id
      ? (termMap.get(c.academic_term_id) || "")
      : ""
  }))
})

const canAssignToSelectedClass = computed(() => {
  if (!selectedClass.value) return false
  const term = academicTerms.value.find(
    t => t.id === selectedClass.value.academic_term_id
  )
  return !!term?.is_active && !isGenEdDean.value
})

const filteredSubjects = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return availableSubjects.value

  return availableSubjects.value.filter(s =>
    s.course_code.toLowerCase().includes(q) ||
    s.description.toLowerCase().includes(q)
  )
})

const assignedDetails = computed(() => {
  return availableSubjects.value.filter(s =>
    assignedSubjects.value.includes(s.id)
  )
})

/* ---------------------- SUBJECT LOGIC ---------------------- */

async function loadSubjects() {
  if (!selectedClass.value) return
  loadingSubjects.value = true

  // 1️⃣ Get semester of the selected class from its academic term
  const term = academicTerms.value.find(
    t => t.id === selectedClass.value.academic_term_id
  )
  const classSemester = term?.semester || null

  // 2️⃣ Query subjects matching year level + semester
  const { data, error } = await $supabase
    .from("subjects")
    .select("*")
    .eq("year_level_number", selectedClass.value.year_level_number)
    .eq("semester", classSemester) // semester filter
    .order("course_code")

  if (error) {
    showAlert("error", "Failed to load subjects.")
    availableSubjects.value = []
  } else {
    availableSubjects.value = data || []
  }

  // 3️⃣ Load already assigned subjects for this class
  const assigned = (await $fetch("/api/class-subjects/list", {
    query: { class_id: selectedClass.value.id }
  })) as { subject_id: string }[] | { error?: string }

  if (Array.isArray(assigned)) {
    assignedSubjects.value = assigned.map(x => x.subject_id)
  } else {
    assignedSubjects.value = []
  }

  loadingSubjects.value = false
}

function isAssigned(id: string) {
  return assignedSubjects.value.includes(id)
}

async function assignSubject(subjectId: string) {
  if (!canAssignToSelectedClass.value || !selectedClass.value) return

  await $fetch("/api/class-subjects/assign", {
    method: "POST",
    body: {
      class_id: selectedClass.value.id,
      subject_id: subjectId,
      academic_term_id: selectedClass.value.academic_term_id
    }
  })

  if (!assignedSubjects.value.includes(subjectId)) {
    assignedSubjects.value.push(subjectId)
  }
}

async function removeSubject(subjectId: string) {
  if (!canAssignToSelectedClass.value || !selectedClass.value) return

  await $fetch("/api/class-subjects/remove", {
    method: "DELETE",
    body: { class_id: selectedClass.value.id, subject_id: subjectId }
  })

  assignedSubjects.value = assignedSubjects.value.filter(id => id !== subjectId)
}

async function autoAssign() {
  if (!selectedClass.value) return

  for (const s of filteredSubjects.value) {
    if (!isAssigned(s.id)) {
      await assignSubject(s.id)
    }
  }
}

/* ---------------------- UI HANDLERS ---------------------- */

function openAssignDrawer(cls: any) {
  selectedClass.value = cls
  search.value = ""
  assignDrawer.value = true
  loadSubjects()
}

function openCreate() {
  if (isGenEdDean.value) return
  selected.value = null
  formModal.value = true
}

function openEdit(row: any) {
  if (isGenEdDean.value || row.department_id !== deanDepartmentId.value) return

  selected.value = {
    id: row.id,
    class_name: row.class_name,
    program_name: row.program_name,
    year_level_number: row.year_level_number,
    section: row.section,
    adviser_id: row.adviser_id || null,
    remarks: row.remarks || "",
    academic_term_id: row.academic_term_id
  }

  formModal.value = true
}

/* ---------------------- DELETE ---------------------- */

function requestDelete(row: any) {
  if (isGenEdDean.value) return
  pendingDelete.value = row
  deleteDialog.value = true
}

async function executeDelete() {
  if (!pendingDelete.value?.id) return
  deleting.value = true

  await $fetch("/api/classes/delete", {
    method: "DELETE",
    body: { id: pendingDelete.value.id }
  })

  deleteDialog.value = false
  pendingDelete.value = null
  await loadClasses()
  deleting.value = false
}

/* ---------------------- SAVE ---------------------- */

async function handleSave(payload: any) {
  saving.value = true

  const body = {
    ...payload,
    department_id: deanDepartmentId.value,
    created_by: deanUserId.value
  }

  if (payload.id) {
    await $fetch("/api/classes/update", { method: "PUT", body })
  } else {
    await $fetch("/api/classes/create", { method: "POST", body })
  }

  formModal.value = false
  saving.value = false
  await loadClasses()
}

/* ---------------------- LOADERS ---------------------- */

async function loadDeanContext() {
  const { data } = await $supabase.auth.getUser()
  const authUser = data?.user
  if (!authUser) return

  const { data: user, error: userErr } = await $supabase
    .from("users")
    .select("id, department_id")
    .eq("auth_user_id", authUser.id)
    .maybeSingle()

  if (userErr || !user?.department_id) {
    showAlert("error", "Unable to load dean profile.")
    return
  }

  deanDepartmentId.value = user.department_id
  deanUserId.value = user.id

  const { data: dept } = await $supabase
    .from("departments")
    .select("type")
    .eq("id", user.department_id)
    .maybeSingle()

  isGenEdDean.value = dept?.type === "GENED"
}

async function loadAcademicTerms() {
  const { data, error } = await $supabase
    .from("academic_terms")
    .select("id, academic_year, semester, is_active")
    .order("academic_year", { ascending: false })
    .order("semester", { ascending: false })

  if (error) {
    showAlert("error", "Failed to load academic terms.")
    academicTerms.value = []
  } else {
    academicTerms.value = Array.isArray(data) ? data : []
  }
}

async function loadDepartments() {
  const { data } = await $supabase.from("departments").select("*")
  departments.value = data || []
}

async function loadFaculty() {
  const { data } = await $supabase.from("faculty").select("*")
  faculty.value =
    data?.map((f: any) => ({
      id: f.id,
      full_name: `${f.last_name}, ${f.first_name}`
    })) || []
}

async function loadClasses() {
  const res = await $fetch("/api/classes/list", {
    query: { role: isGenEdDean.value ? "GENED" : "DEAN" }
  })
  classes.value = Array.isArray(res) ? res : []
}

/* ---------------------- INIT ---------------------- */

onMounted(async () => {
  await loadDeanContext()
  await loadDepartments()
  await loadAcademicTerms()
  await loadFaculty()
  await loadClasses()
})
</script>
