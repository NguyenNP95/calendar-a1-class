// Ảnh lớn cho popup: file riêng trong avatars/, chỉ tải khi mở popup.
//   .webp → dùng thẳng (bản public)
//   .bin  → đã mã hoá cùng khoá với data.enc, tải về rồi giải mã thành blob URL
import { decryptBytes } from './crypto.js'

let photoKey = null
const cache = new Map() // path → Promise<url>

export function setPhotoKey(key) {
  photoKey = key || null
  for (const promise of cache.values()) {
    promise.then((url) => url.startsWith('blob:') && URL.revokeObjectURL(url), () => {})
  }
  cache.clear()
}

/** Đường dẫn person.photo → URL hiển thị được. Lỗi / thiếu khoá → '' (popup dùng ảnh nhỏ). */
export function photoUrl(path) {
  if (!path) return Promise.resolve('')
  const url = `${import.meta.env.BASE_URL}${path}`
  if (!path.endsWith('.bin')) return Promise.resolve(url)
  if (!photoKey) return Promise.resolve('')
  if (!cache.has(path)) {
    const key = photoKey
    const promise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.arrayBuffer()
      })
      .then((buffer) => decryptBytes(buffer, key))
      .then((plain) => URL.createObjectURL(new Blob([plain], { type: 'image/webp' })))
    promise.catch(() => cache.delete(path))
    cache.set(path, promise)
  }
  return cache.get(path).catch(() => '')
}
