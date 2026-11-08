const encoder = new TextEncoder()
const decoder = new TextDecoder()

function b64ToBytes(value) {
  const binary = atob(value)
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
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
    false,
    ['decrypt'],
  )
}

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
    return decoder.decode(plain)
  } catch {
    throw new Error('Mật khẩu không đúng')
  }
}
