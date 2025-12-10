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
        <div v-for="slot in periods" :key="slot.id" class="time-label">
          {{ formatTime(slot.start_time) }}
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
></div>

<!-- Unified highlight overlay -->
<div
  v-if="dragging && dragState?.day === day.value"
  class="highlight-block"
  :style="{
    top: `${dragMin * getSlotHeight()}px`,
    height: `${(dragMax - dragMin + 1) * getSlotHeight()}px`
  }"
></div>




          <!-- Events -->
          <div
            v-for="ev in (eventsByDay[String(day.value)] || [])"
            :key="ev.id"
            class="event"
            :style="eventStyle(ev)"
          >
            <span 
              class="event-label"
              @mousedown.stop="startMove(ev, day.value)"
              @dblclick.stop="openEditor(ev)"
            >
              {{ ev.label }}
            </span>


            <!-- Resize handles -->
            <div class="resize-handle top" @mousedown.stop="startResize(ev, day.value, 'top', $event)"></div>
            <div class="resize-handle bottom" @mousedown.stop="startResize(ev, day.value, 'bottom', $event)"></div>
          </div>


          <!-- 👇 NEW FIXED PREVIEW HERE -->
          <div 
            v-if="previewBlock && dragState?.day === day.value"
            class="preview-event"
            :style="previewBlock.style"
          >
            {{ dragMode === "MOVE" ? "Move:" : "New Time Schedule:" }}
            {{ formatTime(periods[dragMin]?.start_time ?? "") }} - 
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

/* Emits */
const emit = defineEmits<{
  (e: "create-range", payload: { day: string; period_start_id: string; period_end_id: string }): void
  (e: "event-drop", payload: { id: string; day: string; period_start_id: string; period_end_id: string }): void
  (e: "open-editor", payload: { id: string }): void
}>()


/* Props */
const props = defineProps<{
  days: { label: string; value: string }[]
  periods: { id: string; start_time: string; end_time: string; slot_index: number }[]
  events?: any[]
}>()

/* Group events by day */
const eventsByDay = computed(() => {
  const map: Record<string, any[]> = {}
  props.days.forEach(d => (map[d.value] = []))
  ;(props.events ?? []).forEach(ev => ev?.day && map[ev.day]?.push(ev))
  return map
})

/* Drag State */
const dragState = ref<null | { day: string; startSlot: number; event?: any }>(null)

type DragMode = "CREATE" | "MOVE" | "RESIZE"
const dragMode = ref<DragMode>("CREATE")


const previewBlock = ref<{ style: Record<string, string>; class?: string } | null>(null)

const dragging = ref(false)
const dragMin = ref(-1)
const dragMax = ref(-1)

function safeTarget(evt: MouseEvent): HTMLElement | null {
  return evt.target instanceof HTMLElement ? evt.target : null
}

function getSlotHeight() {
  const el = document.querySelector(".grid-cell") as HTMLElement | null
  return el?.offsetHeight ?? 50
}

function getSlot(evt: MouseEvent): number {
  const target = safeTarget(evt)
  const column = target?.closest(".day-column") as HTMLElement | null
  if (!column) return -1
  const height = getSlotHeight()
  return Math.floor((evt.clientY - column.getBoundingClientRect().top) / height)
}

/* Create new schedule */
function startNewDrag(day: string, evt: MouseEvent) {
  if (!(safeTarget(evt)?.closest(".grid-cell"))) return
  const slot = getSlot(evt)
  dragMode.value = "CREATE"
  dragState.value = { day, startSlot: slot }
  dragging.value = true
  dragMin.value = slot
  dragMax.value = slot
}

// ⬇️ ADD HERE (inside script)
function openEditor(ev: any) {
  emit("open-editor", { id: ev.id })
}


/* Move existing schedule */
function startMove(ev: any, day: string) {
  dragMode.value = "MOVE"
  dragState.value = { day, startSlot: ev.startSlot, event: ev }
  dragging.value = true
  dragMin.value = ev.startSlot
  dragMax.value = ev.endSlot
}

/* ---- Resize Existing Schedule ---- */
function startResize(ev: any, day: string, direction: "top" | "bottom", evt: MouseEvent) {
  dragMode.value = "RESIZE"
  dragState.value = { day, startSlot: ev.startSlot, event: ev }
  dragging.value = true

  dragMin.value = ev.startSlot
  dragMax.value = ev.endSlot

  // Remember which side we're dragging
  resizeSide.value = direction
}

const resizeSide = ref<"top" | "bottom" | null>(null)


/* Auto-scroll on drag */
let scrollInterval: any = null

function enableAutoScroll(evt: MouseEvent) {
  clearInterval(scrollInterval)
  const threshold = 60
  const speed = 6

  scrollInterval = setInterval(() => {
    if (evt.clientY < threshold) window.scrollBy(0, -speed)
    if (evt.clientY > window.innerHeight - threshold) window.scrollBy(0, speed)
  }, 16)
}

/* Drag Update */
function dragMove(evt: MouseEvent) {
  if (!dragState.value) return
  enableAutoScroll(evt)

  const target = safeTarget(evt)
  const column = target?.closest(".day-column") as HTMLElement | null
  if (!column) return

  const height = getSlotHeight()
  const slot = Math.floor((evt.clientY - column.getBoundingClientRect().top) / height)
  const clamped = Math.max(0, Math.min(slot, props.periods.length - 1))

  if (dragMode.value === "RESIZE") {
  if (resizeSide.value === "top") dragMin.value = Math.min(clamped, dragMax.value - 1)
  if (resizeSide.value === "bottom") dragMax.value = Math.max(clamped, dragMin.value + 1)
} else {
  dragMin.value = Math.min(dragState.value.startSlot, clamped)
  dragMax.value = Math.max(dragState.value.startSlot, clamped)
}




  const conflict = hasConflict(dragState.value.day, dragMin.value, dragMax.value)

  previewBlock.value = {
    style: {
      position: "absolute",
      top: `${dragMin.value * height}px`,
      height: `${(dragMax.value - dragMin.value + 1) * height}px`,
      left: "0px",
      right: "0px",
      border: conflict ? "2px solid red" : "2px dashed #2196f3",
      background: conflict ? "rgba(255,0,0,0.15)" : "rgba(33,150,243,0.15)"
    }
  }
}

/* Finish Drag */
function finishDrag() {
  clearInterval(scrollInterval)

  if (!dragState.value || dragMin.value < 0 || dragMax.value < 0) {
    return resetDrag()
  }

  const conflict = hasConflict(dragState.value.day, dragMin.value, dragMax.value)
  if (conflict) return resetDrag()

  const startPeriod = props.periods[dragMin.value]
  const endPeriod = props.periods[dragMax.value]

  // === CREATE NEW ===
  if (dragMode.value === "CREATE") {
    emit("create-range", {
      day: dragState.value.day,
      period_start_id: startPeriod?.id ?? "",
      period_end_id: endPeriod?.id ?? ""
    })
  }

  // === MOVE OR RESIZE EVENT ===
  if ((dragMode.value === "MOVE" || dragMode.value === "RESIZE") && dragState.value.event) {
    emit("event-drop", {
      id: String(dragState.value.event.id),
      day: dragState.value.day,
      period_start_id: startPeriod?.id ?? "",
      period_end_id: endPeriod?.id ?? ""
    })
  }

  resetDrag()
}


/* Cancel drag + Fade animation */
function resetDrag() {
  if (previewBlock.value) {
    previewBlock.value.class = "fade-out"
    setTimeout(() => (previewBlock.value = null), 150)
  }

  dragState.value = null
  dragging.value = false
  resizeSide.value = null
  dragMode.value = "CREATE"
  dragMin.value = dragMax.value = -1
}


/* Check overlap */
function hasConflict(day: string, start: number, end: number) {
  return (eventsByDay.value[day] ?? []).some(ev => !(end < ev.startSlot || start > ev.endSlot))
}

/* ESC → Cancel drag */
const cancelDrag = (e: KeyboardEvent) => e.key === "Escape" && resetDrag()
onMounted(() => window.addEventListener("keydown", cancelDrag))
onUnmounted(() => window.removeEventListener("keydown", cancelDrag))

/* Event style */
function eventStyle(ev: any): CSSProperties {
  const height = getSlotHeight()
  return {
    position: "absolute",
    top: `${ev.startSlot * height}px`,
    height: `${(ev.endSlot - ev.startSlot + 1) * height}px`,
    left: "0px",
    right: "0px",
    cursor: "grab",
    padding: "4px",
    background: ev.subject?.is_gened ? "#ffc107" : "#1e88e5",
    borderRadius: "6px",
    color: "#fff",
    boxSizing: "border-box"
  }
}

/* Format time */
function formatTime(t: string) {
  if (!t) return ""
  const [h, m] = t.split(":")
  const hh = Number(h)
  return `${hh % 12 || 12}:${m} ${hh >= 12 ? "PM" : "AM"}`
}
</script>


<style scoped>
.schedule-calendar {
  width: 100%;
  user-select: none;
}

/* Header */
.calendar-header {
  display: grid;
  grid-template-columns: 90px repeat(6, 1fr);
  font-weight: 600;
  border-bottom: 1px solid #147421;
}

.day-header {
  text-align: center;
  padding: 4px 0;
}

/* Grid */
.calendar-grid {
  display: flex;
}

.time-column {
  width: 90px;
}

.time-label {
  height: 50px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 11px;
  color: #0b8d12;
}

.calendar-columns {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
}

.day-column {
  position: relative;
  border-right: 1px solid #2c750a;
}

.grid-cell {
  height: 50px;
  border-bottom: 1px solid #115f0a;
}

.grid-cell.highlight {
  background: rgba(0, 122, 255, 0.1);
}

.highlight-block {
  position: absolute;
  left: 0;
  right: 0;
  background: rgba(0,122,255,0.12);
  border: 2px dashed #2196f3;
  border-radius: 6px;
  pointer-events: none;
  z-index: 10;
}

/* Hover highlight */
.grid-cell:hover {
  background: rgba(0, 122, 255, 0.06);
  transition: background 0.15s ease;
}


.resize-handle {
  position: absolute;
  left: 0;
  right: 0;
  height: 6px;
  cursor: row-resize;
  z-index: 100;
}

.resize-handle.top {
  top: -3px;
}

.resize-handle.bottom {
  bottom: -3px;
}


/* Fade-out animation */
.preview-event.fade-out {
  opacity: 0;
  transform: scale(0.98);
  transition: opacity .15s ease, transform .15s ease;
}

/* 🔥 Resize handles show only on hover instead of always visible */
.event:hover .resize-handle {
  opacity: 1;
}

.resize-handle {
  opacity: 0;
  transition: opacity .15s ease;
}




/* Events */
.event {
  position: absolute;
  left: 2px;
  right: 2px;
  color: #1337da;
  padding: 4px;
  border-radius: 6px;
  font-size: 12px;
  box-sizing: border-box;
  cursor: pointer;
}

/* Drag Preview */
.preview-event {
  position: absolute;
  border: 2px dashed #2196f3;
  background: rgba(33, 150, 243, 0.15);
  border-radius: 6px;
  pointer-events: none;
  z-index: 50;
  box-sizing: border-box;
}

</style>
