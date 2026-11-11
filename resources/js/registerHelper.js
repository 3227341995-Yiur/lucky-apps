// Handlebars 自定义 helper 注册（系统插件）
// 依赖（由扩展加载器保证顺序，见 src/packages/extensions/loader.js）：
//   window.__luckyModules - 宿主 client module loader
//   window.marked         - resources/js/marked.min.js（字母序在本文件之前加载）
(function() {
  const H = typeof window.__luckyModules?.require === 'function'
    ? window.__luckyModules.require('handlebars')
    : null
  if (!H) {
    console.error('[registerHelper] Handlebars 未加载，helper 注册失败')
    return
  }
  const SafeString = H.SafeString

  H.registerHelper('not', function(o1, o2) {
    return o1 !== o2
  })

  H.registerHelper('eq', (a, b) => a === b)
  H.registerHelper('ne', (a, b) => a !== b)
  H.registerHelper('gt', (a, b) => Number(a) > Number(b))
  H.registerHelper('gte', (a, b) => Number(a) >= Number(b))
  H.registerHelper('lt', (a, b) => Number(a) < Number(b))
  H.registerHelper('lte', (a, b) => Number(a) <= Number(b))

  H.registerHelper('and', (...args) => args.slice(0, -1).every(Boolean))
  H.registerHelper('or', (...args) => args.slice(0, -1).some(Boolean))

  H.registerHelper('lookup', (obj, key) => {
    if (obj === null || obj === undefined || key === null || key === undefined) return ''
    return obj[key] ?? ''
  })

  H.registerHelper('add', (a, b) => Number(a) + Number(b))
  H.registerHelper('includes', (list, value) => {
    if (Array.isArray(list)) return list.includes(value)
    return String(list ?? '').includes(String(value ?? ''))
  })
  H.registerHelper('join', (list, separator) => (
    Array.isArray(list) ? list.join(separator ?? ', ') : ''
  ))
  H.registerHelper('json', value => new SafeString(JSON.stringify(value ?? null, null, 2)))
  H.registerHelper('default', (value, fallback) => (
    value === undefined || value === null || value === '' ? fallback : value
  ))
  H.registerHelper('formatDate', (value, format) => {
    if (!window.moment) return value ?? ''
    const parsed = window.moment(value)
    return parsed.isValid() ? parsed.format(format || 'YYYY-MM-DD') : ''
  })
  H.registerHelper('now', () => Date.now())

  // Markdown 渲染 helper
  // SafeString：让 {{markdown x}} 单花括号即可输出渲染后的 HTML，
  // 否则 Handlebars 会把返回的 HTML 当纯文本再转义一次（必须写 {{{}}} 才不变形）
  H.registerHelper('markdown', (text) => {
    if (!text) return ''
    if (typeof window.marked === 'undefined') {
      throw new Error('[registerHelper] marked 未加载，markdown helper 不可用')
    }
    return new SafeString(window.marked.parse(text, { async: false }))
  })
})();
