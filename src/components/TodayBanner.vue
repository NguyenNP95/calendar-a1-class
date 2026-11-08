<script setup>
import { computed } from 'vue'
import Avatar from './Avatar.vue'

const props = defineProps({
  events: { type: Array, required: true },
})
const emit = defineEmits(['open'])

const birthdays = computed(() => props.events.filter((e) => e.type === 'birthday'))
const anniversaries = computed(() => props.events.filter((e) => e.type === 'anniversary'))
</script>

<template>
  <section
    class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#b0501f] to-[#7a3110] p-5 text-white shadow-card sm:p-6"
    role="status"
  >
    <span class="pointer-events-none absolute -right-1 -top-2 select-none text-6xl opacity-90 motion-safe:animate-float sm:-right-2 sm:-top-3 sm:text-8xl" aria-hidden="true">🎂</span>
    <span class="pointer-events-none absolute right-20 top-3 hidden select-none text-2xl opacity-70 sm:right-32 sm:block" aria-hidden="true">✨</span>
    <p class="text-xs font-semibold uppercase tracking-wider text-white/80">
      Hôm nay · {{ birthdays.length ? 'Chúc mừng sinh nhật 🎉' : 'Ngày vui' }}
    </p>

    <p v-if="birthdays.length" class="mt-1.5 text-balance pr-16 font-display text-2xl leading-snug sm:pr-24 sm:text-3xl">
      <template v-for="(event, i) in birthdays" :key="event.id">
        <button type="button" class="underline decoration-white/40 underline-offset-4 hover:decoration-white" @click="emit('open', event)">
          {{ event.person.name }}</button><span v-if="event.age" class="whitespace-nowrap text-white/80">&nbsp;· {{ event.age }} tuổi</span><span v-if="i < birthdays.length - 1">, </span>
      </template>
    </p>
    <p v-if="anniversaries.length" class="mt-2 pr-16 text-sm text-white/90 sm:pr-24">
      💍 Kỷ niệm ngày cưới:
      <template v-for="(event, i) in anniversaries" :key="event.id">
        <button type="button" class="font-semibold underline decoration-white/40 underline-offset-2 hover:decoration-white" @click="emit('open', event)">
          {{ event.person.name }}</button><span v-if="event.years">&nbsp;· {{ event.years }} năm</span><span v-if="i < anniversaries.length - 1">, </span>
      </template>
    </p>

    <div class="mt-4 flex -space-x-2">
      <button
        v-for="event in events.slice(0, 6)"
        :key="event.id"
        type="button"
        class="rounded-full transition hover:z-10 hover:-translate-y-0.5"
        :aria-label="`Xem ${event.person.name}`"
        @click="emit('open', event)"
      >
        <Avatar :person="event.person" size="md" class="ring-2 ring-white/80" />
      </button>
    </div>
  </section>
</template>
