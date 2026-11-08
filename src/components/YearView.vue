<script setup>
import { computed } from 'vue'
import { WEEKDAYS_SHORT, dayKey, mondayOffset, pad2, sameDay } from '../utils/dates.js'
import { personColor, shortName } from '../utils/people.js'
import Icon from './Icon.vue'

const props = defineProps({
  year: { type: Number, required: true },
  byDay: { type: Map, required: true },
  byMonth: { type: Array, required: true },
  today: { type: Date, required: true },
})
const emit = defineEmits(['pick-day', 'pick-month', 'open'])

const MAX_NAMES = 4

const months = computed(() => Array.from({ length: 12 }, (_, i) => {
  const month = i + 1
  const first = new Date(props.year, i, 1)
  const total = new Date(props.year, month, 0).getDate()
  const days = [
    ...Array.from({ length: mondayOffset(first) }, () => null),
    ...Array.from({ length: total }, (_, d) => {
      const date = new Date(props.year, i, d + 1)
      const events = props.byDay.get(dayKey(month, d + 1)) || []
      return {
        day: d + 1,
        date,
        events,
        birthday: events.find((e) => e.type === 'birthday'),
        isToday: sameDay(date, props.today),
        isSunday: date.getDay() === 0,
      }
    }),
  ]
  return {
    month,
    days,
    events: props.byMonth[i] || [],
    isCurrent: props.today.getFullYear() === props.year && props.today.getMonth() === i,
  }
}))

function dayTitle(cell) {
  return cell.events.map((e) => `${e.person.name} (${e.type === 'birthday' ? 'sinh nhật' : 'kỷ niệm cưới'})`).join('\n')
}
</script>

<template>
  <div class="grid grid-cols-1 items-start gap-3 min-[460px]:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
    <section
      v-for="m in months"
      :key="m.month"
      class="rounded-3xl bg-surface p-4 shadow-card transition"
      :class="m.isCurrent ? 'ring-2 ring-clay/60' : ''"
    >
      <header class="mb-2 flex items-center justify-between">
        <button
          type="button"
          class="-mx-1 rounded-lg px-1 font-display text-xl hover:text-clay"
          @click="emit('pick-month', m.month)"
        >
          Tháng {{ m.month }}
        </button>
        <span
          v-if="m.events.length"
          class="rounded-full bg-clay/10 px-2 py-0.5 text-xs font-semibold text-clay"
          :title="`${m.events.length} sự kiện`"
        >
          {{ m.events.length }}
        </span>
      </header>

      <div class="month-grid text-center text-[10px] font-semibold text-subtle" aria-hidden="true">
        <span v-for="(label, i) in WEEKDAYS_SHORT" :key="label" class="py-1" :class="i === 6 ? 'text-sunday/80' : ''">
          {{ label.replace('T', '') }}
        </span>
      </div>
      <div class="month-grid gap-y-0.5 text-center text-xs">
        <template v-for="(cell, idx) in m.days" :key="idx">
          <span v-if="!cell" />
          <button
            v-else
            type="button"
            class="mx-auto grid aspect-square w-full max-w-[2rem] place-items-center rounded-full tabular-nums transition hover:scale-110"
            :class="[
              cell.birthday ? 'font-semibold text-white'
              : cell.events.length ? 'font-semibold text-clay ring-[1.5px] ring-inset ring-clay/70'
              : cell.isSunday ? 'text-sunday/90 hover:bg-paper' : 'text-ink/80 hover:bg-paper',
              cell.isToday ? 'outline outline-2 outline-offset-1 outline-ink' : '',
            ]"
            :style="cell.birthday ? { backgroundColor: personColor(cell.birthday.person) } : null"
            :title="dayTitle(cell) || undefined"
            :aria-label="`Ngày ${cell.day} tháng ${m.month}${cell.events.length ? ': ' + dayTitle(cell) : ''}`"
            @click="emit('pick-day', cell.date)"
          >
            {{ cell.day }}
          </button>
        </template>
      </div>

      <ul v-if="m.events.length" class="mt-3 space-y-1 border-t border-line pt-3 text-xs">
        <li v-for="event in m.events.slice(0, MAX_NAMES)" :key="event.id">
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-left hover:bg-paper"
            @click="emit('open', event)"
          >
            <span class="w-5 shrink-0 text-right font-semibold tabular-nums text-muted">{{ pad2(event.date.getDate()) }}</span>
            <span
              class="h-2 w-2 shrink-0 rounded-full"
              :class="event.type === 'anniversary' ? 'border-[1.5px] border-clay' : ''"
              :style="event.type === 'birthday' ? { backgroundColor: personColor(event.person) } : null"
            />
            <span class="truncate" :class="event.type === 'anniversary' ? 'text-clay' : ''">{{ shortName(event.person.name) }}</span>
            <Icon v-if="event.lunar" name="moon" :size="11" class="text-muted" />
          </button>
        </li>
        <li v-if="m.events.length > MAX_NAMES">
          <button type="button" class="px-1 text-muted hover:text-clay" @click="emit('pick-month', m.month)">
            +{{ m.events.length - MAX_NAMES }} sự kiện khác →
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
