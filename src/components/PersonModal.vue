<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { countdownLabel, daysBetween, formatDayMonth, weekdayName } from '../utils/dates.js'
import { personEventsInYear } from '../utils/events.js'
import { canChiYear, formatLunar, solarToLunar } from '../utils/lunar.js'
import { formatVnDate, parseIsoDate } from '../utils/people.js'
import Avatar from './Avatar.vue'
import Icon from './Icon.vue'

const props = defineProps({
  person: { type: Object, required: true },
  year: { type: Number, required: true },
  today: { type: Date, required: true },
})
const emit = defineEmits(['close'])

const closeBtn = ref(null)
const panel = ref(null)
const copied = ref(false)
let previousFocus = null
let previousOverflow = ''

const birth = computed(() => parseIsoDate(props.person.birthday))
const birthLunar = computed(() => (birth.value?.y ? solarToLunar(birth.value.d, birth.value.m, birth.value.y) : null))
const married = computed(() => parseIsoDate(props.person.marriedAt))
const events = computed(() => personEventsInYear(props.person, props.year))
const birthday = computed(() => events.value.find((e) => e.type === 'birthday'))
const anniversary = computed(() => events.value.find((e) => e.type === 'anniversary'))
const phoneDigits = computed(() => (props.person.phone || '').replace(/[^\d+]/g, ''))
const mapsUrl = computed(() => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(props.person.address || '')}`)

const meta = computed(() => {
  const parts = []
  if (props.person.gender) parts.push(props.person.gender)
  if (birthLunar.value) parts.push(`Tuổi ${canChiYear(birthLunar.value.year)}`)
  return parts.join(' · ')
})

function relative(event) {
  return countdownLabel(daysBetween(props.today, event.date))
}

async function copyPhone() {
  try {
    await navigator.clipboard.writeText(props.person.phone)
  } catch {
    const input = document.createElement('textarea')
    input.value = props.person.phone
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    input.remove()
  }
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}

function onKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
    return
  }
  // Giữ focus bên trong modal
  if (e.key === 'Tab' && panel.value) {
    const items = panel.value.querySelectorAll('a[href], button:not([disabled])')
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

onMounted(() => {
  previousFocus = document.activeElement
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', onKeydown)
  closeBtn.value?.focus({ preventScroll: true })
})
onBeforeUnmount(() => {
  document.body.style.overflow = previousOverflow
  document.removeEventListener('keydown', onKeydown)
  previousFocus?.focus?.({ preventScroll: true })
})
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 backdrop-blur-[2px] sm:items-center sm:p-4"
    @click.self="emit('close')"
  >
    <div
      ref="panel"
      class="modal-panel max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-card sm:rounded-3xl sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="person-name"
    >
      <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden="true" />

      <div class="flex items-start gap-4">
        <Avatar :person="person" size="xl" />
        <div class="min-w-0 flex-1 pt-0.5">
          <h2 id="person-name" class="font-display text-2xl leading-tight sm:text-3xl">{{ person.name }}</h2>
          <p v-if="meta" class="mt-1 text-sm text-muted">{{ meta }}</p>
        </div>
        <button
          ref="closeBtn"
          type="button"
          class="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-paper hover:text-ink"
          aria-label="Đóng"
          @click="emit('close')"
        >
          <Icon name="x" :size="20" />
        </button>
      </div>

      <!-- Sự kiện trong năm đang xem -->
      <div v-if="birthday || anniversary" class="mt-5 grid gap-2" :class="birthday && anniversary ? 'sm:grid-cols-2' : ''">
        <div v-if="birthday" class="rounded-2xl bg-paper p-4">
          <p class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
            <Icon name="cake" :size="14" /> Sinh nhật {{ year }}
          </p>
          <p class="mt-1.5 font-display text-xl">{{ weekdayName(birthday.date) }}, {{ formatDayMonth(birthday.date) }}</p>
          <p class="mt-0.5 text-sm text-muted">
            <template v-if="birthday.age">Tròn {{ birthday.age }} tuổi · </template>
            <span class="font-semibold text-clay">{{ relative(birthday) }}</span>
          </p>
          <p v-if="birthday.lunar" class="mt-1 flex items-center gap-1 text-xs text-muted">
            <Icon name="moon" :size="12" /> Tính theo âm lịch ({{ birthday.lunar.day }}/{{ birthday.lunar.month }})
          </p>
          <p v-if="birthday.moved" class="mt-1 text-xs text-muted">Sinh 29/2 · năm nay tổ chức 28/2</p>
        </div>
        <div v-if="anniversary" class="rounded-2xl bg-clay/5 p-4 ring-1 ring-inset ring-clay/20">
          <p class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-clay">
            <Icon name="heart" :size="14" /> Kỷ niệm cưới
          </p>
          <p class="mt-1.5 font-display text-xl">{{ weekdayName(anniversary.date) }}, {{ formatDayMonth(anniversary.date) }}</p>
          <p class="mt-0.5 text-sm text-muted">
            <template v-if="anniversary.years">{{ anniversary.years }} năm · </template>
            <span class="font-semibold text-clay">{{ relative(anniversary) }}</span>
          </p>
        </div>
      </div>

      <dl class="mt-5 divide-y divide-line text-sm">
        <div class="flex items-start justify-between gap-4 py-3">
          <dt class="text-muted">Ngày sinh</dt>
          <dd class="text-right font-medium">{{ formatVnDate(person.birthday) }}</dd>
        </div>
        <div v-if="birthLunar" class="flex items-start justify-between gap-4 py-3">
          <dt class="text-muted">Âm lịch</dt>
          <dd class="text-right font-medium">
            {{ formatLunar(birthLunar) }}/{{ birthLunar.year }}
            <span class="font-normal text-muted">({{ canChiYear(birthLunar.year) }})</span>
          </dd>
        </div>
        <div v-if="person.phone" class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          <dt class="text-muted">Điện thoại</dt>
          <dd class="flex items-center gap-1.5">
            <a :href="`tel:${phoneDigits}`" class="mr-1 font-medium tabular-nums text-clay hover:underline">{{ person.phone }}</a>
            <a
              :href="`tel:${phoneDigits}`"
              class="grid h-8 w-8 place-items-center rounded-full bg-paper text-ink transition hover:bg-clay hover:text-on-clay"
              aria-label="Gọi điện"
              title="Gọi điện"
            >
              <Icon name="phone" :size="15" />
            </a>
            <a
              :href="`https://zalo.me/${phoneDigits.replace(/^\+/, '')}`"
              target="_blank"
              rel="noopener noreferrer"
              class="grid h-8 w-8 place-items-center rounded-full bg-paper text-ink transition hover:bg-[#0068ff] hover:text-white"
              aria-label="Nhắn Zalo"
              title="Nhắn Zalo"
            >
              <Icon name="message" :size="15" />
            </a>
            <button
              type="button"
              class="grid h-8 w-8 place-items-center rounded-full bg-paper text-ink transition hover:bg-ink hover:text-paper"
              :aria-label="copied ? 'Đã sao chép' : 'Sao chép số'"
              :title="copied ? 'Đã sao chép' : 'Sao chép số'"
              @click="copyPhone"
            >
              <Icon :name="copied ? 'check' : 'copy'" :size="15" />
            </button>
          </dd>
        </div>
        <div v-if="person.address" class="flex items-start justify-between gap-4 py-3">
          <dt class="shrink-0 text-muted">Địa chỉ</dt>
          <dd class="text-right font-medium">
            {{ person.address }}
            <a
              :href="mapsUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-1 flex items-center justify-end gap-1 text-xs font-normal text-clay hover:underline"
            >
              <Icon name="pin" :size="12" /> Xem bản đồ
            </a>
          </dd>
        </div>
        <div v-if="person.marriedAt" class="flex items-start justify-between gap-4 py-3">
          <dt class="text-muted">{{ married ? 'Ngày cưới' : 'Gia đình' }}</dt>
          <dd class="text-right font-medium">
            {{ formatVnDate(person.marriedAt) }}
            <span v-if="married?.y && today.getFullYear() - married.y > 0" class="font-normal text-muted">
              ({{ today.getFullYear() - married.y }} năm)
            </span>
          </dd>
        </div>
        <div v-if="person.note" class="flex items-start justify-between gap-4 py-3">
          <dt class="shrink-0 text-muted">Ghi chú</dt>
          <dd class="whitespace-pre-line text-right font-medium">{{ person.note }}</dd>
        </div>
      </dl>
    </div>
  </div>
</template>
