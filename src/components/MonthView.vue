<script setup>
import { computed } from 'vue'
import { config } from '../config.js'
import { WEEKDAYS_SHORT, dayKey, mondayOffset, sameDay, weekdayName } from '../utils/dates.js'
import { solarToLunar } from '../utils/lunar.js'
import { personColor, shortName } from '../utils/people.js'
import Icon from './Icon.vue'

const props = defineProps({
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  byDay: { type: Map, required: true },
  selectedDate: { type: Date, default: null },
  today: { type: Date, required: true },
})
const emit = defineEmits(['select-day', 'open', 'hover'])

const MAX_CHIPS = 2
const MAX_DOTS = 3

// Luôn 6 hàng × 7 cột để chiều cao không đổi khi chuyển tháng.
const cells = computed(() => {
  const first = new Date(props.year, props.month - 1, 1)
  const start = new Date(props.year, props.month - 1, 1 - mondayOffset(first))
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const inMonth = date.getMonth() === props.month - 1
    const events = inMonth ? props.byDay.get(dayKey(props.month, date.getDate())) || [] : []
    const lunar = config.showLunar && inMonth
      ? solarToLunar(date.getDate(), date.getMonth() + 1, date.getFullYear())
      : null
    return {
      key: date.getTime(),
      date,
      day: date.getDate(),
      inMonth,
      events,
      lunar,
      isToday: sameDay(date, props.today),
      isSunday: date.getDay() === 0,
      isSelected: inMonth && sameDay(date, props.selectedDate),
    }
  })
})

function lunarLabel(lunar) {
  if (lunar.day === 1) return `${lunar.day}/${lunar.month}${lunar.leap ? 'N' : ''}`
  return String(lunar.day)
}

function ariaLabel(cell) {
  const base = `${weekdayName(cell.date)} ${cell.day} tháng ${props.month}`
  if (!cell.events.length) return base
  const names = cell.events
    .map((e) => `${e.type === 'birthday' ? 'sinh nhật' : 'kỷ niệm cưới'} ${e.person.name}`)
    .join(', ')
  return `${base}: ${names}`
}

function hover(event, domEvent) {
  emit('hover', event ? { event, x: domEvent.clientX, y: domEvent.clientY } : null)
}
</script>

<template>
  <section class="rounded-3xl bg-surface p-2.5 shadow-card sm:p-5">
    <div class="month-grid mb-1 text-center text-[11px] font-semibold uppercase tracking-wider sm:text-xs" aria-hidden="true">
      <span
        v-for="(label, i) in WEEKDAYS_SHORT"
        :key="label"
        class="py-2"
        :class="i === 6 ? 'text-sunday' : 'text-muted'"
      >
        {{ label }}
      </span>
    </div>

    <div class="month-grid gap-1 sm:gap-1.5">
      <template v-for="cell in cells" :key="cell.key">
        <!-- Ngày của tháng trước / sau -->
        <div
          v-if="!cell.inMonth"
          class="flex min-h-[3.75rem] justify-center p-1.5 text-sm text-subtle/50 sm:min-h-[6.75rem] sm:justify-start sm:p-2"
          aria-hidden="true"
        >
          <span class="grid h-7 w-7 place-items-center">{{ cell.day }}</span>
        </div>

        <div
          v-else
          class="group relative flex min-h-[3.75rem] flex-col rounded-xl p-1 transition-colors sm:min-h-[6.75rem] sm:rounded-2xl sm:p-2"
          :class="cell.isSelected
            ? 'bg-clay/10 ring-1 ring-inset ring-clay/50'
            : 'bg-paper/70 hover:bg-paper'"
        >
          <!-- Lớp nút phủ toàn ô để chọn ngày (chip bên trong là nút riêng) -->
          <button
            type="button"
            class="absolute inset-0 rounded-[inherit]"
            :aria-label="ariaLabel(cell)"
            :aria-pressed="cell.isSelected"
            @click="emit('select-day', cell.date)"
          />

          <div class="pointer-events-none relative flex flex-col items-center gap-0.5 sm:flex-row sm:items-start sm:justify-between">
            <span
              class="grid h-7 w-7 place-items-center rounded-full text-sm tabular-nums"
              :class="cell.isToday
                ? 'bg-clay font-semibold text-on-clay shadow-soft'
                : cell.isSunday ? 'font-medium text-sunday' : 'font-medium text-ink'"
            >
              {{ cell.day }}
            </span>
            <span
              v-if="cell.lunar"
              class="text-[10px] leading-none tabular-nums sm:mt-1.5 sm:text-[11px]"
              :class="cell.lunar.day === 1 || cell.lunar.day === 15 ? 'font-semibold text-clay' : 'text-subtle'"
            >
              {{ lunarLabel(cell.lunar) }}
            </span>
          </div>

          <!-- Mobile: chấm màu -->
          <div v-if="cell.events.length" class="pointer-events-none relative mt-auto flex items-center justify-center gap-[3px] pb-0.5 pt-1 sm:hidden">
            <span
              v-for="event in cell.events.slice(0, MAX_DOTS)"
              :key="event.id"
              class="h-[7px] w-[7px] rounded-full"
              :class="event.type === 'anniversary' ? 'border-[1.5px] border-clay' : ''"
              :style="event.type === 'birthday' ? { backgroundColor: personColor(event.person) } : null"
            />
            <span v-if="cell.events.length > MAX_DOTS" class="text-[9px] font-semibold leading-none text-muted">+</span>
          </div>

          <!-- Desktop: chip tên -->
          <div v-if="cell.events.length" class="relative mt-1.5 hidden flex-col gap-1 sm:flex">
            <button
              v-for="event in cell.events.slice(0, MAX_CHIPS)"
              :key="event.id"
              type="button"
              class="flex w-full items-center gap-1 rounded-lg px-1.5 py-[3px] text-left text-xs font-medium transition hover:brightness-110 active:scale-[0.98]"
              :class="event.type === 'birthday' ? 'text-white shadow-sm' : 'border border-clay/40 bg-clay/5 text-clay'"
              :style="event.type === 'birthday' ? { backgroundColor: personColor(event.person) } : null"
              @click="emit('open', event)"
              @mouseenter="hover(event, $event)"
              @mousemove="hover(event, $event)"
              @mouseleave="hover(null)"
            >
              <Icon v-if="event.type === 'anniversary'" name="heart" :size="12" :stroke="2.2" />
              <span class="truncate">{{ shortName(event.person.name) }}</span>
              <Icon v-if="event.lunar" name="moon" :size="11" :stroke="2.2" class="ml-auto opacity-80" />
            </button>
            <span
              v-if="cell.events.length > MAX_CHIPS"
              class="pointer-events-none px-1.5 text-[11px] font-medium text-muted"
            >
              +{{ cell.events.length - MAX_CHIPS }} khác
            </span>
          </div>
        </div>
      </template>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[11px] text-muted sm:text-xs">
      <span class="inline-flex items-center gap-1.5"><Icon name="cake" :size="13" /> Sinh nhật</span>
      <span v-if="config.showAnniversaries" class="inline-flex items-center gap-1.5 text-clay"><Icon name="heart" :size="13" /> Kỷ niệm cưới</span>
      <span class="inline-flex items-center gap-1.5"><Icon name="moon" :size="13" /> Theo âm lịch</span>
      <span v-if="config.showLunar" class="inline-flex items-center gap-1.5">
        <span class="font-semibold text-clay">1/10</span> Số nhỏ là ngày âm
      </span>
    </div>
  </section>
</template>
