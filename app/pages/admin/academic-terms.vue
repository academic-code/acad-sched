<template>
  <div>
    <h1 class="text-h5 font-weight-bold mb-6">Academic Terms</h1>

    <!-- TOP BAR -->
    <div class="d-flex justify-space-between align-center mb-4">
      <v-text-field
        v-model="search"
        prepend-inner-icon="mdi-magnify"
        label="Search academic year..."
        variant="outlined"
        density="comfortable"
        hide-details
        style="max-width: 260px"
      />

      <div class="d-flex align-center">
        <v-btn
          variant="outlined"
          class="mr-2"
          prepend-icon="mdi-lightbulb-on-outline"
          @click="suggestNextTerm"
        >
          Suggest next term
        </v-btn>

        <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">
          Add Term
        </v-btn>
      </div>
    </div>

    <!-- TABLE -->
    <v-card elevation="1">
      <v-data-table
        :headers="headers"
        :items="filteredTerms"
        :items-per-page="10"
        class="text-body-2"
      >
        <template #item="{ item }">
          <tr :class="item.is_active ? 'active-row' : ''">
            <td>{{ item.academic_year }}</td>
            <td class="text-center">{{ formatSemester(item.semester) }}</td>
            <td><strong>{{ formatLabel(item) }}</strong></td>

            <td class="text-center">
              <v-switch
                :model-value="item.is_active"
                inset
                color="green-darken-2"
                @update:model-value="val => toggleActive(item, val)"
              />
            </td>

            <td class="text-center">
              <v-btn icon variant="text" color="indigo" @click="openEdit(item)">
                <v-icon>mdi-pencil</v-icon>
              </v-btn>

              <v-btn icon variant="text" color="red" @click="deleteTerm(item)">
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </td>
          </tr>
        </template>

        <template #no-data>
          <div class="text-center pa-5 text-grey-darken-1">
            No academic terms found.
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- FORM DIALOG -->
    <v-dialog v-model="modal" width="520">
      <v-card class="pa-4">
        <h3 class="text-h6 font-weight-medium mb-4">
          {{ form.id ? "Edit Academic Term" : "Create Academic Term" }}
        </h3>

        <v-row>
          <v-col cols="7">
            <v-text-field
              v-model="form.academic_year"
              label="Academic Year (2025-2026)"
              variant="outlined"
              density="comfortable"
              hint="Format: YYYY-YYYY"
              persistent-hint
            />
          </v-col>

          <v-col cols="5">
            <v-select
              v-model="form.semester"
              :items="semesterOptions"
              item-title="label"
              item-value="value"
              label="Semester"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
        </v-row>

        <v-switch
          v-model="form.is_active"
          label="Set as active term"
          inset
          color="green-darken-2"
        />

        <div class="d-flex justify-end mt-4">
          <v-btn variant="text" @click="closeModal">Cancel</v-btn>
          <v-btn
            :loading="saving"
            color="primary"
            class="ml-2"
            :disabled="!isValid"
            @click="save"
          >
            Save
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- CONFIRM Dialog -->
    <v-dialog v-model="confirmModal" width="380">
      <v-card class="pa-4">
        <h3 class="text-h6 font-weight-medium">{{ confirmTitle }}</h3>
        <p class="mt-2">{{ confirmMessage }}</p>

        <div class="d-flex justify-end mt-4">
          <v-btn variant="text" @click="confirmModal = false">Cancel</v-btn>
          <v-btn color="primary" class="ml-2" @click="executeConfirm">Confirm</v-btn>
        </div>
      </v-card>
    </v-dialog>

    <AppAlert />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import AppAlert from "~/components/AppAlert.vue"
import { useAlert } from "~/composables/useAlert"

definePageMeta({ layout: "admin" })

const { $supabase } = useNuxtApp()
const { showAlert } = useAlert()

type TermSemester = "1ST" | "2ND" | "SUMMER"

interface AcademicTerm {
  id: string
  academic_year: string
  semester: TermSemester
  label: string | null
  is_active: boolean
}

const terms = ref<AcademicTerm[]>([])
const search = ref("")
const modal = ref(false)
const saving = ref(false)

const confirmModal = ref(false)
const confirmMessage = ref("")
const confirmTitle = ref("")
let confirmCallback: null | (() => Promise<void>) = null

const form = ref({
  id: null as string | null,
  academic_year: "",
  semester: "1ST" as TermSemester,
  is_active: false
})

const semesterOptions = [
  { label: "1ST SEMESTER", value: "1ST" },
  { label: "2ND SEMESTER", value: "2ND" },
  { label: "SUMMER", value: "SUMMER" }
]

const headers: any[] = [
  { title: "Academic Year", key: "academic_year" },
  { title: "Semester", key: "semester", align: "center" },
  { title: "Label", key: "label" },
  { title: "Active", key: "is_active", align: "center" },
  { title: "Actions", key: "actions", align: "center" }
]

const filteredTerms = computed(() =>
  terms.value.filter(t =>
    t.academic_year.toLowerCase().includes(search.value.toLowerCase())
  )
)

const activeTerm = computed(() => terms.value.find(t => t.is_active))

const isValid = computed(() => /^\d{4}-\d{4}$/.test(form.value.academic_year))

const formatSemester = (s: TermSemester) =>
  s === "SUMMER" ? "SUMMER" : `${s} SEMESTER`

const formatLabel = (t: AcademicTerm) =>
  `${t.academic_year} • ${formatSemester(t.semester)}`

async function loadTerms() {
  const { data, error } = await $supabase
    .from("academic_terms")
    .select("*")
    .order("academic_year", { ascending: true })
    .order("semester", { ascending: true })

  if (error) {
    showAlert("error", error.message)
    return
  }

  terms.value = data || []
}

function openCreate() {
  form.value = { id: null, academic_year: "", semester: "1ST", is_active: false }
  modal.value = true
}

function openEdit(term: AcademicTerm) {
  form.value = { ...term }
  modal.value = true
}

function closeModal() {
  modal.value = false
}

function suggestNextTerm() {
  const last = terms.value.at(-1)
  if (!last) {
    const year = new Date().getFullYear()
    form.value = { id: null, academic_year: `${year}-${year + 1}`, semester: "1ST", is_active: false }
    modal.value = true
    return
  }

  const nextSem: TermSemester =
    last.semester === "1ST" ? "2ND" :
    last.semester === "2ND" ? "SUMMER" : "1ST"

 const [startStr = "0"] = last.academic_year?.split("-") || []
const yearNum = Number(startStr) || new Date().getFullYear()

const nextYear =
  nextSem === "1ST"
    ? `${yearNum + 1}-${yearNum + 2}`
    : last.academic_year



  form.value = { id: null, academic_year: nextYear, semester: nextSem, is_active: false }
  modal.value = true
}

async function save() {
  if (!isValid.value)
    return showAlert("error", "Enter a valid academic year (YYYY-YYYY).")

  saving.value = true

  // enforce exactly one active term
  if (form.value.is_active && activeTerm.value && activeTerm.value.id !== form.value.id) {
    saving.value = false
    return showAlert("error", "There is already an active term. Deactivate it first.")
  }

  if (form.value.id) {
    await $supabase
      .from("academic_terms")
      .update({
        academic_year: form.value.academic_year,
        semester: form.value.semester,
        label: `${form.value.academic_year} • ${form.value.semester}`,
        is_active: form.value.is_active
      })
      .eq("id", form.value.id)

    showAlert("success", "Academic term updated.")
  } else {
    await $supabase.from("academic_terms").insert({
      academic_year: form.value.academic_year,
      semester: form.value.semester,
      label: `${form.value.academic_year} • ${form.value.semester}`,
      is_active: form.value.is_active
    })

    showAlert("success", "Academic term created.")
  }

  saving.value = false
  modal.value = false
  await loadTerms()
}


async function toggleActive(term: AcademicTerm, value: boolean | null) {
  const newState = Boolean(value)

  if (!newState && term.is_active) {
    showAlert("error", "There must always be one active term.")
    await loadTerms()
    return
  }

  if (newState && activeTerm.value && activeTerm.value.id !== term.id) {
    await $supabase.from("academic_terms").update({ is_active: false }).eq("id", activeTerm.value.id)
  }

  await $supabase.from("academic_terms").update({ is_active: newState }).eq("id", term.id)

  showAlert("success", `Active term set to: ${term.academic_year}`)
  await loadTerms()
}

async function deleteTerm(term: AcademicTerm) {
  if (term.is_active) return showAlert("error", "Cannot delete the active term.")

  confirmTitle.value = "Delete Term"
  confirmMessage.value = "This action cannot be undone. Continue?"

  confirmCallback = async () => {
    await $supabase.from("academic_terms").delete().eq("id", term.id)
    showAlert("success", "Term deleted.")
    await loadTerms()
  }

  confirmModal.value = true
}

async function executeConfirm() {
  confirmModal.value = false
  if (confirmCallback) await confirmCallback()
}

onMounted(loadTerms)
</script>

<style scoped>
.active-row {
  background-color: #e8f5e9 !important;
}
</style>
