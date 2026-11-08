import { config } from '../config.js'

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Tên gọi thân mật: 2 chữ cuối, ví dụ "Nguyễn Văn Minh Anh" → "Minh Anh" */
export function shortName(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.length > 2 ? parts.slice(-2).join(' ') : parts.join(' ')
}

export function stripAccents(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

export function genderTone(gender) {
  const value = stripAccents(gender).trim()
  if (/\bnu\b|female|^f$/.test(value)) return 'female'
  if (/\bnam\b|male|^m$/.test(value)) return 'male'
  return 'neutral'
}

// Bảng màu đủ tương phản với chữ trắng (≥ 4.5:1), hài hoà với nền giấy.
const PALETTE = [
  '#2f6f8f', '#b44a6a', '#3d7a4f', '#7a5c99', '#a9532b',
  '#2e6e6a', '#8a4f7d', '#4b5fa3', '#9a5b12', '#5a6b2b',
]
const GENDER_COLORS = { male: '#2f6f8f', female: '#b44a6a', neutral: '#6b6158' }

function hash(text) {
  let h = 0
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0
  return h
}

export function personColor(person) {
  if (config.colorBy === 'gender') return GENDER_COLORS[genderTone(person.gender)]
  return PALETTE[hash(person.name || person.id || '') % PALETTE.length]
}

/** "YYYY-MM-DD" → { y, m, d }. Năm "0000" nghĩa là không rõ năm (y = 0). */
export function parseIsoDate(iso) {
  if (!iso) return null
  const match = String(iso).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!match) return null
  const [y, m, d] = match.slice(1).map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return { y, m, d }
}

export function formatVnDate(iso) {
  const parsed = parseIsoDate(iso)
  if (!parsed) return iso || '—'
  const dm = `${String(parsed.d).padStart(2, '0')}/${String(parsed.m).padStart(2, '0')}`
  return parsed.y ? `${dm}/${parsed.y}` : dm
}

/** Chỉ giữ chữ số (và dấu + đầu) để dùng cho tel: / Zalo. Trả về '' nếu không giống số điện thoại. */
export function phoneDigits(phone = '') {
  const digits = String(phone).replace(/[^\d+]/g, '')
  return digits.replace(/\D/g, '').length >= 9 ? digits : ''
}

/** "0352416008" → "0352 416 008" cho dễ đọc; giữ nguyên nếu không phải số di động 10 số. */
export function formatPhone(phone = '') {
  const digits = String(phone).replace(/[\s.\-]/g, '')
  if (/^0\d{9}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  return phone
}

const TRUTHY = new Set(['x', 'v', 'co', 'yes', 'y', '1', 'true', 'am', 'am lich', 'lich am', '✓', '✔', '☑'])
export function isTruthyCell(value) {
  if (typeof value === 'boolean') return value
  return TRUTHY.has(stripAccents(value).trim())
}

/** Chuẩn hoá dữ liệu từ data.enc / data.json, gán id ổn định cho từng người. */
export function normalizePeople(list = []) {
  const seen = new Map()
  return list
    .filter((p) => p && p.name)
    .map((p, index) => {
      const base = `${p.stt || index}-${p.name}`
      const count = seen.get(base) || 0
      seen.set(base, count + 1)
      return {
        stt: '', birthday: '', phone: '', gender: '', address: '', note: '', marriedAt: '', avatar: '',
        ...p,
        name: String(p.name).trim(),
        lunar: isTruthyCell(p.lunar),
        id: count ? `${base}-${count}` : base,
      }
    })
}
