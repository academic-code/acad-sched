<!-- app/pages/dean/classes.vue -->
<template>
  <div>
    <h1 class="text-h5 font-weight-bold mb-6">Classes</h1>

    <!-- CREATE / EDIT DIALOG -->
    <v-dialog v-model="modal" width="520">
      <v-card class="pa-4">
        <h3 class="text-h6 font-weight-medium mb-4">
          {{ form.id ? "Edit Class" : "Create Class" }}
        </h3>

        <!-- Year Level + Section -->
        <v-row>
          <v-col cols="6">
            <v-select
              v-model="form.year_level_number"
              :items="yearLevels"
              item-title="label"
              item-value="value"
              label="Year Level"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model="form.section"
              label="Section"
              placeholder="A"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
        </v-row>

        <!-- Academic Term -->
        <v-select
          v-model="form.academic_term_id"
          :items="academicTerms"
          item-title="labelDisplay"
          item-value="id"
          label="Academic Term"
          variant="outlined"
          density="comfortable"
          class="mb-3"
        />

        <!-- Adviser (optional) -->
        <v-select
          v-model="form.adviser_id"
          :items="facultyOptions"
          item-title="label"
          item-value="id"
          label="Adviser (optional)"
          variant="outlined"
          density="comfortable"
          clearable
          class="mb-3"
        />

        <v-textarea
          v-model="form.remarks"
          label="Remarks"
          variant="outlined"
          density="comfortable"
          rows="2"
        />

        <v-switch
          v-model="form.is_archived"
          label="Archived"
          inset
          class="mt-2"
        />

        <div class="d-flex justify-end mt-4">
          <v-btn variant="text" @click="modal = false">Cancel</v-btn>
          <v-btn
            color="primary"
            class="ml-2"
            :loading="saving"
            @click="save"
            :disabled="isGenEdDean"
          >
            Save
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- TOP BAR -->
    <div class="d-flex justify-space-between align-center mb-4">
      <v-text-field
        v-model="search"
        placeholder="Search class..."
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
        density="comfortable"
        hide-details
        style="max-width: 260px"
      />

      <div class="d-flex align-center">
        <v-switch
          v-model="showArchived"
          label="Show archived"
          hide-details
          inset
          class="mr-4"
        />

        <v-btn
          v-if="!isGenEdDean"
          color="primary"
          prepend-icon="mdi-plus"
          @click="openCreate"
        >
          Create Class
        </v-btn>
      </div>
    </div>

    <!-- TABLE -->
    <v-card elevation="1">
      <v-data-table
        :headers="headers"
        :items="filteredClasses"
        :items-per-page="10"
        class="text-body-2"
      >
        <template #item.adviser="{ item }">
          {{ adviserName(item) }}
        </template>

        <template #item.academic_term="{ item }">
          <span v-if="item.academic_term">
            {{ formatTerm(item.academic_term) }}
          </span>
          <span v-else>—</span>
        </template>

        <template #item.is_archived="{ item }">
          <v-chip
            size="small"
            :color="item.is_archived ? 'grey-darken-2' : 'green-lighten-4'"
            :text-color="item.is_archived ? 'white' : 'green-darken-2'"
          >
            {{ item.is_archived ? "Archived" : "Active" }}
          </v-chip>
        </template>

        <template #item.actions="{ item }">
          <!-- Normal dean actions -->
          <template v-if="!isGenEdDean">
            <v-btn
              icon
              size="small"
              variant="text"
              color="indigo"
              @click="openEdit(item)"
            >
              <v-icon>mdi-pencil</v-icon>
            </v-btn>

            <v-btn
              icon
              size="small"
              variant="text"
              color="orange-darken-2"
              @click="assignSubjects(item)"
            >
              <v-icon>mdi-book-multiple</v-icon>
            </v-btn>

            <v-btn
              icon
              size="small"
              variant="text"
              :color="item.is_archived ? 'green' : 'red'"
              @click="toggleArchive(item)"
            >
              <v-icon>
                {{ item.is_archived ? "mdi-restore" : "mdi-archive" }}
              </v-icon>
            </v-btn>
          </template>

          <!-- GenEd dean: view-only, so no action buttons -->
        </template>

        <template #no-data>
          <div class="text-center pa-5 text-grey-darken-1">
            No classes found.
          </div>
        </template>
      </v-data-table>
    </v-card>

    <AppAlert />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import AppAlert from "~/components/AppAlert.vue"
import { useAlert } from "~/composables/useAlert"

definePageMeta({ layout: "dean" })

const { $supabase } = useNuxtApp()
const { showAlert } = useAlert()

/* --- DATA SOURCES --- */
const classes = ref<any[]>([])
const deanDepartmentId = ref("")
const advisers = ref<any[]>([])
const terms = ref<any[]>([])

/* --- ROLE LOGIC --- */
const isGenEdDean = ref(false)

/* --- FORM STATE --- */
const modal = ref(false)
const saving = ref(false)
const editingOriginal = ref<any | null>(null)

const form = ref<any>({
  id: null,
  year_level_number: 1,
  section: "",
  academic_term_id: "",
  adviser_id: null,
  remarks: "",
  is_archived: false
})

/* --- UI STATE --- */
const search = ref("")
const showArchived = ref(false)

/* --- DROPDOWNS --- */
const yearLevels = [
  { label: "1st Year", value: 1 },
  { label: "2nd Year", value: 2 },
  { label: "3rd Year", value: 3 },
  { label: "4th Year", value: 4 }
]

const facultyOptions = computed(() =>
  advisers.value.map(f => ({
    id: f.id,
    label: `${f.first_name} ${f.last_name}`
  }))
)

const academicTerms = computed(() =>
  terms.value.map(t => ({
    ...t,
    labelDisplay: `${t.academic_year} • ${t.semester}`
  }))
)

/* --- TABLE HEADERS (typed any[] to avoid Vuetify TS issues) --- */
const headers: any[] = [
  { title: "Class", key: "class_name" },
  { title: "Year Level", key: "year_level_label", align: "center" },
  { title: "Section", key: "section", align: "center" },
  { title: "Adviser", key: "adviser", align: "center" },
  { title: "Academic Term", key: "academic_term", align: "center" },
  { title: "Status", key: "is_archived", align: "center" },
  { title: "Actions", key: "actions", align: "center" },
]

/* --- HELPERS --- */
function adviserName(row: any) {
  if (!row?.adviser) return "—"
  return `${row.adviser.first_name} ${row.adviser.last_name}`
}

function formatTerm(term: any) {
  if (!term) return "—"
  return `${term.academic_year} • ${term.semester}`
}

/* --- LIST FILTERING --- */
const filteredClasses = computed(() => {
  let list = [...classes.value]

  if (!showArchived.value) {
    list = list.filter(c => !c.is_archived)
  }

  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(c =>
      c.class_name?.toLowerCase().includes(q) ||
      c.section?.toLowerCase().includes(q)
    )
  }

  return list
})

/* --- ACTIONS --- */
function openCreate() {
  if (isGenEdDean.value) {
    showAlert("error", "GenEd dean cannot create classes.")
    return
  }

  editingOriginal.value = null

  form.value = {
    id: null,
    year_level_number: 1,
    section: "",
    academic_term_id: terms.value.find(t => t.is_active)?.id || "",
    adviser_id: null,
    remarks: "",
    is_archived: false
  }

  modal.value = true
}

function openEdit(item: any) {
  if (isGenEdDean.value) {
    showAlert("error", "GenEd dean cannot edit classes.")
    return
  }

  editingOriginal.value = structuredClone(item)

  form.value = {
    id: item.id,
    year_level_number: item.year_level_number,
    section: item.section,
    academic_term_id: item.academic_term_id,
    adviser_id: item.adviser_id,
    remarks: item.remarks || "",
    is_archived: !!item.is_archived
  }

  modal.value = true
}

/**
 * Assign subjects to class (auto based on current or class term)
 */
async function assignSubjects(item: any) {
  if (isGenEdDean.value) {
    showAlert("error", "GenEd dean cannot assign subjects.")
    return
  }

  const ok = window.confirm(
    "Assign matching subjects now based on this class' year level and academic term?"
  )
  if (!ok) return

  const res = await $fetch<any>("/api/classes/assign-subjects", {
    method: "POST",
    body: { class_id: item.id }
  })

  if (res?.error) {
    showAlert("error", res.error)
    return
  }

  const count = res?.assignedCount ?? 0
  const label = res?.termLabel || "current term"
  showAlert("success", `${count} subjects automatically assigned (${label}).`)
}

/**
 * Toggle archive / restore
 */
async function toggleArchive(item: any) {
  if (isGenEdDean.value) {
    showAlert("error", "GenEd dean cannot archive classes.")
    return
  }

  const nowArchived = !item.is_archived
  const msg = nowArchived
    ? "Archive this class? It will be hidden from active scheduling."
    : "Restore this class as active?"

  const ok = window.confirm(msg)
  if (!ok) return

  const res = await $fetch<any>("/api/classes/archive", {
    method: "POST",
    body: { id: item.id, is_archived: nowArchived }
  })

  if (res?.error) {
    showAlert("error", res.error)
    return
  }

  await loadClasses()
  showAlert("success", nowArchived ? "Class archived." : "Class restored.")
}

/* --- SAVE (create / update with Option C rename confirmation) --- */
async function save() {
  if (isGenEdDean.value) {
    showAlert("error", "GenEd dean cannot modify classes.")
    return
  }

  if (!deanDepartmentId.value) {
    showAlert("error", "Dean department not detected.")
    return
  }

  if (!form.value.section.trim()) {
    showAlert("error", "Section is required.")
    return
  }

  if (!form.value.academic_term_id) {
    showAlert("error", "Academic term is required.")
    return
  }

  // Option C: detect "rename" (changes that affect logical class name)
  let renameMode: "CASCADE" | "LOCAL" | undefined = undefined
  if (form.value.id && editingOriginal.value) {
    const yearChanged =
      form.value.year_level_number !== editingOriginal.value.year_level_number
    const sectionChanged =
      (form.value.section || "").trim() !==
      (editingOriginal.value.section || "").trim()

    if (yearChanged || sectionChanged) {
      const cascade = window.confirm(
        "Renaming affects related curriculum and schedules. Apply rename system-wide?\n\nOK = Rename everywhere\nCancel = Update this class only"
      )
      renameMode = cascade ? "CASCADE" : "LOCAL"
      // (Note: in this schema, name is stored only in classes; mode is for future history/audit use.)
    }
  }

  saving.value = true

  const body = {
    id: form.value.id,
    department_id: deanDepartmentId.value,
    year_level_number: form.value.year_level_number,
    section: form.value.section.trim(),
    academic_term_id: form.value.academic_term_id,
    adviser_id: form.value.adviser_id,
    remarks: form.value.remarks || null,
    is_archived: !!form.value.is_archived,
    rename_mode: renameMode
  }

  const isUpdate = !!form.value.id
  const endpoint = isUpdate ? "/api/classes/update" : "/api/classes/create"
  const method = isUpdate ? "PUT" : "POST"

  const res = await $fetch<any>(endpoint, {
    method,
    body
  })

  saving.value = false

  if (res?.error) {
    showAlert("error", res.error)
    return
  }

  const createdOrUpdated = res?.class
  modal.value = false

  // For new class → ask if we auto-assign subjects
  if (!isUpdate && createdOrUpdated) {
    const doAssign = window.confirm(
      "Assign matching subjects now for this new class?"
    )
    if (doAssign) {
      const assignRes = await $fetch<any>("/api/classes/assign-subjects", {
        method: "POST",
        body: { class_id: createdOrUpdated.id }
      })

      if (assignRes?.error) {
        showAlert("error", assignRes.error)
      } else {
        const count = assignRes?.assignedCount ?? 0
        const label = assignRes?.termLabel || "current term"
        showAlert(
          "success",
          `${count} subjects automatically assigned (${label}).`
        )
      }
    } else {
      showAlert("success", "Class created.")
    }
  } else {
    showAlert("success", "Class saved.")
  }

  await loadClasses()
}

/* --- LOADERS --- */
async function loadDeanDepartment() {
  const { data } = await $supabase.auth.getUser()
  const user = data?.user
  if (!user) return

  const { data: userRow } = await $supabase
    .from("users")
    .select("department_id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  deanDepartmentId.value = userRow?.department_id || ""

  if (deanDepartmentId.value) {
    const { data: dept } = await $supabase
      .from("departments")
      .select("type")
      .eq("id", deanDepartmentId.value)
      .maybeSingle()

    isGenEdDean.value = dept?.type === "GENED"
  }
}

async function loadAdvisers() {
  if (!deanDepartmentId.value) return

  const { data, error } = await $supabase
    .from("faculty")
    .select("id, first_name, last_name")
    .eq("department_id", deanDepartmentId.value)

  if (error) {
    showAlert("error", error.message)
    return
  }

  advisers.value = data || []
}

async function loadAcademicTerms() {
  const { data, error } = await $supabase.from("academic_terms").select("*")
  if (error) {
    showAlert("error", error.message)
    return
  }
  terms.value = data || []
}

async function loadClasses() {
  if (!deanDepartmentId.value) return

  const res = await $fetch<any>("/api/classes/list", {
    query: { role: "DEAN", department_id: deanDepartmentId.value }
  })

  classes.value = Array.isArray(res) ? res : []
}

/* --- INIT --- */
onMounted(async () => {
  await loadDeanDepartment()
  await loadAdvisers()
  await loadAcademicTerms()
  await loadClasses()
})
</script>
