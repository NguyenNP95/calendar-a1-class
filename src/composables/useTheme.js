import { ref, watch } from 'vue'
import { storage } from '../utils/storage.js'

const MODES = ['system', 'light', 'dark']
const mode = ref(MODES.includes(storage.get('a1-theme')) ? storage.get('a1-theme') : 'system')
const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null

function apply() {
  const dark = mode.value === 'dark' || (mode.value === 'system' && !!media?.matches)
  document.documentElement.classList.toggle('dark', dark)
}

media?.addEventListener?.('change', apply)
watch(mode, (value) => {
  if (value === 'system') storage.remove('a1-theme')
  else storage.set('a1-theme', value)
  apply()
})
apply()

export function useTheme() {
  function cycle() {
    mode.value = MODES[(MODES.indexOf(mode.value) + 1) % MODES.length]
  }
  return { mode, cycle }
}
