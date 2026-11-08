<script setup>
import { onMounted, ref, shallowRef } from 'vue'
import CalendarApp from './components/CalendarApp.vue'
import LoginView from './components/LoginView.vue'
import { config } from './config.js'
import { decryptPayload, exportKey, importKey } from './utils/crypto.js'
import { normalizePeople } from './utils/people.js'
import { setPhotoKey } from './utils/photos.js'
import { session } from './utils/storage.js'

const CACHE_KEY = 'a1-data-v3'

const people = shallowRef(null)
const generatedAt = ref('')
const error = ref('')
const loading = ref(true)
const unlocking = ref(false)
let encPayload = null

function setData(json) {
  const list = Array.isArray(json) ? json : json?.people
  if (!Array.isArray(list)) throw new Error('Dữ liệu không đúng định dạng')
  people.value = normalizePeople(list)
  generatedAt.value = json?.generatedAt || ''
}

async function fetchJson(name, message) {
  const res = await fetch(`${import.meta.env.BASE_URL}${name}`, { cache: 'no-cache' })
  if (!res.ok) throw new Error(message)
  return res.json()
}

// Luôn tải lại data.enc khi cần, kể cả khi trước đó dữ liệu được lấy từ cache phiên.
async function loadEncrypted() {
  if (!encPayload) encPayload = await fetchJson('data.enc', 'Không tải được dữ liệu mã hoá. Hãy chạy npm run sync')
  return encPayload
}

onMounted(async () => {
  try {
    if (!config.requireAuth) {
      setData(await fetchJson('data.json', 'Không tải được dữ liệu'))
      return
    }
    const cached = session.get(CACHE_KEY)
    if (cached) {
      try {
        const json = JSON.parse(cached)
        if (json.key) setPhotoKey(await importKey(json.key))
        setData(json)
        return
      } catch {
        session.remove(CACHE_KEY)
      }
    }
    await loadEncrypted()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
})

async function login(password) {
  error.value = ''
  unlocking.value = true
  try {
    const payload = await loadEncrypted()
    const { text, key } = await decryptPayload(payload, password)
    const json = JSON.parse(text)
    setData(json)
    setPhotoKey(key)
    session.set(CACHE_KEY, JSON.stringify({
      people: json.people || json,
      generatedAt: json.generatedAt || '',
      key: await exportKey(key),
    }))
  } catch (err) {
    error.value = err.message || 'Mật khẩu không đúng'
  } finally {
    unlocking.value = false
  }
}

function logout() {
  people.value = null
  error.value = ''
  setPhotoKey(null)
  session.remove(CACHE_KEY)
  loadEncrypted().catch((err) => { error.value = err.message })
}
</script>

<template>
  <div v-if="loading" class="grid min-h-screen place-items-center" role="status" aria-label="Đang tải">
    <div class="flex flex-col items-center gap-4 text-muted">
      <span class="h-10 w-10 animate-spin rounded-full border-[3px] border-line border-t-clay" />
      <span class="text-sm">Đang tải lịch…</span>
    </div>
  </div>
  <CalendarApp v-else-if="people" :people="people" :generated-at="generatedAt" @logout="logout" />
  <LoginView v-else-if="config.requireAuth" :error="error" :loading="unlocking" @submit="login" />
  <div v-else class="grid min-h-screen place-items-center px-4 text-center">
    <div>
      <p class="text-4xl">⚠️</p>
      <p class="mt-3 text-sunday">{{ error }}</p>
    </div>
  </div>
</template>
