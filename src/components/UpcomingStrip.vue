<script setup>
import { ref } from 'vue'
import { countdownLabel, formatDayMonth, weekdayAbbr } from '../utils/dates.js'
import { personColor, shortName } from '../utils/people.js'
import Avatar from './Avatar.vue'
import Icon from './Icon.vue'

defineProps({
  items: { type: Array, required: true },
})
const emit = defineEmits(['open'])

function subtitle(event) {
  if (event.type === 'anniversary') return event.years ? `${event.years} năm ngày cưới` : 'Ngày cưới'
  return event.age != null ? `Tròn ${event.age} tuổi` : 'Sinh nhật'
}

// Kéo bằng chuột trái để cuộn ngang (cảm ứng đã cuộn được sẵn, không đụng tới)
const scroller = ref(null)
const dragging = ref(false)
let drag = null
let snapTimer = 0

function onPointerDown(e) {
  if (e.pointerType !== 'mouse' || e.button !== 0) return
  const el = scroller.value
  if (!el || el.scrollWidth <= el.clientWidth) return
  clearTimeout(snapTimer)
  drag = { x: e.clientX, left: el.scrollLeft, moved: false, id: e.pointerId }
}

function onPointerMove(e) {
  if (!drag || e.pointerId !== drag.id) return
  const dx = e.clientX - drag.x
  if (!drag.moved) {
    if (Math.abs(dx) < 5) return // chưa đủ xa: vẫn coi là click
    drag.moved = true
    dragging.value = true // tắt snap trong lúc kéo để không bị giật
    scroller.value.setPointerCapture(e.pointerId)
  }
  scroller.value.scrollLeft = drag.left - dx
}

function onPointerUp(e) {
  if (!drag || e.pointerId !== drag.id) return
  const moved = drag.moved
  drag = null
  if (!moved) return
  // Trượt êm về thẻ gần nhất rồi bật lại snap
  const el = scroller.value
  const padding = parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0
  const cards = [...el.children]
  const target = cards.reduce((best, card) => {
    const left = card.offsetLeft - padding
    return Math.abs(left - el.scrollLeft) < Math.abs(best - el.scrollLeft) ? left : best
  }, el.scrollLeft)
  el.scrollTo({ left: target, behavior: 'smooth' })
  snapTimer = setTimeout(() => { dragging.value = false }, 450)
}

// Vừa kéo xong thì không mở popup của thẻ dưới con trỏ
function onClickCapture(e) {
  if (dragging.value) {
    e.stopPropagation()
    e.preventDefault()
  }
}
</script>

<template>
  <section aria-labelledby="upcoming-title">
    <h2 id="upcoming-title" class="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted">Sắp tới</h2>
    <div
      ref="scroller"
      class="fade-edges no-scrollbar -mx-4 flex gap-3 overflow-x-auto scroll-px-4 px-4 pb-3 pt-1 sm:-mx-6 sm:scroll-px-6 sm:px-6"
      :class="dragging ? 'cursor-grabbing select-none snap-none' : 'snap-x snap-mandatory'"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @click.capture="onClickCapture"
      @dragstart.prevent
    >
      <button
        v-for="event in items"
        :key="event.id"
        type="button"
        class="relative flex w-[13.5rem] shrink-0 snap-start items-center gap-3 overflow-hidden rounded-2xl bg-surface p-3 pl-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-card"
        @click="emit('open', event)"
      >
        <span
          class="absolute inset-y-0 left-0 w-1"
          :style="{ backgroundColor: event.type === 'birthday' ? personColor(event.person) : 'rgb(var(--c-clay))' }"
        />
        <Avatar :person="event.person" size="md" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold">{{ shortName(event.person.name) }}</p>
          <p class="flex items-center gap-1 truncate text-xs text-muted">
            <Icon :name="event.type === 'birthday' ? 'cake' : 'heart'" :size="11" :class="event.type === 'anniversary' ? 'text-clay' : ''" />
            {{ subtitle(event) }}
            <Icon v-if="event.lunar" name="moon" :size="10" />
          </p>
          <p class="mt-1 flex items-center justify-between gap-2 text-[11px]">
            <span class="tabular-nums text-subtle">{{ weekdayAbbr(event.date) }}, {{ formatDayMonth(event.date) }}</span>
            <span
              class="rounded-full px-1.5 py-0.5 font-semibold"
              :class="event.daysLeft === 0 ? 'bg-clay text-on-clay' : event.daysLeft <= 7 ? 'bg-clay/10 text-clay' : 'text-muted'"
            >
              {{ countdownLabel(event.daysLeft) }}
            </span>
          </p>
        </div>
      </button>
    </div>
  </section>
</template>
