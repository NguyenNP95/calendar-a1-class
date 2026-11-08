<script setup>
import { nextTick, ref, watch } from 'vue'
import { formatDayMonth, weekdayName } from '../utils/dates.js'
import { eventTitle } from '../utils/events.js'
import { formatVnDate } from '../utils/people.js'
import Avatar from './Avatar.vue'

const props = defineProps({
  // { event, x, y }
  payload: { type: Object, required: true },
})

const el = ref(null)
const pos = ref({ left: 0, top: 0 })
const GAP = 14

// Bám theo chuột, tự lật sang trái / lên trên khi chạm mép màn hình.
watch(
  () => [props.payload.x, props.payload.y, props.payload.event.id],
  async () => {
    await nextTick()
    const w = el.value?.offsetWidth || 260
    const h = el.value?.offsetHeight || 100
    const { x, y } = props.payload
    let left = x + GAP
    let top = y + GAP
    if (left + w > window.innerWidth - 8) left = x - w - GAP
    if (top + h > window.innerHeight - 8) top = y - h - GAP
    pos.value = { left: Math.max(8, left), top: Math.max(8, top) }
  },
  { immediate: true },
)
</script>

<template>
  <div
    ref="el"
    class="pointer-events-none fixed z-40 w-64 rounded-2xl bg-ink p-3 text-sm text-paper shadow-card"
    :style="{ left: pos.left + 'px', top: pos.top + 'px' }"
    role="tooltip"
  >
    <div class="flex items-center gap-2.5">
      <Avatar :person="payload.event.person" size="sm" />
      <div class="min-w-0">
        <p class="truncate font-semibold">{{ payload.event.person.name }}</p>
        <p class="text-xs text-paper/70">{{ eventTitle(payload.event) }}</p>
      </div>
    </div>
    <p class="mt-2 text-xs text-paper/70">
      {{ weekdayName(payload.event.date) }}, {{ formatDayMonth(payload.event.date) }}
      <template v-if="payload.event.type === 'birthday'"> · sinh {{ formatVnDate(payload.event.person.birthday) }}</template>
      <template v-if="payload.event.lunar"> · âm {{ payload.event.lunar.day }}/{{ payload.event.lunar.month }}</template>
    </p>
    <p class="mt-1.5 text-[11px] text-paper/50">Bấm để xem đầy đủ thông tin</p>
  </div>
</template>
