<script setup>
import { computed } from 'vue'
import { countdownLabel, daysBetween, weekdayAbbr } from '../utils/dates.js'
import { eventTitle } from '../utils/events.js'
import { stripAccents } from '../utils/people.js'
import Avatar from './Avatar.vue'
import Icon from './Icon.vue'

const props = defineProps({
  year: { type: Number, required: true },
  events: { type: Array, required: true },
  today: { type: Date, required: true },
})
const query = defineModel('query', { type: String, default: '' })
const emit = defineEmits(['open'])

const filtered = computed(() => {
  const q = stripAccents(query.value).trim()
  const list = props.events.map((event) => ({ ...event, days: daysBetween(props.today, event.date) }))
  if (!q) return list
  return list.filter(({ person }) =>
    stripAccents(`${person.name} ${person.note} ${person.address}`).includes(q),
  )
})

function groupByMonth(list) {
  const groups = new Map()
  for (const event of list) {
    const m = event.date.getMonth() + 1
    if (!groups.has(m)) groups.set(m, [])
    groups.get(m).push(event)
  }
  return [...groups.entries()].map(([month, items]) => ({ month, items }))
}

const isCurrentYear = computed(() => props.year === props.today.getFullYear())
const upcoming = computed(() => groupByMonth(isCurrentYear.value ? filtered.value.filter((e) => e.days >= 0) : filtered.value))
const past = computed(() => (isCurrentYear.value ? filtered.value.filter((e) => e.days < 0) : []))
const pastGroups = computed(() => groupByMonth(past.value))

function badge(event) {
  if (event.days >= 0 && event.days <= 60) return countdownLabel(event.days)
  return ''
}
</script>

<template>
  <section class="rounded-3xl bg-surface p-3 shadow-card sm:p-5">
    <label class="relative mb-4 block">
      <span class="sr-only">Tìm theo tên</span>
      <Icon name="search" :size="16" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle" />
      <input
        v-model="query"
        type="search"
        placeholder="Tìm theo tên, ghi chú, địa chỉ… (không cần dấu)"
        class="w-full rounded-2xl border border-line bg-paper py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-subtle focus:border-clay/50 focus:ring-4 focus:ring-clay/15"
      />
    </label>

    <p v-if="!filtered.length" class="py-12 text-center text-sm text-muted">
      {{ query ? 'Không tìm thấy ai khớp với từ khoá.' : `Năm ${year} chưa có sự kiện nào.` }}
    </p>

    <template v-for="group in upcoming" :key="'u' + group.month">
      <h3 class="sticky top-0 z-10 -mx-1 mb-1 mt-3 bg-surface/95 px-1 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted backdrop-blur first:mt-0">
        Tháng {{ group.month }}
      </h3>
      <ul class="divide-y divide-line">
        <li v-for="event in group.items" :key="event.id">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-2xl px-1 py-2.5 text-left transition hover:bg-paper sm:px-2"
            :class="event.days === 0 ? 'bg-clay/5' : ''"
            @click="emit('open', event)"
          >
            <div class="w-10 shrink-0 text-center">
              <div class="font-display text-2xl leading-none" :class="event.date.getDay() === 0 ? 'text-sunday' : ''">
                {{ event.date.getDate() }}
              </div>
              <div class="mt-0.5 text-[10px] font-semibold uppercase text-subtle">{{ weekdayAbbr(event.date) }}</div>
            </div>
            <Avatar :person="event.person" size="md" />
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium">{{ event.person.name }}</p>
              <p class="flex items-center gap-1 truncate text-xs text-muted">
                <Icon :name="event.type === 'birthday' ? 'cake' : 'heart'" :size="12" :class="event.type === 'anniversary' ? 'text-clay' : ''" />
                {{ eventTitle(event) }}
                <span v-if="event.lunar" class="inline-flex items-center gap-0.5"> · <Icon name="moon" :size="11" /> âm {{ event.lunar.day }}/{{ event.lunar.month }}</span>
              </p>
            </div>
            <span
              v-if="badge(event)"
              class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              :class="event.days === 0 ? 'bg-clay text-on-clay' : event.days <= 7 ? 'bg-clay/10 text-clay' : 'bg-paper text-muted'"
            >
              {{ badge(event) }}
            </span>
          </button>
        </li>
      </ul>
    </template>

    <details v-if="past.length" class="group mt-5 rounded-2xl border border-line" :open="!!query">
      <summary class="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-muted">
        Đã qua trong năm {{ year }} ({{ past.length }})
        <Icon name="chevron-right" :size="16" class="transition group-open:rotate-90" />
      </summary>
      <div class="px-3 pb-3 opacity-75">
        <template v-for="group in pastGroups" :key="'p' + group.month">
          <h3 class="mb-1 mt-3 px-1 text-xs font-semibold uppercase tracking-wider text-subtle first:mt-0">Tháng {{ group.month }}</h3>
          <ul class="divide-y divide-line">
            <li v-for="event in group.items" :key="event.id">
              <button type="button" class="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left hover:bg-paper" @click="emit('open', event)">
                <span class="w-10 shrink-0 text-center font-display text-lg leading-none">{{ event.date.getDate() }}</span>
                <Avatar :person="event.person" size="sm" />
                <span class="min-w-0 flex-1 truncate text-sm">{{ event.person.name }}</span>
                <span class="shrink-0 text-xs text-subtle">{{ eventTitle(event).replace('Sinh nhật · ', '') }}</span>
              </button>
            </li>
          </ul>
        </template>
      </div>
    </details>
  </section>
</template>
