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
          <!-- Time grid cells -->
          <div
            v-for="(slot, i) in periods"
            :key="slot.id"
            class="grid-cell"
            :class="{ highlight: dragging && i >= dragMin && i <= dragMax }"
          ></div>

          <!-- Events -->
          <div
            v-for="ev in (eventsByDay[day.value] || [])"
            :key="ev.id"
            class="event"
            :style="eventStyle(ev)"
            @mousedown.stop="startMove(ev, day.value, $event)"
          >
            {{ ev.label }}
          </div>
        </div>
      </div>
    </div>

    <!-- Drag Preview -->
    <div v-if="previewBlock" class="preview-event" :style="previewBlock.style">
      {{ dragMode === 'MOVE' ? 'Move...' : 'New Schedule' }}
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"

/* Emits */
const emit = defineEmits<{
  (e: "create-range", payload: { day: string; period_start_id: string; period_end_id: string }): void
  (e: "event-drop", payload: { id: string; day: string; period_start_id: string; period_end_id: string }): void
}>()

/* Props */
const props = defineProps<{
  days: { label: string; value: string }[]
  periods: { id: string; start_time: string; end_time: string; slot_index: number }[]
  events?: any[]
}>()

/* Group Events by Day */
const eventsByDay = computed(() => {
  const map: Record<string, any[]> = {}
  props.days.forEach(d => (map[d.value] = []))
  ;(props.events ?? []).forEach(ev => {
    if (ev?.day && map?.[ev.day]) {
  map[ev.day]!.push(ev)
}
  })
  return map
})

/* Drag State */
const dragState = ref<null | { day: string; startSlot: number; event?: any }>(null)
const dragMode = ref<"CREATE" | "MOVE">("CREATE")
const previewBlock = ref<{ style: Record<string, string> } | null>(null)
const dragging = ref(false)
const dragMin = ref(-1)
const dragMax = ref(-1)

/* Helpers */
const safeTarget = (evt: MouseEvent) =>
  evt.target instanceof HTMLElement ? evt.target : null

const getSlotHeight = () => {
  const el = document.querySelector(".grid-cell")
  return (el as HTMLElement | null)?.offsetHeight ?? 50
}


function getSlot(evt: MouseEvent): number {
  const t = safeTarget(evt)
  const col = t?.closest(".day-column") as HTMLElement | null
  if (!col) return -1
  const rect = col.getBoundingClientRect()
  return Math.floor((evt.clientY - rect.top) / getSlotHeight())
}

/* Start Create */
function startNewDrag(day: string, evt: MouseEvent) {
  const t = safeTarget(evt)
  if (!t?.closest(".grid-cell")) return

  const slot = getSlot(evt)
  if (slot < 0) return

  dragMode.value = "CREATE"
  dragState.value = { day, startSlot: slot }
  dragging.value = true
  dragMin.value = slot
  dragMax.value = slot
}

/* Start Move */
function startMove(ev: any, day: string, evt: MouseEvent) {
  dragMode.value = "MOVE"
  dragState.value = { day, startSlot: ev.startSlot, event: ev }
  dragging.value = true
  dragMin.value = ev.startSlot
  dragMax.value = ev.endSlot

  const t = safeTarget(evt)
  const col = t?.closest(".day-column") as HTMLElement | null
  const parent = col?.parentElement as HTMLElement | null
  if (!col || !parent) return

  const height = getSlotHeight()
  previewBlock.value = {
    style: {
      top: `${dragMin.value * height}px`,
      height: `${(dragMax.value - dragMin.value + 1) * height}px`,
      left: `${col.offsetLeft - parent.offsetLeft}px`,
      width: `${col.offsetWidth}px`
    }
  }
}

/* Move Drag */
function dragMove(evt: MouseEvent) {
  if (!dragState.value) return

  const t = safeTarget(evt)
  const col = t?.closest(".day-column") as HTMLElement | null
  const parent = col?.parentElement as HTMLElement | null
  if (!col || !parent) return

  const height = getSlotHeight()
  const slot = Math.max(0, Math.min(getSlot(evt), props.periods.length - 1))
  dragMin.value = Math.min(dragState.value.startSlot, slot)
  dragMax.value = Math.max(dragState.value.startSlot, slot)

  previewBlock.value = {
    style: {
      top: `${dragMin.value * height}px`,
      height: `${(dragMax.value - dragMin.value + 1) * height}px`,
      left: `${col.offsetLeft - parent.offsetLeft}px`,
      width: `${col.offsetWidth}px`
    }
  }
}

/* Finish Drag */
function finishDrag() {
  if (!dragState.value) return resetDrag()

  const start = props.periods[dragMin.value]
  const end = props.periods[dragMax.value]
  if (!start || !end) return resetDrag()

  if (dragMode.value === "CREATE") {
    emit("create-range", { day: dragState.value.day, period_start_id: start.id, period_end_id: end.id })
  } else if (dragState.value.event) {
    emit("event-drop", { id: dragState.value.event.id, day: dragState.value.day, period_start_id: start.id, period_end_id: end.id })
  }

  resetDrag()
}

/* Reset */
function resetDrag() {
  dragState.value = null
  previewBlock.value = null
  dragging.value = false
  dragMin.value = -1
  dragMax.value = -1
}

/* Style for events */
function eventStyle(ev: any) {
  const height = getSlotHeight()
  return {
    top: `${ev.startSlot * height}px`,
    height: `${(ev.endSlot - ev.startSlot + 1) * height}px`,
    background: ev.subject?.is_gened ? "#ffc107" : "#1e88e5"
  }
}

function formatTime(time: string) {
  if (!time) return ""
  const parts = time.split(":")
  const h = parts[0] ?? "0"
  const m = parts[1] ?? "00"
  const hour = Number(h)
  return `${(hour % 12 || 12)}:${m} ${hour >= 12 ? "PM" : "AM"}`
}

</script>

<style scoped>
.schedule-calendar { width: 100%; user-select: none; }

/* Header */
.calendar-header {
  display: grid;
  grid-template-columns: 90px repeat(6, 1fr);
  font-weight: 600;
  border-bottom: 1px solid #ddd;
}

.day-header { text-align: center; padding: 4px 0; }

/* Grid Machine */
.calendar-grid { display: flex; }
.time-column { width: 90px; position: sticky; left: 0; background: white; z-index: 5; }

.time-label {
  height: 50px;
  display:flex;
  justify-content:center;
  align-items:center;
  font-size:11px;
  color:#555;
}

/* Fix Layout Width */
.calendar-columns {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px,1fr));
  position: relative;
}

.day-column {
  position: relative;
  border-right:1px solid #eee;
}

/* Cells */
.grid-cell {
  height:50px;
  border-bottom:1px solid #f5f5f5;
}

.grid-cell.highlight { background:rgba(0,122,255,0.1); }

/* Events */
.event {
  position:absolute;
  left:2px; right:2px;
  color:#fff;
  padding:4px;
  border-radius:6px;
  font-size:12px;
  cursor:pointer;
}

/* Drag Preview */
.preview-event {
  position:absolute;
  border:2px dashed #2196f3;
  background:rgba(33,150,243,0.25);
  border-radius:6px;
  pointer-events:none;
  z-index:10;
}
</style>
