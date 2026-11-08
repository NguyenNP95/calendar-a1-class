<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTheme } from '../composables/useTheme.js'
import { useToday } from '../composables/useToday.js'
import { config } from '../config.js'
import { dateKeyOf, formatDateTime, sameDay } from '../utils/dates.js'
import { eventsForYear, upcomingEvents } from '../utils/events.js'
import { canChiYear } from '../utils/lunar.js'
import { storage } from '../utils/storage.js'
import DayPanel from './DayPanel.vue'
import HoverCard from './HoverCard.vue'
import Icon from './Icon.vue'
import ListView from './ListView.vue'
import MonthView from './MonthView.vue'
import PersonModal from './PersonModal.vue'
import TodayBanner from './TodayBanner.vue'
import UpcomingStrip from './UpcomingStrip.vue'
import YearView from './YearView.vue'

const props = defineProps({
  people: { type: Array, required: true },
  generatedAt: { type: String, default: '' },
})
const emit = defineEmits(['logout'])

const today = useToday()
const { mode: themeMode, cycle: cycleTheme } = useTheme()

const VIEWS = [
  { id: 'month', label: 'Tháng', icon: 'calendar' },
  { id: 'year', label: 'Năm', icon: 'grid' },
  { id: 'list', label: 'Danh sách', icon: 'list' },
]
const THEME = {
  system: { icon: 'monitor', label: 'Theo hệ thống' },
  light: { icon: 'sun', label: 'Sáng' },
  dark: { icon: 'moon', label: 'Tối' },
}

// Cho phép link trực tiếp: ?view=year | month | list
const savedView = new URLSearchParams(window.location.search).get('view') || storage.get('a1-view')
const view = ref(VIEWS.some((v) => v.id === savedView) ? savedView : 'month')
const year = ref(today.value.getFullYear())
const month = ref(today.value.getMonth() + 1)
const selectedDate = ref(today.value)
const transitionName = ref('fade')
const query = ref('')
const modal = ref(null) // { person, year }
const hover = ref(null)
const panelEl = ref(null)
const canHover = typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches

watch(view, (value) => {
  storage.set('a1-view', value)
  transitionName.value = 'fade'
  hover.value = null
})

const yearData = computed(() => eventsForYear(props.people, year.value))
const monthEvents = computed(() => yearData.value.byMonth[month.value - 1] || [])
const selectedEvents = computed(() => yearData.value.byDay.get(dateKeyOf(selectedDate.value)) || [])
const upcoming = computed(() => upcomingEvents(props.people, today.value, config.upcomingCount))
const todayEvents = computed(() =>
  eventsForYear(props.people, today.value.getFullYear()).byDay.get(dateKeyOf(today.value)) || [],
)
const isAtToday = computed(() => {
  const t = today.value
  if (view.value !== 'month') return year.value === t.getFullYear()
  return year.value === t.getFullYear() && month.value === t.getMonth() + 1 && sameDay(selectedDate.value, t)
})
const transitionKey = computed(() => `${view.value}-${year.value}-${view.value === 'month' ? month.value : ''}`)

// ——— Điều hướng ———
function defaultSelection(y, m) {
  const t = today.value
  if (t.getFullYear() === y && t.getMonth() + 1 === m) return t
  const first = eventsForYear(props.people, y).byMonth[m - 1][0]
  return first ? first.date : new Date(y, m - 1, 1)
}

function setMonth(y, m, select) {
  const forward = y * 12 + m >= year.value * 12 + month.value
  if (view.value === 'month' && (y !== year.value || m !== month.value)) {
    transitionName.value = forward ? 'slide-next' : 'slide-prev'
  }
  year.value = y
  month.value = m
  selectedDate.value = select || defaultSelection(y, m)
}

function step(delta) {
  hover.value = null
  if (view.value === 'month') {
    const d = new Date(year.value, month.value - 1 + delta, 1)
    setMonth(d.getFullYear(), d.getMonth() + 1)
  } else {
    transitionName.value = delta > 0 ? 'slide-next' : 'slide-prev'
    year.value += delta
    selectedDate.value = defaultSelection(year.value, month.value)
  }
}

function goToday() {
  const t = today.value
  setMonth(t.getFullYear(), t.getMonth() + 1, t)
}

function selectDay(date) {
  if (view.value !== 'month') view.value = 'month'
  if (date.getFullYear() !== year.value || date.getMonth() + 1 !== month.value) {
    setMonth(date.getFullYear(), date.getMonth() + 1, date)
  } else {
    selectedDate.value = date
  }
  // Trên mobile/tablet, panel nằm dưới lịch → cuộn tới để thấy ai có sự kiện
  if (window.innerWidth < 1024 && selectedEvents.value.length) {
    nextTick(() => panelEl.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }
}

function pickMonth(m) {
  view.value = 'month'
  setMonth(year.value, m)
}

function openEvent(event) {
  hover.value = null
  modal.value = { person: event.person, year: event.date.getFullYear() }
}

function openFromHighlight(event) {
  const d = event.date
  if (view.value === 'month') setMonth(d.getFullYear(), d.getMonth() + 1, d)
  else if (d.getFullYear() !== year.value) {
    transitionName.value = d.getFullYear() > year.value ? 'slide-next' : 'slide-prev'
    year.value = d.getFullYear()
  }
  openEvent(event)
}

function onHover(payload) {
  if (canHover) hover.value = payload
}

// ——— Bàn phím ———
function onKeydown(e) {
  if (modal.value || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
  const target = e.target
  if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) return
  const actions = {
    ArrowLeft: () => step(-1),
    ArrowRight: () => step(1),
    t: goToday,
    T: goToday,
    1: () => { view.value = 'month' },
    2: () => { view.value = 'year' },
    3: () => { view.value = 'list' },
  }
  const action = actions[e.key]
  if (action) {
    e.preventDefault()
    action()
  }
}

// ——— Vuốt trên mobile ———
let touch = null
function onTouchStart(e) {
  if (e.touches.length !== 1 || view.value === 'list') return
  touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
}
function onTouchEnd(e) {
  if (!touch) return
  const dx = e.changedTouches[0].clientX - touch.x
  const dy = e.changedTouches[0].clientY - touch.y
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - touch.t < 600) step(dx < 0 ? 1 : -1)
  touch = null
}

function clearHover() {
  hover.value = null
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('scroll', clearHover, { passive: true })
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', clearHover)
})

// Qua nửa đêm khi đang xem tháng hiện tại → tự chọn ngày mới
watch(today, (_, before) => {
  if (sameDay(selectedDate.value, before)) goToday()
})
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6 sm:pt-10">
    <!-- Header -->
    <header class="mb-6 flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p class="flex items-center gap-1.5 text-sm font-semibold text-clay">
          <Icon name="sparkles" :size="14" />
          {{ people.length }} thành viên
        </p>
        <h1 class="mt-1 text-balance font-display text-[2rem] leading-[1.1] sm:text-5xl">{{ config.title }}</h1>
        <p class="mt-2 text-muted">{{ config.subtitle }}</p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          class="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-muted shadow-sm transition hover:text-ink"
          :aria-label="`Giao diện: ${THEME[themeMode].label}. Bấm để đổi`"
          :title="`Giao diện: ${THEME[themeMode].label}`"
          @click="cycleTheme"
        >
          <Icon :name="THEME[themeMode].icon" :size="18" />
        </button>
        <button
          v-if="config.requireAuth"
          type="button"
          class="flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm text-muted shadow-sm transition hover:text-ink sm:px-4"
          aria-label="Đăng xuất"
          @click="emit('logout')"
        >
          <Icon name="logout" :size="17" />
          <span class="hidden sm:inline">Đăng xuất</span>
        </button>
      </div>
    </header>

    <div v-if="!people.length" class="rounded-3xl bg-surface p-10 text-center shadow-card">
      <p class="text-4xl">📭</p>
      <p class="mt-3 font-display text-2xl">Chưa có dữ liệu</p>
      <p class="mt-2 text-sm text-muted">Kiểm tra lại Google Sheet (cột "Họ tên", "Ngày sinh") rồi chạy đồng bộ.</p>
    </div>

    <template v-else>
      <TodayBanner v-if="todayEvents.length" class="mb-6" :events="todayEvents" @open="openFromHighlight" />
      <UpcomingStrip v-if="upcoming.length" class="mb-4" :items="upcoming" @open="openFromHighlight" />

      <!-- Toolbar -->
      <div class="sticky top-0 z-30 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-paper/85 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            class="grid h-10 w-10 place-items-center rounded-full bg-surface text-ink shadow-sm transition hover:bg-clay hover:text-on-clay active:scale-95"
            :aria-label="view === 'month' ? 'Tháng trước' : 'Năm trước'"
            @click="step(-1)"
          >
            <Icon name="chevron-left" :size="20" />
          </button>
          <button
            type="button"
            class="min-w-[9.5rem] rounded-xl px-2 text-center leading-tight sm:min-w-[12rem]"
            :title="view === 'month' ? 'Xem cả năm' : ''"
            @click="view === 'month' && (view = 'year')"
          >
            <span class="block font-display text-2xl sm:text-[1.75rem]" aria-live="polite">
              <template v-if="view === 'month'">Tháng {{ month }} <span class="text-muted">{{ year }}</span></template>
              <template v-else>Năm {{ year }}</template>
            </span>
            <span class="block text-[11px] font-medium uppercase tracking-wider text-subtle">{{ canChiYear(year) }}</span>
          </button>
          <button
            type="button"
            class="grid h-10 w-10 place-items-center rounded-full bg-surface text-ink shadow-sm transition hover:bg-clay hover:text-on-clay active:scale-95"
            :aria-label="view === 'month' ? 'Tháng sau' : 'Năm sau'"
            @click="step(1)"
          >
            <Icon name="chevron-right" :size="20" />
          </button>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="h-10 rounded-full px-4 text-sm font-medium transition"
            :class="isAtToday ? 'bg-surface text-muted shadow-sm' : 'bg-ink text-paper shadow-soft hover:opacity-90'"
            @click="goToday"
          >
            Hôm nay
          </button>
          <div class="flex rounded-full bg-surface p-1 shadow-sm" role="group" aria-label="Chế độ xem">
            <button
              v-for="v in VIEWS"
              :key="v.id"
              type="button"
              class="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium transition sm:px-3"
              :class="view === v.id ? 'bg-clay text-on-clay shadow-sm' : 'text-muted hover:text-ink'"
              :aria-pressed="view === v.id"
              :title="v.label"
              @click="view = v.id"
            >
              <Icon :name="v.icon" :size="16" />
              <span :class="view === v.id ? 'inline' : 'hidden md:inline'">{{ v.label }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Nội dung -->
      <div
        :class="view === 'month' ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start' : ''"
        @touchstart.passive="onTouchStart"
        @touchend="onTouchEnd"
      >
        <div class="min-w-0 overflow-x-clip">
          <Transition :name="transitionName" mode="out-in">
            <MonthView
              v-if="view === 'month'"
              :key="transitionKey"
              :year="year"
              :month="month"
              :by-day="yearData.byDay"
              :selected-date="selectedDate"
              :today="today"
              @select-day="selectDay"
              @open="openEvent"
              @hover="onHover"
            />
            <YearView
              v-else-if="view === 'year'"
              :key="transitionKey"
              :year="year"
              :by-day="yearData.byDay"
              :by-month="yearData.byMonth"
              :today="today"
              @pick-day="selectDay"
              @pick-month="pickMonth"
              @open="openEvent"
            />
            <ListView
              v-else
              :key="transitionKey"
              v-model:query="query"
              :year="year"
              :events="yearData.list"
              :today="today"
              @open="openEvent"
            />
          </Transition>
        </div>

        <aside v-if="view === 'month'" ref="panelEl" class="scroll-mt-24 lg:sticky lg:top-20">
          <DayPanel
            :date="selectedDate"
            :events="selectedEvents"
            :month-events="monthEvents"
            :today="today"
            @open="openEvent"
          />
        </aside>
      </div>
    </template>

    <footer class="mt-10 flex flex-col items-center gap-1 text-center text-xs text-subtle sm:flex-row sm:justify-between">
      <span v-if="generatedAt">Dữ liệu cập nhật lúc {{ formatDateTime(generatedAt) }}</span>
      <span class="hidden [@media(hover:hover)]:inline">
        Phím tắt: <kbd class="font-sans font-semibold">←</kbd> <kbd class="font-sans font-semibold">→</kbd> chuyển ·
        <kbd class="font-sans font-semibold">T</kbd> hôm nay ·
        <kbd class="font-sans font-semibold">1 2 3</kbd> chế độ xem ·
        <kbd class="font-sans font-semibold">Esc</kbd> đóng
      </span>
    </footer>

    <HoverCard v-if="hover" :payload="hover" />

    <Transition name="modal">
      <PersonModal
        v-if="modal"
        :key="modal.person.id"
        :person="modal.person"
        :year="modal.year"
        :today="today"
        @close="modal = null"
      />
    </Transition>
  </div>
</template>
