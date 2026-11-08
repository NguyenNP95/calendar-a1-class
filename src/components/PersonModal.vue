<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { countdownLabel, daysBetween, formatDayMonth, weekdayName } from '../utils/dates.js'
import { personEventsInYear } from '../utils/events.js'
import { canChiYear, formatLunar, solarToLunar } from '../utils/lunar.js'
import { formatPhone, formatVnDate, initials, parseIsoDate, personColor, phoneDigits as toPhoneDigits } from '../utils/people.js'
import { photoUrl } from '../utils/photos.js'
import Icon from './Icon.vue'

const props = defineProps({
  person: { type: Object, required: true },
  year: { type: Number, required: true },
  today: { type: Date, required: true },
})
const emit = defineEmits(['close'])

const closeBtn = ref(null)
const panel = ref(null)
const zoomClose = ref(null)
const copied = ref(false)
const zoomed = ref(false)
let previousFocus = null
let previousOverflow = ''

// Ảnh: hiện ngay ảnh nhỏ (có sẵn trong dữ liệu), ảnh lớn tải xong thì thay vào
const color = computed(() => personColor(props.person))
const thumbFailed = ref(false)
const largeSrc = ref('')
const heroSrc = computed(() => largeSrc.value || (thumbFailed.value ? '' : props.person.avatar || ''))
const loadingLarge = computed(() => Boolean(props.person.photo) && !largeSrc.value)

async function loadLargePhoto() {
  const url = await photoUrl(props.person.photo)
  if (!url) return
  const img = new Image()
  img.src = url
  try {
    await img.decode()
    largeSrc.value = url
  } catch {
    /* lỗi ảnh lớn → giữ ảnh nhỏ */
  }
}

function openZoom() {
  if (!heroSrc.value) return
  zoomed.value = true
  nextTick(() => zoomClose.value?.focus({ preventScroll: true }))
}

function closeZoom() {
  zoomed.value = false
  nextTick(() => closeBtn.value?.focus({ preventScroll: true }))
}

const birth = computed(() => parseIsoDate(props.person.birthday))
const birthLunar = computed(() => (birth.value?.y ? solarToLunar(birth.value.d, birth.value.m, birth.value.y) : null))
const married = computed(() => parseIsoDate(props.person.marriedAt))
const events = computed(() => personEventsInYear(props.person, props.year))
const birthday = computed(() => events.value.find((e) => e.type === 'birthday'))
const anniversary = computed(() => events.value.find((e) => e.type === 'anniversary'))
const phoneDigits = computed(() => toPhoneDigits(props.person.phone))

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
    if (zoomed.value) closeZoom()
    else emit('close')
    return
  }
  if (zoomed.value) {
    // Đang xem ảnh lớn: chỉ có nút đóng
    if (e.key === 'Tab') e.preventDefault()
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
  loadLargePhoto()
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
      class="modal-panel relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-y-auto overscroll-contain rounded-t-3xl bg-surface shadow-card sm:rounded-3xl md:max-h-[86dvh] md:max-w-3xl md:flex-row md:overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="person-name"
    >
      <button
        ref="closeBtn"
        type="button"
        class="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-surface/80 text-muted shadow-soft ring-1 ring-line/70 backdrop-blur transition hover:bg-surface hover:text-ink"
        aria-label="Đóng"
        @click="emit('close')"
      >
        <Icon name="x" :size="18" />
      </button>

      <!-- Ảnh + tên: phía trên (mobile) / cột trái (desktop) -->
      <section
        class="relative isolate flex shrink-0 flex-col items-center overflow-hidden px-6 pb-6 pt-9 text-center md:w-[300px] md:justify-center md:border-r md:border-line/70 md:px-7 md:py-10"
      >
        <div class="absolute inset-0 -z-10" aria-hidden="true">
          <img v-if="heroSrc" :src="heroSrc" alt="" class="h-full w-full scale-125 object-cover opacity-50 blur-2xl saturate-150 dark:opacity-35" />
          <div v-else class="h-full w-full opacity-25" :style="{ backgroundColor: color }" />
          <div class="absolute inset-0 bg-gradient-to-b from-surface/20 via-surface/55 to-surface md:via-surface/40 md:to-surface/75" />
        </div>
        <div class="absolute left-1/2 top-2.5 h-1 w-10 -translate-x-1/2 rounded-full bg-ink/15 sm:hidden" aria-hidden="true" />

        <button
          type="button"
          class="group relative h-48 w-48 overflow-hidden rounded-[2rem] bg-paper shadow-card ring-4 ring-surface transition focus-visible:ring-clay sm:h-52 sm:w-52 md:h-60 md:w-60"
          :class="heroSrc ? 'cursor-zoom-in' : 'cursor-default'"
          :disabled="!heroSrc"
          :aria-label="heroSrc ? `Xem ảnh lớn của ${person.name}` : person.name"
          @click="openZoom"
        >
          <img
            v-if="heroSrc"
            :src="heroSrc"
            :alt="person.name"
            class="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            :class="loadingLarge ? 'blur-[1.5px]' : ''"
            referrerpolicy="no-referrer"
            @error="thumbFailed = true"
          />
          <span
            v-else
            class="grid h-full w-full select-none place-items-center font-display text-6xl text-white"
            :style="{ backgroundColor: color }"
          >{{ initials(person.name) }}</span>
          <span
            v-if="heroSrc"
            class="absolute bottom-2.5 right-2.5 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100"
            aria-hidden="true"
          >
            <Icon name="expand" :size="15" />
          </span>
        </button>

        <h2 id="person-name" class="mt-5 text-balance font-display text-[1.7rem] leading-tight sm:text-3xl">{{ person.name }}</h2>
        <p v-if="meta" class="mt-1.5 text-sm text-muted">{{ meta }}</p>
      </section>

      <!-- Thông tin -->
      <section class="min-w-0 flex-1 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6 md:overflow-y-auto md:overscroll-contain md:pt-6">
      <p class="mb-4 mr-12 hidden text-xs font-semibold uppercase tracking-wider text-subtle md:block">Thông tin</p>

      <!-- Sự kiện trong năm đang xem -->
      <div v-if="birthday || anniversary" class="grid gap-2" :class="birthday && anniversary ? 'sm:grid-cols-2' : ''">
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
          <dd v-if="!phoneDigits" class="font-medium">{{ person.phone }}</dd>
          <dd v-else class="flex items-center gap-1.5">
            <a :href="`tel:${phoneDigits}`" class="mr-1 whitespace-nowrap font-medium tabular-nums text-clay hover:underline">{{ formatPhone(person.phone) }}</a>
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
          <dd class="text-right font-medium">{{ person.address }}</dd>
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
      </section>
    </div>

    <!-- Xem ảnh lớn -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="zoomed"
          class="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-black/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          :aria-label="`Ảnh của ${person.name}`"
          @click="closeZoom"
        >
          <button
            ref="zoomClose"
            type="button"
            class="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            aria-label="Đóng ảnh"
            @click.stop="closeZoom"
          >
            <Icon name="x" :size="20" />
          </button>
          <img
            :src="heroSrc"
            :alt="person.name"
            class="aspect-square w-[min(92vw,78dvh,640px)] rounded-3xl object-cover shadow-2xl"
            referrerpolicy="no-referrer"
          />
          <p class="font-display text-xl text-white/90">{{ person.name }}</p>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
