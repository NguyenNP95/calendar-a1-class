<script setup>
import { computed } from 'vue'
import { config } from '../config.js'
import { countdownLabel, daysBetween, pad2, weekdayName } from '../utils/dates.js'
import { eventTitle } from '../utils/events.js'
import { canChiYear, formatLunar, solarToLunar } from '../utils/lunar.js'
import { personColor, shortName } from '../utils/people.js'
import Avatar from './Avatar.vue'
import Icon from './Icon.vue'

const props = defineProps({
  date: { type: Date, required: true },
  events: { type: Array, required: true },
  monthEvents: { type: Array, required: true },
  today: { type: Date, required: true },
})
const emit = defineEmits(['open'])

const lunar = computed(() => solarToLunar(props.date.getDate(), props.date.getMonth() + 1, props.date.getFullYear()))
const relative = computed(() => countdownLabel(daysBetween(props.today, props.date)))
const isToday = computed(() => daysBetween(props.today, props.date) === 0)
</script>

<template>
  <div class="space-y-4">
    <section class="rounded-3xl bg-surface p-5 shadow-card" aria-live="polite">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ weekdayName(date) }}</p>
          <h3 class="mt-1 font-display text-2xl leading-tight">
            {{ date.getDate() }} tháng {{ date.getMonth() + 1 }}<span class="text-muted">, {{ date.getFullYear() }}</span>
          </h3>
        </div>
        <span
          class="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
          :class="isToday ? 'bg-clay text-on-clay' : 'bg-paper text-muted'"
        >
          {{ relative }}
        </span>
      </div>
      <p v-if="config.showLunar" class="mt-1 flex items-center gap-1.5 text-sm text-muted">
        <Icon name="moon" :size="14" />
        Âm lịch {{ formatLunar(lunar) }} · năm {{ canChiYear(lunar.year) }}
      </p>

      <ul v-if="events.length" class="mt-4 space-y-2">
        <li v-for="event in events" :key="event.id">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-2xl border border-line bg-paper/60 p-3 text-left transition hover:border-clay/40 hover:bg-paper"
            @click="emit('open', event)"
          >
            <Avatar :person="event.person" size="lg" />
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold">{{ event.person.name }}</p>
              <p class="mt-0.5 flex items-center gap-1 text-xs" :class="event.type === 'anniversary' ? 'text-clay' : 'text-muted'">
                <Icon :name="event.type === 'birthday' ? 'cake' : 'heart'" :size="12" />
                {{ eventTitle(event) }}
              </p>
              <p v-if="event.lunar" class="mt-0.5 flex items-center gap-1 text-xs text-muted">
                <Icon name="moon" :size="11" /> Theo âm lịch, ngày {{ event.lunar.day }}/{{ event.lunar.month }}
              </p>
              <p v-if="event.moved" class="mt-0.5 text-xs text-muted">Sinh 29/2, năm nay tổ chức 28/2</p>
            </div>
            <Icon name="chevron-right" :size="16" class="text-subtle" />
          </button>
        </li>
      </ul>
      <p v-else class="mt-4 rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
        Không có sinh nhật hay kỷ niệm nào trong ngày này.
      </p>
    </section>

    <section class="rounded-3xl bg-surface p-5 shadow-card">
      <h3 class="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
        Trong tháng {{ date.getMonth() + 1 }}
        <span class="normal-case tracking-normal">{{ monthEvents.length }} sự kiện</span>
      </h3>
      <ul v-if="monthEvents.length" class="mt-3 space-y-0.5">
        <li v-for="event in monthEvents" :key="event.id">
          <button
            type="button"
            class="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm transition hover:bg-paper"
            :class="daysBetween(today, event.date) < 0 ? 'opacity-55' : ''"
            @click="emit('open', event)"
          >
            <span class="w-6 shrink-0 text-right font-semibold tabular-nums text-muted">{{ pad2(event.date.getDate()) }}</span>
            <span
              class="h-2.5 w-2.5 shrink-0 rounded-full"
              :class="event.type === 'anniversary' ? 'border-2 border-clay' : ''"
              :style="event.type === 'birthday' ? { backgroundColor: personColor(event.person) } : null"
            />
            <span class="min-w-0 flex-1 truncate">{{ shortName(event.person.name) }}</span>
            <span class="shrink-0 text-xs text-subtle">
              {{ event.type === 'birthday' ? (event.age != null ? `${event.age} tuổi` : 'SN') : `${event.years} năm cưới` }}
            </span>
          </button>
        </li>
      </ul>
      <p v-else class="mt-3 text-sm text-muted">Tháng này không có sự kiện.</p>
    </section>
  </div>
</template>
