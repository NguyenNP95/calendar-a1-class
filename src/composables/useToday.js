import { onBeforeUnmount, onMounted, ref } from 'vue'
import { startOfDay } from '../utils/dates.js'

// Một "hôm nay" dùng chung, tự cập nhật khi qua nửa đêm hoặc khi quay lại tab.
const today = ref(startOfDay(new Date()))
let timer = null
let users = 0

function refresh() {
  const now = startOfDay(new Date())
  if (now.getTime() !== today.value.getTime()) today.value = now
}

export function useToday() {
  onMounted(() => {
    if (users++ > 0) return
    refresh()
    timer = setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
  })
  onBeforeUnmount(() => {
    if (--users > 0) return
    clearInterval(timer)
    document.removeEventListener('visibilitychange', refresh)
  })
  return today
}
