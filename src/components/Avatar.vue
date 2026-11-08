<script setup>
import { computed, ref, watch } from 'vue'
import { initials, personColor } from '../utils/people.js'

const props = defineProps({
  person: { type: Object, required: true },
  /** xs | sm | md | lg | xl */
  size: { type: String, default: 'md' },
  ring: { type: Boolean, default: false },
})

const SIZES = {
  xs: 'h-5 w-5 text-[9px] rounded-full',
  sm: 'h-8 w-8 text-[11px] rounded-full',
  md: 'h-10 w-10 text-sm rounded-full',
  lg: 'h-12 w-12 text-base rounded-2xl',
  xl: 'h-16 w-16 text-xl rounded-2xl',
}

const failed = ref(false)
watch(() => props.person.avatar, () => { failed.value = false })
const color = computed(() => personColor(props.person))
</script>

<template>
  <span
    class="grid shrink-0 select-none place-items-center overflow-hidden font-semibold text-white"
    :class="[SIZES[size], ring ? 'ring-2 ring-surface' : '']"
    :style="{ backgroundColor: color }"
  >
    <img
      v-if="person.avatar && !failed"
      :src="person.avatar"
      :alt="person.name"
      class="h-full w-full object-cover"
      loading="lazy"
      referrerpolicy="no-referrer"
      @error="failed = true"
    />
    <span v-else>{{ initials(person.name) }}</span>
  </span>
</template>
