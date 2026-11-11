/**
 * 扩展系统安装入口
 *
 * 由 main.js 显式 await 调用（Vue app.use 不会等待 async install），
 * 保证外部脚本执行时 window.weekReport / window.Vue 等全局能力已就绪。
 */
import CodeEditor from '@/components/CodeEditor.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import MarkdownEditor from '@/components/editors/MarkdownEditor.vue'
import StatusSelector from '@/components/cells/StatusSelector.vue'
import DateSelector from '@/components/cells/DateSelector.vue'
import NumberInput from '@/components/cells/NumberInput.vue'
import TextareaCell from '@/components/cells/TextareaCell.vue'
import SelectCell from '@/components/cells/SelectCell.vue'
import MultiSelectCell from '@/components/cells/MultiSelectCell.vue'
import SwitchCell from '@/components/cells/SwitchCell.vue'
import StatusSelectorColumnModify from '@/components/column-extensions/StatusSelectorColumnModify.vue'
import {
  setPluginApp,
  registerComponent,
  registerColumnSlot,
  markExtensionsReady,
} from '@/plugins/registry'
import { loadExtensionResources, startExtensionWatcher } from '@/plugins/loader'

async function installGlobalModules() {
  window.Vue = await import('vue')
  window.ElementPlus = await import('element-plus')
  window.ElementPlusIconsVue = await import('@element-plus/icons-vue')
  // 全局只保留一份 Handlebars 实例；reports 插件 external 后复用它，
  // resources/js/registerHelper.js 注册的 helper 对模板预览/导出同时生效。
  const handlebars = await import('handlebars')
  window.Handlebars = handlebars.default || handlebars
  window.VditorModule = await import('vditor')
}

function installBuiltinComponents(app) {
  app.component('AppDialog', AppDialog)
  app.component('CodeEditor', CodeEditor)
  app.component('MarkdownEditor', MarkdownEditor)

  registerComponent('StatusSelector', StatusSelector, {
    value: 'status-selector',
    source: 'builtin',
    description: '下拉状态',
  })
  registerComponent('DateSelector', DateSelector, {
    value: 'date-selector',
    source: 'builtin',
    description: '日期选择',
  })
  registerComponent('NumberInput', NumberInput, {
    value: 'number-input',
    source: 'builtin',
    description: '数字输入',
  })
  registerComponent('Textarea', TextareaCell, {
    value: 'textarea',
    source: 'builtin',
    description: '多行文本',
  })
  registerComponent('Select', SelectCell, {
    value: 'select',
    source: 'builtin',
    description: '下拉单选',
  })
  registerComponent('MultiSelect', MultiSelectCell, {
    value: 'multi-select',
    source: 'builtin',
    description: '下拉多选',
  })
  registerComponent('Switch', SwitchCell, {
    value: 'switch',
    source: 'builtin',
    description: '开关',
  })
  registerColumnSlot('StatusSelector', StatusSelectorColumnModify, { source: 'builtin' })
  registerColumnSlot('Select', StatusSelectorColumnModify, { source: 'builtin' })
  registerColumnSlot('MultiSelect', StatusSelectorColumnModify, { source: 'builtin' })
}

export async function installExtensions(app) {
  setPluginApp(app)
  installBuiltinComponents(app)
  await installGlobalModules()
  await loadExtensionResources()
  markExtensionsReady()
  // 监听 AppData/plugins，外部插件变更时热加载（失败不阻塞应用启动）
  startExtensionWatcher().catch(error => console.warn('[plugins] 热监听启动失败:', error))
}

export default { install: installExtensions }
