export const WEEKDAYS_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const WEEKDAY_NAMES = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']
const WEEKDAY_ABBR = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const DAY_MS = 86400000

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function dayKey(month, day) {
  return `${month}-${day}`
}

export function dateKeyOf(date) {
  return dayKey(date.getMonth() + 1, date.getDate())
}

export function sameDay(a, b) {
  return !!a && !!b
    && a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS)
}

export function weekdayName(date) {
  return WEEKDAY_NAMES[date.getDay()]
}

export function weekdayAbbr(date) {
  return WEEKDAY_ABBR[date.getDay()]
}

export function pad2(n) {
  return String(n).padStart(2, '0')
}

export function formatDayMonth(date) {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`
}

export function formatLongDate(date) {
  return `${weekdayName(date)}, ${date.getDate()} tháng ${date.getMonth() + 1}, ${date.getFullYear()}`
}

export function formatDateTime(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())} ${formatDayMonth(date)}/${date.getFullYear()}`
}

/** Nhãn đếm ngược so với hôm nay */
export function countdownLabel(days) {
  if (days === 0) return 'Hôm nay'
  if (days === 1) return 'Ngày mai'
  if (days === -1) return 'Hôm qua'
  if (days > 0) return `Còn ${days} ngày`
  return `${-days} ngày trước`
}

/** Thứ Hai là ngày đầu tuần */
export function mondayOffset(date) {
  return (date.getDay() + 6) % 7
}
