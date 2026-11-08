import { createCipheriv, createHash, pbkdf2Sync, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
loadEnv(join(root, '.env'))

const SAMPLE = process.argv.includes('--sample')
const ITERATIONS = 210000
const SAMPLE_PASSWORD = 'a1-class'
const publicDir = join(root, 'public')
mkdirSync(publicDir, { recursive: true })

// Chấp nhận "false", "False", " false ", "0", "no", "off", "không"… (khớp với src/config.js)
const OFF_VALUES = ['false', '0', 'no', 'off', 'khong', 'không']
const authSetting = process.env.REQUIRE_AUTH || process.env.VITE_REQUIRE_AUTH || ''
const requireAuth = !OFF_VALUES.includes(authSetting.trim().toLowerCase())
const useSample = SAMPLE || !process.env.SHEET_ID

console.log(
  requireAuth
    ? `Chế độ: CÓ đăng nhập, dữ liệu được mã hoá (REQUIRE_AUTH=${JSON.stringify(authSetting)})`
    : `Chế độ: KHÔNG đăng nhập, dữ liệu công khai (REQUIRE_AUTH=${JSON.stringify(authSetting)})`,
)

// Trên CI tuyệt đối không deploy dữ liệu mẫu, cũng không mã hoá bằng mật khẩu mặc định (đã công khai trong README).
if (process.env.CI && !SAMPLE && !process.env.SHEET_ID) {
  fail('Thiếu secret SHEET_ID trên GitHub Actions.')
}
if (requireAuth && !useSample && !process.env.APP_PASSWORD) {
  fail(
    'Thiếu APP_PASSWORD. Không thể mã hoá dữ liệu thật bằng mật khẩu mặc định. '
    + 'Nếu muốn tắt đăng nhập, đặt REQUIRE_AUTH=false trong tab Variables của GitHub.',
  )
}
if (requireAuth && !useSample && process.env.APP_PASSWORD === SAMPLE_PASSWORD) {
  console.warn('⚠️  APP_PASSWORD đang trùng mật khẩu mẫu công khai, hãy đổi sang mật khẩu riêng.')
}
if (!SAMPLE && !process.env.SHEET_ID) {
  console.warn('Không có SHEET_ID, dùng dữ liệu mẫu. Chạy với --sample hoặc khai báo SHEET_ID.')
}

// main() được gọi ở CUỐI file, sau khi mọi hằng số (HEADERS, TRUTHY…) đã khởi tạo.
async function main() {
  const password = process.env.APP_PASSWORD || SAMPLE_PASSWORD
  const people = useSample ? samplePeople() : await fetchSheetPeople()

  // Avatar: thư mục Drive (DRIVE_AVATAR_FOLDER_ID) hoặc thư mục trên máy (AVATAR_DIR, để thử nghiệm)
  const folderId = process.env.DRIVE_AVATAR_FOLDER_ID
  const localDir = process.env.AVATAR_DIR
  let photos = new Map()
  if (localDir || (folderId && !useSample)) {
    try {
      const { attachAvatars } = await import('./avatars.mjs')
      photos = await attachAvatars(people, { folderId, localDir, getToken: getGoogleToken })
    } catch (err) {
      // Lỗi ảnh không được làm hỏng cả lần đồng bộ: vẫn deploy lịch, chỉ thiếu avatar
      console.warn(`⚠️  Bỏ qua avatar: ${err.message.split('\n')[0].slice(0, 300)}`)
    }
  }

  // Một khoá dùng chung cho data.enc và các ảnh lớn (trình duyệt chỉ cần nhập mật khẩu một lần)
  const salt = randomBytes(16)
  const key = requireAuth ? pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256') : null
  writePhotos(people, photos, key)

  const payload = {
    generatedAt: new Date().toISOString(),
    people,
  }

  if (requireAuth) {
    writeFileSync(join(publicDir, 'data.enc'), JSON.stringify(encryptJson(JSON.stringify(payload), key, salt)))
    removePublic('data.json')
  } else {
    writeFileSync(join(publicDir, 'data.json'), JSON.stringify(payload, null, 2))
    removePublic('data.enc')
  }

  writeFileSync(
    join(publicDir, 'meta.json'),
    JSON.stringify({ generatedAt: payload.generatedAt, count: people.length, encrypted: requireAuth }, null, 2),
  )

  console.log(
    `Đã ghi ${people.length} người → public/${requireAuth ? 'data.enc' : 'data.json'} (${requireAuth ? 'đã mã hoá' : 'public'})`,
  )
}

// ——————————————————————————————————————————————

function fail(message) {
  console.error(`✖ ${message}`)
  process.exit(1)
}

function removePublic(name) {
  const path = join(publicDir, name)
  if (existsSync(path)) unlinkSync(path)
}

function loadEnv(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx < 0) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] == null) process.env[key] = value
  }
}

/** AES-256-GCM → [iv 12 byte][dữ liệu mã hoá][tag 16 byte] */
function encryptBytes(plain, key) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  return { iv, data: Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]) }
}

function encryptJson(plain, key, salt) {
  const { iv, data } = encryptBytes(Buffer.from(plain, 'utf8'), key)
  return {
    v: 1,
    kdf: 'pbkdf2-sha256',
    iter: ITERATIONS,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    data: data.toString('base64'),
  }
}

/**
 * Ảnh lớn (popup) → public/avatars/, gắn đường dẫn vào person.photo.
 *   Có đăng nhập: file .bin mã hoá bằng cùng khoá với data.enc, tên ngẫu nhiên.
 *   Public:       file .webp, tên theo hash nội dung (trình duyệt cache được, đổi ảnh thì đổi tên).
 * Thư mục được xoá sạch mỗi lần đồng bộ để không sót ảnh cũ.
 */
function writePhotos(people, photos, key) {
  const dir = join(publicDir, 'avatars')
  rmSync(dir, { recursive: true, force: true })
  for (const person of people) delete person.photo
  if (!photos.size) return
  mkdirSync(dir, { recursive: true })
  for (const [person, buffer] of photos) {
    let name
    if (key) {
      const { iv, data } = encryptBytes(buffer, key)
      name = `${randomBytes(9).toString('hex')}.bin`
      writeFileSync(join(dir, name), Buffer.concat([iv, data]))
    } else {
      name = `${createHash('sha256').update(buffer).digest('hex').slice(0, 16)}.webp`
      writeFileSync(join(dir, name), buffer)
    }
    person.photo = `avatars/${name}`
  }
}

function strip(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const HEADERS = {
  stt: 'stt',
  'ho ten': 'name',
  'ho va ten': 'name',
  ten: 'name',
  'ngay sinh': 'birthday',
  'sinh nhat': 'birthday',
  'so dien thoai': 'phone',
  'dien thoai': 'phone',
  sdt: 'phone',
  'gioi tinh': 'gender',
  'dia chi': 'address',
  'ghi chu': 'note',
  'da lay chong vo': 'marriedAt',
  'ngay cuoi': 'marriedAt',
  'ngay ket hon': 'marriedAt',
  avatar: 'avatar',
  anh: 'avatar',
  'anh dai dien': 'avatar',
  'am lich': 'lunar',
  'lich am': 'lunar',
  'sinh nhat am': 'lunar',
  'sn am': 'lunar',
  'tinh theo am lich': 'lunar',
}

function headerKey(header) {
  return HEADERS[strip(header)] || null
}

// Nhận "DD/MM/YYYY", "D-M-YY", "DD.MM" (không năm), "YYYY-MM-DD". Không rõ năm → "0000-MM-DD".
function parseVnDate(value) {
  if (value == null || value === '') return ''
  const text = String(value).trim()
  const iso = text.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  // Khớp cả ô; nếu không được thì tìm một ngày đầy đủ nằm trong chữ, ví dụ "~28/10/2024" hay "28/10/2024?"
  const match = text.match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?$/)
    || text.match(/(?<!\d)(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?!\d)/)
  if (!match) return text
  let [, d, m, y = '0000'] = match
  if (Number(m) < 1 || Number(m) > 12 || Number(d) < 1 || Number(d) > 31) return text
  if (y.length === 2) y = Number(y) > 50 ? `19${y}` : `20${y}`
  return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

// Google Sheets lưu SĐT dạng số nên mất số 0 đầu (0352416008 → 352416008). Khôi phục lại.
function normalizePhone(value) {
  const text = String(value ?? '').trim()
  const digits = text.replace(/[\s.\-()]/g, '')
  if (/^[1-9]\d{8}$/.test(digits)) return `0${digits}`
  if (/^\+?84[1-9]\d{8}$/.test(digits)) return `0${digits.replace(/^\+?84/, '')}`
  return text
}

const TRUTHY = new Set(['x', 'v', 'co', 'yes', 'y', '1', 'true', 'am', 'am lich', 'lich am'])
function isTruthyCell(value) {
  const text = String(value ?? '').trim()
  return TRUTHY.has(strip(text)) || ['✓', '✔', '☑'].includes(text)
}

function rowsToPeople(values) {
  if (!values?.length) return []
  const headers = values[0].map(headerKey)
  const people = []
  for (const row of values.slice(1)) {
    const person = {
      stt: '', name: '', birthday: '', phone: '', gender: '', address: '', note: '', marriedAt: '', avatar: '', lunar: false,
    }
    headers.forEach((key, index) => {
      if (!key) return
      const raw = row[index] ?? ''
      if (key === 'birthday' || key === 'marriedAt') person[key] = parseVnDate(raw)
      else if (key === 'lunar') person[key] = isTruthyCell(raw)
      else if (key === 'phone') person[key] = normalizePhone(raw)
      else person[key] = String(raw).trim()
    })
    if (person.name) people.push(person)
  }
  return people
}

let googleClient = null
async function getGoogleToken() {
  if (!googleClient) {
    const { GoogleAuth } = await import('google-auth-library')
    const auth = new GoogleAuth({
      credentials: readCredentials(),
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/drive.readonly',
      ],
    })
    googleClient = await auth.getClient()
  }
  const token = await googleClient.getAccessToken()
  return token.token || token
}

async function fetchSheetPeople() {
  const id = process.env.SHEET_ID
  const range = encodeURIComponent(process.env.SHEET_RANGE || 'A1:Z1000')
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${range}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${await getGoogleToken()}` },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google Sheets API ${res.status}: ${body}`)
  }
  const json = await res.json()
  const result = rowsToPeople(json.values || [])
  if (!result.length) fail('Sheet không có dòng nào có "Họ tên". Kiểm tra lại tên cột và SHEET_RANGE.')
  return result
}

function readCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (raw) {
    try {
      return JSON.parse(raw)
    } catch {
      return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
    }
  }
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (file && existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  const fallback = join(root, 'service-account.json')
  if (existsSync(fallback)) return JSON.parse(readFileSync(fallback, 'utf8'))
  fail('Thiếu GOOGLE_SERVICE_ACCOUNT_JSON hoặc service-account.json')
}

// Dữ liệu mẫu: vài ngày sinh tính theo hôm nay để thấy banner "Hôm nay" và mục "Sắp tới".
function samplePeople() {
  const now = new Date()
  const rel = (days, year) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days)
    return `${year}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const p = (stt, name, birthday, gender, extra = {}) => ({
    stt: String(stt),
    name,
    birthday,
    phone: `09000000${String(stt).padStart(2, '0')}`,
    gender,
    address: 'Hà Nội',
    note: '',
    marriedAt: '',
    avatar: '',
    lunar: false,
    ...extra,
  })
  return [
    p(1, 'Nguyễn Minh Anh', rel(0, 1995), 'Nam', { marriedAt: '2024-10-28' }),
    p(2, 'Trần Thu Hà', rel(3, 1995), 'Nữ', { note: 'Tổ trưởng', marriedAt: '2023-01-21' }),
    p(3, 'Lê Lan Chi', '1995-02-22', 'Nữ', { marriedAt: rel(9, 2020) }),
    p(4, 'Phạm Hoàng Nam', rel(12, 1995), 'Nam'),
    p(5, 'Vũ Bảo Ngọc', '1995-03-13', 'Nữ', { marriedAt: '2024-10-19', address: '12 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội' }),
    p(6, 'Đỗ Thanh Tùng', '1995-08-12', 'Nam', { marriedAt: '2021-03-21' }),
    p(7, 'Hoàng Gia Huy', rel(12, 1996), 'Nam', { note: 'Lớp phó' }),
    p(8, 'Bùi Khánh Linh', '1995-04-19', 'Nữ', { lunar: true, note: 'Tổ chức sinh nhật theo âm lịch' }),
    p(9, 'Ngô Quang Đức', '1996-02-29', 'Nam'),
    p(10, 'Đặng Mai Phương', '1995-12-24', 'Nữ', { phone: '' }),
    p(11, 'Phan Tuấn Kiệt', '1995-01-07', ''),
    p(12, 'Lý Hải Yến', '1995-06-30', 'Nữ', { lunar: true }),
  ]
}

await main()
