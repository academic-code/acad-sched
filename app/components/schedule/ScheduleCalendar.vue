<template>
  <div class="schedule-calendar">
    <!-- Header -->
    <div class="calendar-header">
      <div class="time-column"></div>
      <div v-for="day in days" :key="day.value" class="day-header">
        {{ day.label }}
      </div>
    </div>

    <!-- Grid -->
    <div class="calendar-grid">
      <!-- Time Column -->
      <div class="time-column">
        <div
          v-for="slot in periods"
          :key="slot.id"
          class="time-label"
        >
          {{ formatTime(slot.start_time) }} – {{ formatTime(slot.end_time) }}
        </div>
      </div>

      <!-- Day Columns -->
      <div class="calendar-columns">
        <div
          v-for="day in days"
          :key="day.value"
          class="day-column"
          @mousedown="startNewDrag(day.value, $event)"
          @mouseup="finishDrag"
          @mousemove="dragMove"
        >
          <!-- Base grid -->
          <div
            v-for="slot in periods"
            :key="slot.id"
            class="grid-cell"
          />

          <!-- Events -->
          <div
            v-for="ev in eventsByDay[day.value] || []"
            :key="ev.id"
            class="event"
            :style="eventStyle(ev)"
            @mousedown.stop="startMove(ev, day.value)"
            @dblclick.stop="openEditor(ev)"
          >
            <div class="event-title">
              {{ ev.subject_code }}
            </div>

            <div class="event-desc">
              {{ ev.subject_desc }}
            </div>

            <div class="event-meta">
              {{ modeLabel(ev.mode) }}
              <span v-if="ev.faculty_name"> • {{ ev.faculty_name }}</span>
            </div>

            <!-- Resize Handles -->
            <div
              class="resize-handle top"
              @mousedown.stop="startResize(ev, day.value, 'top', $event)"
            />
            <div
              class="resize-handle bottom"
              @mousedown.stop="startResize(ev, day.value, 'bottom', $event)"
            />
          </div>

          <!-- Drag Preview -->
          <div
            v-if="previewBlock && dragState?.day === day.value"
            class="preview-event"
            :style="previewBlock.style"
          >
            {{ formatTime(periods[dragMin]?.start_time ?? "") }}
            –
            {{ formatTime(periods[dragMax]?.end_time ?? "") }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue"
import type { CSSProperties } from "vue"

const emit = defineEmits<{
  (e: "create-range", payload: { day: string; period_start_id: string; period_end_id: string }): void
  (e: "event-drop", payload: { id: string; day: string; period_start_id: string; period_end_id: string }): void
  (e: "open-editor", payload: { id: string }): void
}>()

const props = defineProps<{
  days: { label: string; value: string }[]
  periods: { id: string; start_time: string; end_time: string; slot_index: number }[]
  events?: any[]
}>()

/* ---------------- EVENTS BY DAY ---------------- */
const eventsByDay = computed(() => {
  const map: Record<string, any[]> = {}
  props.days.forEach(d => (map[d.value] = []))
  ;(props.events ?? []).forEach(ev => ev?.day && map[ev.day]?.push(ev))
  return map
})

/* ---------------- DRAG STATE ---------------- */
const dragState = ref<null | { day: string; startSlot: number; event?: any }>(null)
const dragMode = ref<"CREATE" | "MOVE" | "RESIZE">("CREATE")
const dragging = ref(false)
const dragMin = ref(-1)
const dragMax = ref(-1)
const resizeSide = ref<"top" | "bottom" | null>(null)

const previewBlock = ref<{ style: Record<string, string> } | null>(null)

/* ---------------- HELPERS ---------------- */
const getSlotHeight = () =>
  (document.querySelector(".grid-cell") as HTMLElement)?.offsetHeight ?? 50

const safeTarget = (e: MouseEvent) =>
  e.target instanceof HTMLElement ? e.target : null

function getSlot(evt: MouseEvent) {
  const col = safeTarget(evt)?.closest(".day-column") as HTMLElement
  if (!col) return -1
  return Math.floor((evt.clientY - col.getBoundingClientRect().top) / getSlotHeight())
}

/* ---------------- CREATE ---------------- */
function startNewDrag(day: string, evt: MouseEvent) {
  if (!safeTarget(evt)?.closest(".grid-cell")) return
  const slot = getSlot(evt)
  dragState.value = { day, startSlot: slot }
  dragMode.value = "CREATE"
  dragging.value = true
  dragMin.value = dragMax.value = slot
}

/* ---------------- MOVE / RESIZE ---------------- */
function startMove(ev: any, day: string) {
  dragState.value = { day, startSlot: ev.startSlot, event: ev }
  dragMode.value = "MOVE"
  dragging.value = true
  dragMin.value = ev.startSlot
  dragMax.value = ev.endSlot
}

function startResize(ev: any, day: string, side: "top" | "bottom", evt: MouseEvent) {
  dragState.value = { day, startSlot: ev.startSlot, event: ev }
  dragMode.value = "RESIZE"
  resizeSide.value = side
  dragging.value = true
  dragMin.value = ev.startSlot
  dragMax.value = ev.endSlot
}

function dragMove(evt: MouseEvent) {
  if (!dragState.value) return
  const slot = Math.max(0, Math.min(getSlot(evt), props.periods.length - 1))

  if (dragMode.value === "RESIZE") {
    if (resizeSide.value === "top") dragMin.value = Math.min(slot, dragMax.value - 1)
    else dragMax.value = Math.max(slot, dragMin.value + 1)
  } else {
    dragMin.value = Math.min(dragState.value.startSlot, slot)
    dragMax.value = Math.max(dragState.value.startSlot, slot)
  }

  const h = getSlotHeight()
  previewBlock.value = {
    style: {
      top: `${dragMin.value * h}px`,
      height: `${(dragMax.value - dragMin.value + 1) * h}px`
    }
  }
}

function finishDrag() {
  if (!dragState.value) return resetDrag()

  const start = props.periods[dragMin.value]
  const end = props.periods[dragMax.value]
  if (!start || !end) return resetDrag()

  if (dragMode.value === "CREATE") {
    emit("create-range", { day: dragState.value.day, period_start_id: start.id, period_end_id: end.id })
  }

  if (dragState.value.event) {
    emit("event-drop", {
      id: dragState.value.event.id,
      day: dragState.value.day,
      period_start_id: start.id,
      period_end_id: end.id
    })
  }

  resetDrag()
}

function resetDrag() {
  dragState.value = null
  dragging.value = false
  resizeSide.value = null
  previewBlock.value = null
  dragMin.value = dragMax.value = -1
}

/* ---------------- DISPLAY ---------------- */
function eventStyle(ev: any): CSSProperties {
  const h = getSlotHeight()
  const color =
    ev.mode === "F2F" ? "#fbc02d" :
    ev.mode === "ASYNC" ? "#43a047" :
    "#1e88e5"

  return {
    top: `${ev.startSlot * h}px`,
    height: `${(ev.endSlot - ev.startSlot + 1) * h}px`,
    background: color
  }
}

function modeLabel(mode: string) {
  return mode === "F2F" ? "Face-to-Face" : mode === "ASYNC" ? "Asynchronous" : "Online"
}

function formatTime(t: string) {
  const [h, m] = t.split(":")
  const hh = Number(h)
  return `${hh % 12 || 12}:${m} ${hh >= 12 ? "PM" : "AM"}`
}

function openEditor(ev: any) {
  emit("open-editor", { id: ev.id })
}

onMounted(() => window.addEventListener("keydown", e => e.key === "Escape" && resetDrag()))
onUnmounted(() => window.removeEventListener("keydown", resetDrag))
</script>

<style scoped>
.schedule-calendar {
  width: 100%;
}

.calendar-header {
  display: grid;
  grid-template-columns: 110px repeat(6, 1fr);
  font-weight: 600;
}

.time-column {
  width: 110px;
}

.time-label {
  height: 50px;
  font-size: 11px;
  display: flex;
  align-items: center;
  padding-left: 6px;
}

.calendar-columns {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
}

.day-column {
  position: relative;
  border-left: 1px solid #dcedc8;
}

.grid-cell {
  height: 50px;
  border-bottom: 1px solid #e8f5e9;
}

.event {
  position: absolute;
  left: 4px;
  right: 4px;
  padding: 6px;
  color: #fff;
  border-radius: 8px;
  font-size: 12px;
  box-sizing: border-box;
}

.event-title {
  font-weight: 700;
}

.event-desc {
  font-size: 11px;
  opacity: 0.95;
}

.event-meta {
  font-size: 10px;
  margin-top: 2px;
  opacity: 0.9;
}

.resize-handle {
  position: absolute;
  left: 0;
  right: 0;
  height: 6px;
  cursor: row-resize;
}
.resize-handle.top { top: -3px; }
.resize-handle.bottom { bottom: -3px; }

.preview-event {
  position: absolute;
  left: 4px;
  right: 4px;
  border: 2px dashed #2196f3;
  background: rgba(33,150,243,.15);
  border-radius: 6px;
}
</style>
