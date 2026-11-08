// Gắn avatar cho từng người từ một thư mục ảnh (Google Drive hoặc thư mục trên máy).
//
// Tên file khớp theo STT ("12.jpg") hoặc họ tên ("Nguyen Van A.png", có dấu hay không đều được).
// Ảnh được thu nhỏ còn 160×160 WebP rồi nhúng vào dữ liệu dưới dạng data URL,
// nên nằm trong data.enc và được bảo vệ bằng mật khẩu như các thông tin khác.
//
// Lưu ý: log của GitHub Actions trên repo public ai cũng xem được → chỉ in số lượng, không in tên.

import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.avif'])
const SIZE = 160 // ảnh nhỏ nhúng trong dữ liệu: lịch, danh sách
const PHOTO_SIZE = 640 // ảnh lớn cho popup thông tin, file riêng, chỉ tải khi mở popup

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

function stem(fileName) {
  return fileName.slice(0, fileName.length - extname(fileName).length)
}

/** Danh sách ảnh trong thư mục Drive: [{ name, load: () => Promise<Buffer> }] */
async function listDriveImages(folderId, getToken) {
  const token = await getToken()
  const headers = { Authorization: `Bearer ${token}` }
  const files = []
  let pageToken = ''
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false and mimeType contains 'image/'`)
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name)`
      + `&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? `&pageToken=${pageToken}` : ''}`
    const res = await fetch(url, { headers })
    if (!res.ok) {
      const body = await res.text()
      let message = body
      try {
        message = JSON.parse(body).error.message
      } catch {
        /* giữ nguyên body */
      }
      throw new Error(`Google Drive API ${res.status}: ${message.replace(/\s+/g, ' ')}`)
    }
    const json = await res.json()
    files.push(...json.files)
    pageToken = json.nextPageToken || ''
  } while (pageToken)

  return files.map((file) => ({
    name: file.name,
    load: async () => {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return Buffer.from(await res.arrayBuffer())
    },
  }))
}

function listLocalImages(dir) {
  return readdirSync(dir)
    .filter((name) => IMAGE_EXT.has(extname(name).toLowerCase()))
    .map((name) => ({ name, load: async () => readFileSync(join(dir, name)) }))
}

let sharpModule
async function loadSharp() {
  if (sharpModule === undefined) sharpModule = await import('sharp').then((m) => m.default, () => null)
  return sharpModule
}

/** → { thumb: data URL nhỏ, photo: Buffer WebP lớn | null } */
async function processImage(buffer) {
  const sharp = await loadSharp()
  if (sharp) {
    // Ảnh hỏng → sharp báo lỗi → người đó không có avatar (hiện chữ cái tên)
    const base = sharp(buffer).rotate()
    const { width = 0, height = 0 } = await base.metadata()
    const square = (size, quality) => base.clone()
      .resize(size, size, { fit: 'cover', position: 'attention', withoutEnlargement: true })
      .webp({ quality })
      .toBuffer()
    const thumb = await square(SIZE, 78)
    // Ảnh gốc quá nhỏ thì không cần bản lớn: popup dùng luôn ảnh nhỏ
    const photo = Math.min(width, height) > SIZE * 1.5 ? await square(PHOTO_SIZE, 80) : null
    return { thumb: `data:image/webp;base64,${thumb.toString('base64')}`, photo }
  }
  // Không cài được sharp: chỉ nhận ảnh gốc nếu đủ nhỏ để không làm phình dữ liệu
  if (buffer.length > 80_000) throw new Error('ảnh quá lớn và không có sharp để thu nhỏ')
  return { thumb: `data:image/jpeg;base64,${buffer.toString('base64')}`, photo: null }
}

/**
 * Gắn person.avatar (ảnh nhỏ). Trả về Map person → Buffer ảnh lớn để script ghi ra file riêng.
 * @param {object[]} people
 * @param {{ folderId?: string, localDir?: string, getToken?: () => Promise<string> }} options
 * @returns {Promise<Map<object, Buffer>>}
 */
export async function attachAvatars(people, { folderId, localDir, getToken }) {
  const photos = new Map()
  const images = localDir ? listLocalImages(localDir) : await listDriveImages(folderId, getToken)
  const bySTT = new Map(people.filter((p) => p.stt).map((p) => [String(p.stt).trim(), p]))
  const byName = new Map(people.map((p) => [strip(p.name), p]))

  let matched = 0
  let unmatched = 0
  let failed = 0
  for (const image of images) {
    const key = stem(image.name).trim()
    const person = bySTT.get(key) || byName.get(strip(key))
    if (!person) {
      unmatched += 1
      continue
    }
    try {
      const { thumb, photo } = await processImage(await image.load())
      person.avatar = thumb
      if (photo) photos.set(person, photo)
      else photos.delete(person)
      matched += 1
    } catch {
      failed += 1
    }
  }

  const bytes = people.reduce((sum, p) => sum + (p.avatar?.startsWith('data:') ? p.avatar.length : 0), 0)
  const photoBytes = [...photos.values()].reduce((sum, b) => sum + b.length, 0)
  console.log(
    `Avatar: ${matched}/${people.length} người có ảnh từ ${localDir ? 'thư mục' : 'Drive'} `
    + `(${images.length} file, ${unmatched} không khớp STT/tên, ${failed} lỗi, ảnh nhỏ ~${Math.round(bytes / 1024)} KB, `
    + `${photos.size} ảnh lớn ~${Math.round(photoBytes / 1024)} KB)`,
  )
  return photos
}
