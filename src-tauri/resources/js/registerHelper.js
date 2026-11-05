// Handlebars 自定义 helper 注册（系统插件）
// 依赖（由扩展加载器保证顺序，见 src/plugins/loader.js）：
//   window.Handlebars - main.js initGlobalModules 挂载
//   window.marked     - resources/js/marked.min.js（字母序在本文件之前加载）
(function() {
  if (typeof window.Handlebars === 'undefined') {
    console.error('[registerHelper] Handlebars 未加载，helper 注册失败')
    return
  }

  // window.Handlebars 可能是 ESM 命名空间（named exports）或 default 导出，两种取法都兜住
  const H = window.Handlebars.default || window.Handlebars
  const SafeString = H.SafeString || window.Handlebars.SafeString

  H.registerHelper('not', function(o1, o2) {
    return o1 !== o2
  })

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
