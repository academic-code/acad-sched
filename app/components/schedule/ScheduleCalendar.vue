<template>
  <div class="schedule-calendar">
    <!-- LEGEND -->
    <div class="legend">
      <span class="legend-item f2f">
        <v-icon size="14">mdi-account-group</v-icon> Face to Face
      </span>
      <span class="legend-item online">
        <v-icon size="14">mdi-web</v-icon> Online
      </span>
      <span class="legend-item async">
        <v-icon size="14">mdi-clock-outline</v-icon> Asynchronous
      </span>
    </div>

    <!-- HEADER -->
    <div class="calendar-header">
      <div class="time-column"></div>
      <div v-for="d in days" :key="d.value" class="day-header">
        {{ d.label }}
      </div>
    </div>

    <!-- GRID -->
    <div class="calendar-grid">
      <!-- TIME -->
      <div class="time-column">
        <div v-for="p in periods" :key="p.id" class="time-label">
          {{ formatRange(p.start_time, p.end_time) }}
        </div>
      </div>

      <!-- DAYS -->
      <div class="calendar-columns">
        <div
          v-for="day in days"
          :key="day.value"
          class="day-column"
          @mousedown="startCreate(day.value, $event)"
          @mousemove="dragMove"
          @mouseup="finishDrag"
        >
          <div v-for="p in periods" :key="p.id" class="grid-cell" />

          <!-- EVENTS -->
          <div
            v-for="ev in eventsByDay[day.value]"
            :key="ev.id"
            class="event"
            :class="modeClass(ev.mode)"
            :style="eventStyle(ev)"
            @mousedown.stop="startMove(ev, day.value)"
            @dblclick.stop="emit('open-editor', { id: ev.id })"
          >
            <div class="event-code">{{ ev.subject?.course_code }}</div>

            <div class="event-body">
              <div class="event-title">{{ ev.subject?.description }}</div>

              <div class="event-meta">
                <v-icon size="14">{{ modeIcon(ev.mode) }}</v-icon>
                {{ modeLabel(ev.mode) }}

                <span v-if="ev.faculty">
                  · {{ ev.faculty.last_name }}, {{ ev.faculty.first_name }}
                </span>

                <span v-if="ev.class_name">
                  · {{ ev.class_name }}
                </span>
              </div>
            </div>

            <!-- RESIZE -->
            <div class="resize top" @mousedown.stop="startResize(ev, day.value, 'top')" />
            <div class="resize bottom" @mousedown.stop="startResize(ev, day.value, 'bottom')" />
          </div>

          <!-- PREVIEW -->
          <div
            v-if="preview && dragDay === day.value"
            class="preview"
            :class="{ conflict: previewConflict }"
            :style="previewStyle"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import type { CSSProperties } from "vue"

const emit = defineEmits(["create-range", "event-drop", "open-editor", "conflict"])

const props = defineProps<{
  days: { label: string; value: string }[]
  periods: { id: string; start_time: string; end_time: string; slot_index: number }[]
  events: any[]
}>()

/* CONSTANTS */
const rowHeight = 50

/* DRAG STATE */
const dragging = ref(false)
const dragMode = ref<"CREATE" | "MOVE" | "RESIZE" | null>(null)
const dragEvent = ref<any>(null)
const dragDay = ref<string | null>(null)
const startSlot = ref(0)
const endSlot = ref(0)
const resizeSide = ref<"top" | "bottom" | null>(null)

/* EVENTS BY DAY */
const eventsByDay = computed(() => {
  const map: Record<string, any[]> = {}
  props.days.forEach(d => (map[d.value] = []))
  props.events.forEach(ev => map[ev.day]?.push(ev))
  return map
})

function getSlot(e: MouseEvent, col: HTMLElement) {
  const y = e.clientY - col.getBoundingClientRect().top
  return Math.max(0, Math.min(props.periods.length - 1, Math.floor(y / rowHeight)))
}

function hasConflict(day: string, s: number, e: number, ignoreId?: string) {
  return eventsByDay.value[day]?.some(ev =>
    ev.id !== ignoreId && !(e < ev.startSlot || s > ev.endSlot)
  )
}

/* CREATE */
function startCreate(day: string, e: MouseEvent) {
  if (!(e.target as HTMLElement).classList.contains("grid-cell")) return
  dragging.value = true
  dragMode.value = "CREATE"
  dragDay.value = day
  startSlot.value = endSlot.value = getSlot(e, e.currentTarget as HTMLElement)
}

/* MOVE */
function startMove(ev: any, day: string) {
  dragging.value = true
  dragMode.value = "MOVE"
  dragEvent.value = ev
  dragDay.value = day
  startSlot.value = ev.startSlot
  endSlot.value = ev.endSlot
}

/* RESIZE */
function startResize(ev: any, day: string, side: "top" | "bottom") {
  dragging.value = true
  dragMode.value = "RESIZE"
  dragEvent.value = ev
  dragDay.value = day
  resizeSide.value = side
  startSlot.value = ev.startSlot
  endSlot.value = ev.endSlot
}

/* DRAG */
function dragMove(e: MouseEvent) {
  if (!dragging.value || !dragDay.value) return
  const col = (e.target as HTMLElement).closest(".day-column") as HTMLElement
  if (!col) return
  const slot = getSlot(e, col)

  if (dragMode.value === "RESIZE") {
    resizeSide.value === "top"
      ? (startSlot.value = Math.min(slot, endSlot.value - 1))
      : (endSlot.value = Math.max(slot, startSlot.value + 1))
  } else {
    endSlot.value = slot
  }
}

/* DROP */
function finishDrag() {
  if (!dragging.value || !dragDay.value) return reset()

  const s = Math.min(startSlot.value, endSlot.value)
  const e = Math.max(startSlot.value, endSlot.value)

  if (hasConflict(dragDay.value, s, e, dragEvent.value?.id)) {
    emit("conflict")
    return reset()
  }

  const startP = props.periods[s]
  const endP = props.periods[e]
  if (!startP || !endP) return reset()

  if (dragMode.value === "CREATE") {
    emit("create-range", { day: dragDay.value, period_start_id: startP.id, period_end_id: endP.id })
  } else if (dragEvent.value) {
    emit("event-drop", { id: dragEvent.value.id, day: dragDay.value, period_start_id: startP.id, period_end_id: endP.id })
  }

  reset()
}

function reset() {
  dragging.value = false
  dragMode.value = null
  dragEvent.value = null
  dragDay.value = null
  resizeSide.value = null
}

/* PREVIEW */
const preview = computed(() => dragging.value)
const previewConflict = computed(() =>
  dragDay.value ? hasConflict(dragDay.value, startSlot.value, endSlot.value, dragEvent.value?.id) : false
)
const previewStyle = computed<CSSProperties>(() => ({
  top: `${Math.min(startSlot.value, endSlot.value) * rowHeight}px`,
  height: `${(Math.abs(endSlot.value - startSlot.value) + 1) * rowHeight}px`
}))

function eventStyle(ev: any): CSSProperties {
  return {
    top: `${ev.startSlot * rowHeight}px`,
    height: `${(ev.endSlot - ev.startSlot + 1) * rowHeight}px`
  }
}

/* HELPERS */
function formatRange(s: string, e: string) {
  return `${fmt(s)} – ${fmt(e)}`
}
function fmt(t: string) {
  const [h, m] = t.split(":")
  const hh = Number(h)
  return `${hh % 12 || 12}:${m} ${hh >= 12 ? "PM" : "AM"}`
}

function modeClass(m: string) {
  return m === "F2F" ? "f2f" : m === "ASYNC" ? "async" : "online"
}
function modeLabel(m: string) {
  return m === "F2F" ? "Face to Face" : m === "ASYNC" ? "Asynchronous" : "Online"
}
function modeIcon(m: string) {
  return m === "F2F" ? "mdi-account-group" : m === "ASYNC" ? "mdi-clock-outline" : "mdi-web"
}
</script>


<style scoped>
/* EXACT UI YOU LIKE */
.legend { display:flex; gap:12px; margin-bottom:10px }
.legend-item { padding:4px 10px; border-radius:6px; font-size:12px; font-weight:600 }
.f2f{background:#fbc02d;color:#000}
.online{background:#1e88e5;color:#fff}
.async{background:#43a047;color:#fff}

.calendar-header{display:grid;grid-template-columns:120px repeat(6,1fr)}
.day-header{text-align:center;font-weight:600}
.calendar-grid{display:flex}
.time-column{width:120px}
.time-label{height:50px;font-size:11px;display:flex;align-items:center;justify-content:center}

.calendar-columns{display:grid;grid-template-columns:repeat(6,1fr);flex:1}
.day-column{position:relative}
.grid-cell{height:50px;border-bottom:1px solid #e0f2e9}

.event{position:absolute;left:4px;right:4px;border-radius:8px;padding:6px;color:#fff;font-size:12px;cursor:pointer}
.event.f2f{background:#fbc02d;color:#000}
.event.online{background:#1e88e5}
.event.async{background:#43a047}

.event-code{font-weight:700}
.event-title{font-size:11px}
.event-meta{font-size:10px;opacity:.9}

.resize{position:absolute;left:0;right:0;height:6px;cursor:row-resize}
.resize.top{top:-3px}
.resize.bottom{bottom:-3px}

.preview{position:absolute;left:4px;right:4px;border:2px dashed #2196f3;background:rgba(33,150,243,.15);border-radius:8px}
.preview.conflict{border-color:red;background:rgba(255,0,0,.15)}
</style>