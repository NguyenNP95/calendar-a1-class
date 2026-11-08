// localStorage / sessionStorage có thể bị chặn (chế độ ẩn danh, trình duyệt cũ) → luôn bọc try/catch.
function wrap(getStore) {
  return {
    get(key) {
      try {
        return getStore().getItem(key)
      } catch {
        return null
      }
    },
    set(key, value) {
      try {
        getStore().setItem(key, value)
      } catch {
        /* bỏ qua */
      }
    },
    remove(key) {
      try {
        getStore().removeItem(key)
      } catch {
        /* bỏ qua */
      }
    },
  }
}

export const storage = wrap(() => window.localStorage)
export const session = wrap(() => window.sessionStorage)
