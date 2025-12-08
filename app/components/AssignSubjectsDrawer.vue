<template>
  <v-navigation-drawer
    v-model="open"
    location="right"
    width="480"
    temporary
  >
    <v-card flat class="pa-4">

      <!-- Header -->
      <div class="d-flex justify-space-between align-center mb-4">
        <h3 class="text-h6 font-weight-medium">
          Subjects for: {{ classData?.class_name }}
        </h3>

        <v-btn icon variant="text" @click="close">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </div>

      <!-- Term Status -->
      <v-alert
        v-if="isLocked"
        type="warning"
        border="start"
        variant="tonal"
        class="mb-4"
      >
        Academic term is inactive — assignments are locked.
      </v-alert>

      <!-- Search -->
      <v-text-field
        v-model="search"
        prepend-inner-icon="mdi-magnify"
        label="Search subject..."
        variant="outlined"
        hide-details
        class="mb-3"
      />

      <!-- List Available Subjects -->
      <h4 class="font-weight-medium text-subtitle-2 mb-2">Available Subjects</h4>
      <v-list density="compact" class="border rounded mb-4" style="max-height: 220px; overflow:auto;">
        <v-list-item
          v-for="sub in filteredSubjects"
          :key="sub.id"
        >
          <v-list-item-title>
            {{ sub.course_code }} — {{ sub.description }}
          </v-list-item-title>

          <!-- Assign Button -->
          <v-btn
            icon
            size="small"
            color="green"
            variant="text"
            :disabled="!canModify"
            @click="assign(sub.id)"
          >
            <v-icon>mdi-plus</v-icon>
          </v-btn>
        </v-list-item>
      </v-list>

      <!-- Divider -->
      <v-divider class="my-3" />

      <!-- Assigned Subjects -->
      <h4 class="font-weight-medium text-subtitle-2 mb-2">Assigned Subjects</h4>
      <v-table density="compact">
        <tbody>
          <tr v-for="as in assigned" :key="as.id">
            <td>{{ as.course_code }}</td>
            <td>{{ as.description }}</td>

            <td class="text-end">
              <v-btn
                icon size="small" color="red"
                variant="text"
                :disabled="!canModify"
                @click="remove(as.id)"
              >
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>

    </v-card>
  </v-navigation-drawer>
</template>

<script setup>
import { ref, computed } from "vue"

const props = defineProps({
  modelValue: Boolean,
  classData: Object,
  subjects: Array,
  assigned: Array,
  academicTerms: Array,
  role: String // DEAN | ADMIN | GENED
})

const emit = defineEmits(["update:modelValue", "assign", "remove"])

const open = computed({
  get: () => props.modelValue,
  set: val => emit("update:modelValue", val)
})

const search = ref("")

const activeTerm = computed(() => props.academicTerms?.find(t => t.is_active) || null)

const isLocked = computed(() => {
  if (!props.classData?.academic_term_id) return false
  return activeTerm.value?.id !== props.classData.academic_term_id
})

const canModify = computed(() => props.role === "DEAN" && !isLocked.value)

function assign(subjectId) {
  emit("assign", { classId: props.classData.id, subjectId })
}

function remove(subjectId) {
  emit("remove", { classId: props.classData.id, subjectId })
}

function close() {
  emit("update:modelValue", false)
}

const filteredSubjects = computed(() => {
  return props.subjects?.filter(s =>
    s.course_code.toLowerCase().includes(search.value.toLowerCase()) ||
    s.description.toLowerCase().includes(search.value.toLowerCase())
  )
})
</script>
