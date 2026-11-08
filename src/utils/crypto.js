const encoder = new TextEncoder()
const decoder = new TextDecoder()

function b64ToBytes(value) {
  const binary = atob(value)
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
}

function bytesToB64(bytes) {
  let binary = ''
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte)
  return btoa(binary)
}

async function deriveKey(password, salt, iterations) {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    true, // xuất được để lưu cùng dữ liệu trong sessionStorage (dữ liệu đã giải mã cũng nằm ở đó)
    ['decrypt'],
  )
}

/** → { text, key }. key dùng tiếp để giải mã ảnh lớn (cùng khoá với data.enc). */
export async function decryptPayload(payload, password) {
  if (!payload?.salt || !payload?.iv || !payload?.data) {
    throw new Error('File dữ liệu không hợp lệ')
  }
  const salt = b64ToBytes(payload.salt)
  const iv = b64ToBytes(payload.iv)
  const data = b64ToBytes(payload.data)
  const key = await deriveKey(password, salt, payload.iter || 210000)
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
    return { text: decoder.decode(plain), key }
  } catch {
    throw new Error('Mật khẩu không đúng')
  }
}

/** File [iv 12 byte][dữ liệu mã hoá + tag] → ArrayBuffer gốc. */
export function decryptBytes(buffer, key) {
  const bytes = new Uint8Array(buffer)
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12))
}

export async function exportKey(key) {
  return bytesToB64(await crypto.subtle.exportKey('raw', key))
}

export function importKey(value) {
  return crypto.subtle.importKey('raw', b64ToBytes(value), { name: 'AES-GCM' }, true, ['decrypt'])
}
