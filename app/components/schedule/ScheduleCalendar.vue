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
            @mousedown.stop="startMove(ev, day.value, $event)"
          >
            {{ ev.label }}
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
import { ref, computed } from "vue"
import type { CSSProperties } from "vue"


/* Emits (typed) */
const emit = defineEmits<{
  (e: "create-range", payload: {
    day: string
    period_start_id: string
    period_end_id: string
  }): void
  (e: "event-drop", payload: {
    id: string
    day: string
    period_start_id: string
    period_end_id: string
  }): void
}>()

/* Props */
const props = defineProps<{
  days: { label: string; value: string }[]
  periods: { id: string; start_time: string; end_time: string; slot_index: number }[]
  events?: any[]
}>()

/* Group Events By Day - TS safe */
const eventsByDay = computed<Record<string, any[]>>(() => {
  const map: Record<string, any[]> = {}

  // initialize buckets
  for (const d of props.days) {
    map[d.value] = []
  }

  // assign events safely
  for (const ev of props.events ?? []) {
    const key = ev?.day as string | undefined
    if (!key) continue
    const bucket = map[key] ?? (map[key] = [])
    bucket.push(ev)
  }

  return map
})

/* Drag State */
const dragState = ref<null | { day: string; startSlot: number; event?: any }>(null)
const dragMode = ref<"CREATE" | "MOVE">("CREATE")
const previewBlock = ref<{ style: Record<string, string> } | null>(null)

const dragging = ref(false)
const dragMin = ref(-1)
const dragMax = ref(-1)

/* ---- Safe DOM helpers ---- */
function safeTarget(evt: MouseEvent): HTMLElement | null {
  return evt.target instanceof HTMLElement ? evt.target : null
}

function getSlotHeight(): number {
  if (typeof window === "undefined") return 50
  const el = document.querySelector(".grid-cell")
  if (el instanceof HTMLElement) {
    return el.offsetHeight || 50
  }
  return 50
}

function getSlot(evt: MouseEvent): number {
  const target = safeTarget(evt)
  if (!target) return -1

  const column = target.closest(".day-column") as HTMLElement | null
  if (!column) return -1

  const rect = column.getBoundingClientRect()
  const height = getSlotHeight()
  const offsetY = evt.clientY - rect.top

  return Math.floor(offsetY / height)
}

/* ---- Create New Schedule ---- */
function startNewDrag(day: string, evt: MouseEvent) {
  const target = safeTarget(evt)
  if (!target) return
  if (!target.closest(".grid-cell")) return // prevent header drag

  const slot = getSlot(evt)
  if (slot < 0) return

  dragMode.value = "CREATE"
  dragState.value = { day, startSlot: slot }
  dragging.value = true
  dragMin.value = slot
  dragMax.value = slot
}

/* ---- Move Existing ---- */
function startMove(ev: any, day: string, evt: MouseEvent) {
  dragMode.value = "MOVE"
  dragState.value = { day, startSlot: ev.startSlot, event: ev }
  dragging.value = true
  dragMin.value = ev.startSlot
  dragMax.value = ev.endSlot

  // initial preview in correct column
  const target = safeTarget(evt)
  const column = target?.closest(".day-column") as HTMLElement | null
  if (column) {
    const height = getSlotHeight()
    previewBlock.value = {
  style: {
    position: "absolute",
    top: `${dragMin.value * height}px`,
    height: `${(dragMax.value - dragMin.value + 1) * height}px`,
    left: "0px",
    right: "0px",
    pointerEvents: "none"
  }
}


  }
}

/* ---- Drag ---- */
function dragMove(evt: MouseEvent) {
  if (!dragState.value) return

  const target = safeTarget(evt)
  const column = target?.closest(".day-column") as HTMLElement | null
  if (!column) return

  const height = getSlotHeight()
  const slot = Math.floor((evt.clientY - column.getBoundingClientRect().top) / height)

  const clamped = Math.max(0, Math.min(slot, props.periods.length - 1))

  // Snap (prevent jitter)
  if (clamped === dragMax.value) return

  dragMin.value = Math.min(dragState.value.startSlot, clamped)
  dragMax.value = Math.max(dragState.value.startSlot, clamped)

  const conflict = hasConflict(dragState.value.day, dragMin.value, dragMax.value)

  previewBlock.value = {
    style: {
      position: "absolute",
      top: `${dragMin.value * height}px`,
      height: `${(dragMax.value - dragMin.value + 1) * height}px`,
      left: "0px",
      right: "0px",
      border: conflict ? "2px solid red" : "2px dashed #2196f3",
      background: conflict ? "rgba(255,0,0,0.15)" : "rgba(33,150,243,0.15)",
      pointerEvents: "none"
    }
  }
}




/* ---- Finish ---- */
function finishDrag(_evt: MouseEvent) {
  if (!dragState.value || dragMin.value < 0 || dragMax.value < 0) {
    resetDrag()
    return
  }

  const day = dragState.value.day ?? ""
  const startPeriod = props.periods[dragMin.value]
  const endPeriod = props.periods[dragMax.value]

  // ✅ Conflict check HERE (inside function)
  const conflict = hasConflict(day, dragMin.value, dragMax.value)
  if (conflict) {
    alert("❌ This time range conflicts with an existing schedule.")
    resetDrag()
    return
  }

  if (dragMode.value === "CREATE") {
    emit("create-range", {
      day,
      period_start_id: startPeriod?.id ?? "",
      period_end_id: endPeriod?.id ?? ""
    })
  } else if (dragState.value.event) {
    emit("event-drop", {
      id: String(dragState.value.event.id),
      day,
      period_start_id: startPeriod?.id ?? "",
      period_end_id: endPeriod?.id ?? ""
    })
  }

  resetDrag()
}




function resetDrag() {
  dragState.value = null
  previewBlock.value = null
  dragging.value = false
  dragMin.value = -1
  dragMax.value = -1
}

/* ---- Display helpers ---- */
function eventStyle(ev: any): CSSProperties {
  const height = getSlotHeight()
  const start = Number(ev.startSlot ?? 0)
  const end = Number(ev.endSlot ?? start)

  return {
    position: "absolute",
    top: `${start * height}px`,
    height: `${(end - start + 1) * height}px`,
    left: "0px",
    right: "0px",
    padding: "4px",
    boxSizing: "border-box", // now typed correctly
    background: ev.subject?.is_gened ? "#ffc107" : "#1e88e5",
    borderRadius: "6px",
    color: "#fff",
    zIndex: 20,
    cursor: "grab"
  }
}

function hasConflict(day: string, start: number, end: number) {
  return (eventsByDay.value[day] ?? []).some(ev => {
    return !(end < ev.startSlot || start > ev.endSlot) // true if overlapping
  })
}




function formatTime(time: string): string {
  if (!time) return ""
  const parts = time.split(":")
  const hStr = parts[0] ?? "0"
  const m = parts[1] ?? "00"
  const hourNum = Number(hStr)
  const suffix = hourNum >= 12 ? "PM" : "AM"
  const displayHour = (hourNum % 12) || 12
  return `${displayHour}:${m} ${suffix}`
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
  border-bottom: 1px solid #ddd;
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
  color: #555;
}

.calendar-columns {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
}

.day-column {
  position: relative;
  border-right: 1px solid #eee;
}

.grid-cell {
  height: 50px;
  border-bottom: 1px solid #f5f5f5;
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



/* Events */
.event {
  position: absolute;
  left: 2px;
  right: 2px;
  color: #fff;
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
