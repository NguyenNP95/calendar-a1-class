<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { config } from '../config.js'
import Icon from './Icon.vue'

const props = defineProps({
  error: { type: String, default: '' },
  loading: { type: Boolean, default: false },
})
const emit = defineEmits(['submit'])

const password = ref('')
const visible = ref(false)
const input = ref(null)
const shake = ref(false)

function submit() {
  if (!password.value || props.loading) return
  emit('submit', password.value)
}

// Sai mật khẩu → rung nhẹ form và chọn sẵn nội dung để gõ lại
watch(() => props.error, async (value) => {
  if (!value) return
  shake.value = false
  await nextTick()
  shake.value = true
  input.value?.select()
})

onMounted(() => input.value?.focus())
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4 py-10">
    <div
      class="w-full max-w-md rounded-3xl bg-surface/90 p-7 shadow-card backdrop-blur sm:p-9"
      :class="shake ? 'animate-shake' : ''"
      @animationend="shake = false"
    >
      <div class="grid h-14 w-14 place-items-center rounded-2xl bg-clay/10 text-3xl" aria-hidden="true">🎂</div>
      <h1 class="mt-5 font-display text-4xl leading-tight">{{ config.title }}</h1>
      <p class="mt-3 text-sm leading-6 text-muted">
        Dữ liệu cá nhân đã được mã hoá. Nhập mật khẩu lớp để xem lịch sinh nhật.
      </p>

      <form class="mt-7 space-y-3" @submit.prevent="submit">
        <label for="password" class="block text-sm font-medium">Mật khẩu</label>
        <div class="relative">
          <Icon name="lock" :size="17" class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-subtle" />
          <input
            id="password"
            ref="input"
            v-model="password"
            :type="visible ? 'text' : 'password'"
            autocomplete="current-password"
            class="w-full rounded-2xl border bg-paper py-3 pl-11 pr-12 outline-none transition placeholder:text-subtle focus:ring-4"
            :class="error ? 'border-sunday/60 focus:ring-sunday/15' : 'border-line focus:border-clay/50 focus:ring-clay/15'"
            placeholder="Nhập mật khẩu"
            :aria-invalid="!!error"
            aria-describedby="password-error"
          />
          <button
            type="button"
            class="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-subtle hover:text-ink"
            :aria-label="visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
            @click="visible = !visible"
          >
            <Icon :name="visible ? 'eye-off' : 'eye'" :size="18" />
          </button>
        </div>
        <p id="password-error" class="min-h-[1.25rem] text-sm text-sunday" role="alert">{{ error }}</p>
        <button
          type="submit"
          class="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 font-medium text-paper shadow-soft transition hover:opacity-90 disabled:opacity-60"
          :disabled="loading || !password"
        >
          <span v-if="loading" class="h-4 w-4 animate-spin rounded-full border-2 border-paper/30 border-t-paper" />
          {{ loading ? 'Đang mở khoá…' : 'Vào lịch' }}
        </button>
      </form>
    </div>
  </div>
</template>
