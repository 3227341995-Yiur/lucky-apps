/**
 * 轻量防抖（不引入 lodash）
 */
export function debounce(fn, wait = 300) {
  let timer = null
  function debounced(...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn.apply(this, args)
    }, wait)
  }
  debounced.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }
  debounced.flush = (...args) => {
    debounced.cancel()
    return fn(...args)
  }
  return debounced
}

export default debounce
