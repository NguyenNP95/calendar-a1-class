/**
 * Tải avatar Facebook về thư mục Google Drive, đặt tên theo STT (1.jpg, 2.jpg…).
 * Web lịch (calendar-a1-class) đọc thư mục này khi đồng bộ và gắn ảnh theo STT.
 *
 * File này chạy trong Google Apps Script (https://script.google.com), KHÔNG chạy trong repo.
 * Không chứa token: token Facebook nằm trong Script Properties, chỉ tài khoản Google của bạn xem được.
 * Logic giống app Android ContactSync:
 *   - ảnh:      GET graph.facebook.com/{uid}/picture?width=720&height=720&redirect=false
 *   - username: POST id.traodoisub.com/api.php (giãn cách 3 giây, thử lại khi bị báo "chậm lại")
 *   - chỉ tải lại khi ảnh thật sự đổi (so sánh host + path của URL ảnh)
 * Ảnh AVIF (Apps Script không tải được) đi qua wsrv.nl để chuyển sang JPG, xem downloadImage().
 *
 * ── Cài đặt ──────────────────────────────────────────────────────────────────
 *  1. script.google.com → New project → dán toàn bộ file này vào Code.gs → Save
 *  2. Project Settings (⚙) → Script Properties → Add script property:
 *       FB_TOKEN          User access token Facebook (giống token dán trong app Android)
 *       LIST_ID           ID của danh sách: một Google Sheet HOẶC một file .csv trên Drive
 *       AVATAR_FOLDER_ID  ID thư mục Drive chứa ảnh (phần sau /folders/ trong link)
 *       LIST_SHEET_NAME   (tuỳ chọn) tên tab nếu danh sách là Google Sheet có nhiều tab
 *  3. Danh sách gồm 3 cột, có hoặc không có dòng tiêu đề:
 *       STT, Tên, fbid
 *       1, Nguyễn Văn A, 100002652671063
 *       2, Trần Thị B, https://www.facebook.com/tran.thi.b
 *     fbid nhận: ID số, username, link profile.php?id=…, link facebook.com/<username>
 *     STT phải trùng với cột STT trên Sheet của web lịch.
 *  4. Chọn hàm checkList → Run: xem danh sách đọc được có đúng không (lần đầu Google hỏi quyền → Allow)
 *  5. Chọn hàm syncAvatars → Run: tải ảnh lần đầu
 *  6. Chọn hàm createWeeklyTrigger → Run một lần: tự chạy mỗi Chủ nhật 2–3 giờ sáng
 *
 * Token hết hạn → script dừng và gửi email báo cho bạn. Dán token mới vào FB_TOKEN là xong.
 */

const PICTURE_SIZE = 720
const GRAPH_PAUSE_MS = 300
const LOOKUP_URL = 'https://id.traodoisub.com/api.php'
const LOOKUP_GAP_MS = 3000
const LOOKUP_ATTEMPTS = 3
const MAX_RUNTIME_MS = 5 * 60 * 1000 // Apps Script giới hạn 6 phút mỗi lần chạy

// ─── Hàm chạy chính ──────────────────────────────────────────────────────────

function syncAvatars() {
  const started = Date.now()
  const props = PropertiesService.getScriptProperties()
  const token = requireProp(props, 'FB_TOKEN')
  const folder = DriveApp.getFolderById(requireProp(props, 'AVATAR_FOLDER_ID'))
  const list = readList(props)

  const stats = { updated: 0, unchanged: 0, silhouette: 0, failed: 0 }
  for (const item of list) {
    if (Date.now() - started > MAX_RUNTIME_MS) {
      console.warn('Sắp hết 6 phút, dừng lại. Lần chạy sau sẽ tiếp tục (ảnh không đổi được bỏ qua rất nhanh).')
      break
    }
    try {
      const uid = resolveUid(item.fb, props)
      const pic = lookupPicture(uid, token)
      if (pic.status === 'auth') {
        notifyTokenProblem(pic.message)
        throw new Error(`Token Facebook không dùng được: ${pic.message}. Đã dừng.`)
      }
      if (pic.status === 'silhouette') {
        stats.silhouette += 1
        console.log(`STT ${item.stt} (${item.name}): chỉ có ảnh mặc định, bỏ qua`)
        continue
      }
      if (pic.status !== 'ok') throw new Error(pic.message)
      const changed = saveIfChanged(folder, `${item.stt}.jpg`, pic.url)
      stats[changed ? 'updated' : 'unchanged'] += 1
    } catch (err) {
      if (String(err.message).startsWith('Token Facebook')) throw err
      stats.failed += 1
      console.warn(`STT ${item.stt} (${item.name}): ${err.message}`)
    }
    Utilities.sleep(GRAPH_PAUSE_MS)
  }

  console.log(
    `Xong ${list.length} người: ${stats.updated} ảnh mới/cập nhật, ${stats.unchanged} không đổi, `
    + `${stats.silhouette} không có ảnh, ${stats.failed} lỗi`,
  )
}

/** Chạy thử: chỉ đọc danh sách và tra ID, không tải ảnh. */
function checkList() {
  const props = PropertiesService.getScriptProperties()
  const list = readList(props)
  console.log(`Đọc được ${list.length} dòng`)
  list.forEach((item) => {
    try {
      console.log(`STT ${item.stt} · ${item.name} · ${item.fb} → uid ${resolveUid(item.fb, props)}`)
    } catch (err) {
      console.warn(`STT ${item.stt} · ${item.name} · ${item.fb} → LỖI: ${err.message}`)
    }
  })
}

/** Chạy một lần: tự động syncAvatars mỗi Chủ nhật lúc 2–3 giờ sáng. */
function createWeeklyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'syncAvatars')
    .forEach((t) => ScriptApp.deleteTrigger(t))
  ScriptApp.newTrigger('syncAvatars').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(2).everyWeeks(1).create()
  console.log('Đã đặt lịch: mỗi Chủ nhật lúc 2–3 giờ sáng')
}

/** Xoá cache username → ID (khi ai đó đổi username). */
function clearUidCache() {
  const props = PropertiesService.getScriptProperties()
  Object.keys(props.getProperties())
    .filter((key) => key.startsWith('uid:'))
    .forEach((key) => props.deleteProperty(key))
  console.log('Đã xoá cache username → ID')
}

// ─── Đọc danh sách STT, Tên, fbid ────────────────────────────────────────────

function readList(props) {
  const id = requireProp(props, 'LIST_ID')
  const file = DriveApp.getFileById(id)
  let rows
  if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
    const ss = SpreadsheetApp.openById(id)
    const tabName = props.getProperty('LIST_SHEET_NAME')
    const sheet = tabName ? ss.getSheetByName(tabName) : ss.getSheets()[0]
    if (!sheet) throw new Error(`Không thấy tab "${tabName}" trong danh sách`)
    rows = sheet.getDataRange().getDisplayValues()
  } else {
    rows = Utilities.parseCsv(file.getBlob().getDataAsString('UTF-8').replace(/^\uFEFF/, ''))
  }
  rows = rows.filter((row) => row.some((cell) => String(cell).trim()))
  if (!rows.length) return []

  // Có dòng tiêu đề nếu ô đầu tiên không phải số
  let cols = { stt: 0, name: 1, fb: 2 }
  if (!/^\d+$/.test(String(rows[0][0]).trim())) {
    const header = rows.shift().map(normalize)
    const find = (names, fallback) => {
      const index = header.findIndex((h) => names.includes(h))
      return index >= 0 ? index : fallback
    }
    cols = {
      stt: find(['stt', 'so thu tu', 'thu tu', 'no'], 0),
      name: find(['ten', 'ho ten', 'ho va ten', 'name', 'title'], 1),
      fb: find(['fbid', 'fb id', 'facebook', 'facebook id', 'uid', 'user id', 'username', 'link', 'link facebook', 'link fb'], 2),
    }
  }

  return rows
    .map((row) => ({
      stt: String(row[cols.stt] ?? '').trim(),
      name: String(row[cols.name] ?? '').trim(),
      fb: String(row[cols.fb] ?? '').trim(),
    }))
    .filter((item) => item.stt && item.fb)
}

// ─── Facebook ────────────────────────────────────────────────────────────────

/** ID số / link / username → uid dạng số. Username được tra qua id.traodoisub.com và lưu cache. */
function resolveUid(input, props) {
  const ref = parseProfile(input)
  if (!ref) throw new Error('fbid / link không hợp lệ')
  if (ref.id) return ref.id

  const cacheKey = `uid:${ref.username.toLowerCase()}`
  const cached = props.getProperty(cacheKey)
  if (cached) return cached

  for (let attempt = 0; attempt < LOOKUP_ATTEMPTS; attempt += 1) {
    waitForLookupSlot()
    const res = UrlFetchApp.fetch(LOOKUP_URL, {
      method: 'post',
      payload: { link: `https://www.facebook.com/${ref.username}` },
      muteHttpExceptions: true,
    })
    let json = null
    try {
      json = JSON.parse(res.getContentText())
    } catch (e) {
      /* không phải JSON */
    }
    const id = json && /^\d+$/.test(String(json.id || '')) ? String(json.id) : ''
    if (id) {
      props.setProperty(cacheKey, id)
      return id
    }
    const error = json && json.error ? String(json.error) : ''
    if (!error.includes('chậm lại')) throw new Error(error || `Không tra được ID (HTTP ${res.getResponseCode()})`)
  }
  throw new Error('Dịch vụ tra ID đang giới hạn, lần chạy sau sẽ thử lại')
}

let lastLookupAt = 0
function waitForLookupSlot() {
  const wait = lastLookupAt + LOOKUP_GAP_MS - Date.now()
  if (wait > 0) Utilities.sleep(wait)
  lastLookupAt = Date.now()
}

function parseProfile(raw) {
  const text = String(raw).trim()
  if (/^\d+$/.test(text)) return { id: text }
  if (/^[A-Za-z0-9.]+$/.test(text) && !text.includes('facebook')) return { username: text }

  const match = text.match(/^(?:https?:\/\/)?(?:[\w-]+\.)?(?:facebook\.com|fb\.com)\/([^?#]*)(\?[^#]*)?/i)
  if (!match) return null
  const segments = match[1].split('/').filter(Boolean)
  const query = match[2] || ''
  const first = segments[0] || ''

  if (first.toLowerCase() === 'profile.php') {
    const id = (query.match(/[?&]id=(\d+)/) || [])[1]
    return id ? { id } : null
  }
  if (first.toLowerCase() === 'people') {
    const id = segments[2]
    return id && /^\d+$/.test(id) ? { id } : null
  }
  if (/^\d+$/.test(first)) return { id: first }
  if (NOT_PROFILE_PATHS.includes(first.toLowerCase())) return null
  if (/^[A-Za-z0-9.]+$/.test(first)) return { username: first }
  return null
}

const NOT_PROFILE_PATHS = ['groups', 'pages', 'events', 'watch', 'photo', 'photos', 'story.php', 'permalink.php', 'share', 'reel', 'marketplace', 'messages', 'login']

/** Giống AvatarDownloader.lookupPicture của app Android. */
function lookupPicture(uid, token) {
  const url = `https://graph.facebook.com/${encodeURIComponent(uid)}/picture`
    + `?width=${PICTURE_SIZE}&height=${PICTURE_SIZE}&redirect=false&access_token=${encodeURIComponent(token)}`
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true })
  const code = res.getResponseCode()
  let json = {}
  try {
    json = JSON.parse(res.getContentText())
  } catch (e) {
    /* không phải JSON */
  }
  const error = json.error || null
  if (code === 401 || code === 403 || (error && (error.code === 190 || error.type === 'OAuthException'))) {
    return { status: 'auth', message: error ? error.message : `HTTP ${code}` }
  }
  if (code === 429 || (error && [4, 17, 32, 613].includes(error.code))) return { status: 'error', message: 'Facebook đang giới hạn tốc độ' }
  if (code === 404) return { status: 'error', message: 'Không tìm thấy tài khoản' }
  if (error || code !== 200 || !json.data) return { status: 'error', message: error ? error.message : `HTTP ${code}` }
  if (json.data.is_silhouette) return { status: 'silhouette' }
  return { status: 'ok', url: json.data.url }
}

// ─── Drive ───────────────────────────────────────────────────────────────────

/** URL ảnh đổi query mỗi lần gọi dù cùng ảnh → so sánh host + path (giống FacebookPictureUrls.stableKey). */
function stableKey(url) {
  return String(url || '').split('?')[0].toLowerCase().replace(/\/+$/, '')
}

/** Trả về true nếu đã tải ảnh mới; false nếu ảnh không đổi so với lần trước. */
function saveIfChanged(folder, fileName, pictureUrl) {
  const key = stableKey(pictureUrl)
  const existing = []
  const files = folder.getFilesByName(fileName)
  while (files.hasNext()) existing.push(files.next())
  if (existing.length === 1 && existing[0].getDescription() === key) return false

  const blob = downloadImage(pictureUrl) // lỗi → ném ra, ảnh cũ trên Drive được giữ nguyên
  existing.forEach((file) => file.setTrashed(true))
  folder.createFile(blob.setName(fileName)).setDescription(key)
  return true
}

/**
 * UrlFetchApp KHÔNG tải được ảnh AVIF từ CDN Facebook (luôn báo "Lỗi không mong muốn"),
 * và Facebook không cho đổi sang JPG. Ảnh AVIF được tải qua wsrv.nl (dịch vụ ảnh miễn phí,
 * mã nguồn mở) để chuyển sang JPG. Chỉ link ảnh công khai được gửi đi, không có token.
 * Ảnh JPG vẫn tải trực tiếp; chỉ dùng wsrv.nl khi tải trực tiếp lỗi.
 */
function downloadImage(url) {
  const isAvif = /dst-avif|\.avif(\?|$)/i.test(url)
  const errors = []
  if (!isAvif) {
    try {
      return fetchImage(url, 2)
    } catch (err) {
      errors.push(`trực tiếp: ${shortError(err)}`)
    }
  }
  try {
    return fetchImage(`${IMAGE_PROXY}?url=${encodeURIComponent(url)}&output=jpg&w=480&h=480&fit=cover&q=85`, 2)
  } catch (err) {
    errors.push(`qua wsrv.nl: ${shortError(err)}`)
  }
  throw new Error(`Tải ảnh ${isAvif ? 'AVIF ' : ''}lỗi (${errors.join(' | ')})`)
}

const IMAGE_PROXY = 'https://wsrv.nl/'

function fetchImage(url, attempts) {
  let lastError = null
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true })
      const code = res.getResponseCode()
      const type = String(res.getHeaders()['Content-Type'] || res.getHeaders()['content-type'] || '')
      if (code === 200 && type.startsWith('image/')) return res.getBlob()
      lastError = new Error(code === 200 ? `không phải ảnh (${type})` : `HTTP ${code}`)
      if (code === 403 || code === 404) break // link hết hạn / sai chữ ký: thử lại cũng vô ích
    } catch (err) {
      lastError = err
    }
    if (attempt < attempts) Utilities.sleep(1500 * attempt)
  }
  throw lastError
}

/** Bỏ URL dài khỏi thông báo lỗi của UrlFetchApp. */
function shortError(err) {
  return String(err && err.message ? err.message : err).replace(/:?\s*https?:\/\/\S+/g, '').trim() || 'lỗi'
}

// ─── Tiện ích ────────────────────────────────────────────────────────────────

function requireProp(props, name) {
  const value = props.getProperty(name)
  if (!value) throw new Error(`Thiếu Script Property "${name}" (Project Settings → Script Properties)`)
  return value.trim()
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Gửi email cho chủ script khi token hết hạn (tối đa 1 lần/ngày). */
function notifyTokenProblem(message) {
  const props = PropertiesService.getScriptProperties()
  const today = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd')
  if (props.getProperty('lastTokenMail') === today) return
  props.setProperty('lastTokenMail', today)
  MailApp.sendEmail(
    Session.getEffectiveUser().getEmail(),
    '[Lịch A1] Token Facebook cần cập nhật',
    `Script tải avatar không chạy được vì token Facebook lỗi:\n\n${message}\n\n`
    + 'Vào script.google.com → project này → Project Settings → Script Properties → sửa FB_TOKEN.',
  )
}
