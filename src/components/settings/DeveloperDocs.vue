<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ArrowRight, Check, CopyDocument, Refresh, UploadFilled } from '@element-plus/icons-vue'
import DocCode from './DocCode.vue'
import { useExtensions } from '@/composables/useExtensions'

defineOptions({ name: 'DeveloperDocs' })

const { copyResourcesPath, rescan, hotReloadComponents } = useExtensions()

const navGroups = [
  {
    title: '开始',
    items: [
      { key: 'overview', label: '概览' },
      { key: 'quickstart', label: '快速开始' }
    ]
  },
  {
    title: '扩展',
    items: [
      { key: 'components', label: '外部组件' },
      { key: 'plugins', label: '插件脚本' },
      { key: 'columns', label: '列扩展' }
    ]
  },
  {
    title: '参考',
    items: [
      { key: 'api', label: 'API 参考' },
      { key: 'faq', label: '常见问题' }
    ]
  }
]

const flatItems = navGroups.flatMap(group => group.items)
const active = ref('overview')
const componentTab = ref('cell')
const contentRef = ref(null)
const copiedPath = ref(false)

const currentIndex = computed(() => flatItems.findIndex(item => item.key === active.value))
const prevItem = computed(() => flatItems[currentIndex.value - 1] || null)
const nextItem = computed(() => flatItems[currentIndex.value + 1] || null)

const fileTree = `resources/
├─ css/
│  └─ theme.css
├─ js/
│  └─ my-plugin.js
└─ comps/
   ├─ HelloCell.vue
   └─ HelloCell.cslot.vue`

const cellCode = `<script setup>
const value = defineModel({ type: String, default: '' })
defineProps({
  placeholder: { type: String, default: '输入内容' }
})
<\/script>

<template>
  <el-input v-model="value" :placeholder="placeholder" size="small" />
</template>`

const slotCode = `<script setup>
const column = defineModel()
<\/script>

<template>
  <div class="option-editor">
    <el-tag
      v-for="(option, index) in column.attrs?.options || []"
      :key="option"
      closable
      @close="column.attrs.options.splice(index, 1)"
    >{{ option }}</el-tag>
  </div>
</template>`

const moduleCode = `import { defineComponent, h } from 'vue'

export default defineComponent({
  props: { modelValue: Number },
  emits: ['update:modelValue'],
  setup(props) {
    return () => h('span', String(props.modelValue ?? 0))
  }
})`

const pluginCode = `const api = window.weekReport

api.ui.toast('插件已加载', 'success')

const off = api.events.on('report:created', report => {
  api.ui.toast(\`新建周报：\${report.title}\`)
})

api.commands.register('my-plugin.refresh', async payload => {
  const stats = await api.reports.stats()
  console.log(stats, payload)
}, { title: '刷新我的数据' })`

const columnCode = `const { defineComponent, h } = window.Vue

window.weekReport.components.register('rating', defineComponent({
  props: { modelValue: Number },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('el-rate', {
      modelValue: props.modelValue,
      'onUpdate:modelValue': value => emit('update:modelValue', value)
    })
  }
}), { description: '评分列' })`

function go(key) {
  active.value = key
  contentRef.value?.setScrollTop(0)
}

async function copyPath() {
  try {
    await copyResourcesPath()
    copiedPath.value = true
    ElMessage.success('扩展资源路径已复制')
    setTimeout(() => { copiedPath.value = false }, 1500)
  } catch {
    ElMessage.error('复制失败，请检查剪贴板权限')
  }
}

async function doRescan() {
  try {
    await rescan()
    ElMessage.success('扩展资源已重新扫描')
  } catch (error) {
    ElMessage.error(`扫描失败：${error?.message || error}`)
  }
}

async function doHotReload() {
  try {
    await hotReloadComponents()
    ElMessage.success('外部组件已热加载')
  } catch (error) {
    ElMessage.error(`热加载失败：${error?.message || error}`)
  }
}

function testToast() {
  window.weekReport?.ui?.toast?.('插件 API 正常：window.weekReport 可用', 'success')
}
</script>

<template>
  <div class="dev-docs">
    <el-scrollbar class="dev-docs-nav">
      <div class="docs-nav-inner">
        <div class="docs-brand">
          <span class="docs-brand-badge">API v2</span>
          <strong>开发文档</strong>
          <small>插件 · 外部组件 · 二开</small>
        </div>
        <div v-for="group in navGroups" :key="group.title" class="docs-nav-group">
          <span class="docs-nav-title">{{ group.title }}</span>
          <button
            v-for="item in group.items"
            :key="item.key"
            type="button"
            class="docs-nav-item"
            :class="{ active: active === item.key }"
            @click="go(item.key)"
          >{{ item.label }}</button>
        </div>
      </div>
    </el-scrollbar>

    <el-scrollbar ref="contentRef" class="dev-docs-main">
      <div class="docs-content">
        <div class="docs-breadcrumb">开发文档 <span>/</span> {{ flatItems[currentIndex]?.label }}</div>

        <!-- 概览 -->
        <template v-if="active === 'overview'">
          <h1>二开与插件开发</h1>
          <p class="docs-lead">
            周报管理系统支持在不重新构建客户端的前提下扩展样式、插件脚本和 Vue 组件。
            所有扩展都放在应用资源目录中，保存后即时生效。
          </p>

          <div class="docs-cards">
            <div class="docs-card">
              <span class="docs-card-icon"><el-icon :size="17"><UploadFilled /></el-icon></span>
              <strong>外部组件</strong>
              <p>在 <code>resources/comps</code> 放 <code>.vue</code> / <code>.cslot.vue</code>，官方 SFC 编译器运行时热加载。</p>
            </div>
            <div class="docs-card">
              <span class="docs-card-icon"><el-icon :size="17"><Refresh /></el-icon></span>
              <strong>插件脚本</strong>
              <p>在 <code>resources/js</code> 放普通脚本，通过 <code>window.weekReport</code> 访问周报、事件、命令和 UI。</p>
            </div>
            <div class="docs-card">
              <span class="docs-card-icon"><el-icon :size="17"><Check /></el-icon></span>
              <strong>列扩展</strong>
              <p>注册自定义列组件和列属性编辑插槽，列设置中即可选择。</p>
            </div>
          </div>

          <h2>装配顺序</h2>
          <ol class="docs-steps">
            <li>安装内置能力并暴露 <code>window.weekReport</code>。</li>
            <li>按文件名顺序注入 <code>resources/css/*.css</code>。</li>
            <li>按文件名顺序加载 <code>resources/js/*.js</code>。</li>
            <li>运行时编译并注册 <code>resources/comps</code> 下的组件。</li>
            <li>挂载 Vue 应用；插件脚本执行时 API 已就绪。</li>
          </ol>

          <div class="docs-tip">
            <strong>热加载</strong>
            <span>保存 <code>resources/comps</code> 下的文件会自动重新编译注册，无需重启。也可以在「设置 → 扩展」手动热加载。</span>
          </div>
        </template>

        <!-- 快速开始 -->
        <template v-else-if="active === 'quickstart'">
          <h1>快速开始</h1>
          <p class="docs-lead">先拿到扩展资源目录，然后按下面的结构放入文件。目录不存在时可直接新建。</p>

          <div class="docs-path-card">
            <div>
              <span class="docs-path-label">扩展资源目录</span>
              <code class="docs-path">src-tauri/resources</code>
            </div>
            <div class="docs-path-actions">
              <el-button size="small" @click="copyPath">
                <el-icon><component :is="copiedPath ? Check : CopyDocument" /></el-icon>
                <span>{{ copiedPath ? '已复制' : '复制路径' }}</span>
              </el-button>
              <el-button size="small" @click="doRescan">
                <el-icon><Refresh /></el-icon><span>重新扫描</span>
              </el-button>
              <el-button size="small" type="primary" plain @click="doHotReload">
                <el-icon><UploadFilled /></el-icon><span>热加载组件</span>
              </el-button>
            </div>
          </div>

          <h2>目录结构</h2>
          <DocCode title="resources/" :code="fileTree" />

          <h2>三步开始</h2>
          <div class="docs-step-cards">
            <div class="docs-step-card">
              <span class="docs-step-no">01</span>
              <strong>放文件</strong>
              <p>组件放 <code>comps</code>，插件脚本放 <code>js</code>，全局样式放 <code>css</code>。</p>
            </div>
            <div class="docs-step-card">
              <span class="docs-step-no">02</span>
              <strong>保存</strong>
              <p>保存后组件自动热加载；插件脚本和样式在重新加载应用后生效。</p>
            </div>
            <div class="docs-step-card">
              <span class="docs-step-no">03</span>
              <strong>启用</strong>
              <p>到「设置 → 扩展」确认资源已启用，出现错误会显示在列表中。</p>
            </div>
          </div>

          <div class="docs-warn">
            <strong>注意</strong>
            <span>插件脚本按文件名排序加载。需要强顺序时使用数字前缀，例如 <code>01-init.js</code>、<code>02-search.js</code>。</span>
          </div>
        </template>

        <!-- 外部组件 -->
        <template v-else-if="active === 'components'">
          <h1>外部组件</h1>
          <p class="docs-lead">
            把 Vue SFC 放进 <code>resources/comps</code>，系统使用官方 <code>@vue/compiler-sfc</code>
            在浏览器中编译并注册，不包含自研模板编译器。
          </p>

          <div class="docs-segment">
            <button type="button" :class="{ active: componentTab === 'cell' }" @click="componentTab = 'cell'">单元格组件</button>
            <button type="button" :class="{ active: componentTab === 'slot' }" @click="componentTab = 'slot'">列属性插槽</button>
            <button type="button" :class="{ active: componentTab === 'module' }" @click="componentTab = 'module'">JS 组件模块</button>
          </div>

          <template v-if="componentTab === 'cell'">
            <h2>HelloCell.vue</h2>
            <p>列组件接收 <code>v-model</code>（单元格值）和列的 <code>attrs</code>，在周报表格中渲染。</p>
            <DocCode title="resources/comps/HelloCell.vue" :code="cellCode" />
            <p class="docs-muted">文件名决定组件名：<code>HelloCell.vue</code> → <code>hello-cell</code>，在列设置的组件下拉框中选择。</p>
          </template>

          <template v-else-if="componentTab === 'slot'">
            <h2>HelloCell.cslot.vue</h2>
            <p>与同名单元格组件配套，用于编辑列的 <code>attrs</code>，会显示在列设置弹窗中。</p>
            <DocCode title="resources/comps/HelloCell.cslot.vue" :code="slotCode" />
          </template>

          <template v-else>
            <h2>JS 组件模块</h2>
            <p>没有 SFC 编译需求时，可以用 <code>.js</code> 默认导出一个 Vue 组件对象。</p>
            <DocCode title="resources/comps/RatingCell.js" :code="moduleCode" />
          </template>

          <h2>支持的导入</h2>
          <table class="docs-table">
            <thead><tr><th>模块</th><th>说明</th></tr></thead>
            <tbody>
              <tr><td><code>vue</code></td><td>defineProps / defineEmits / defineModel 等官方宏</td></tr>
              <tr><td><code>element-plus</code></td><td>全部 Element Plus 组件</td></tr>
              <tr><td><code>@element-plus/icons-vue</code></td><td>图标组件</td></tr>
              <tr><td><code>@tauri-apps/api/*</code>、<code>plugin-fs</code>、<code>plugin-sql</code></td><td>桌面端能力</td></tr>
              <tr><td><code>handlebars</code>、<code>moment</code>、<code>lodash</code>、<code>vditor</code></td><td>运行时全局模块</td></tr>
              <tr><td><code>@resources/xxx.js</code></td><td>资源目录下的 JS 模块</td></tr>
            </tbody>
          </table>

          <div class="docs-tip">
            <strong>样式</strong>
            <span>支持 <code>&lt;style scoped&gt;</code> 和普通 CSS；不做 SCSS / Less 预处理。建议使用 Element Plus 主题变量，自动适配亮暗色。</span>
          </div>
        </template>

        <!-- 插件脚本 -->
        <template v-else-if="active === 'plugins'">
          <h1>插件脚本</h1>
          <p class="docs-lead">
            <code>resources/js/*.js</code> 是普通脚本，不是 ES Module。加载时
            <code>window.weekReport</code> 已就绪，可以直接调用。
          </p>

          <DocCode title="resources/js/my-plugin.js" :code="pluginCode" />

          <div class="docs-inline-actions">
            <el-button type="primary" plain size="small" @click="testToast">
              <el-icon><Check /></el-icon><span>测试 Toast</span>
            </el-button>
            <span class="docs-muted">点击验证插件 API 是否可用。</span>
          </div>

          <h2>可用全局对象</h2>
          <div class="docs-chip-list">
            <code>window.weekReport</code>
            <code>window.Vue</code>
            <code>window.ElementPlus</code>
            <code>window.ElementPlusIconsVue</code>
            <code>window.TauriApi</code>
            <code>window.TauriFs</code>
            <code>window.TauriPath</code>
            <code>window.Handlebars</code>
          </div>

          <h2>事件</h2>
          <p>通过 <code>events.on</code> 订阅，返回取消订阅函数。常用事件：</p>
          <table class="docs-table">
            <thead><tr><th>事件</th><th>触发时机</th></tr></thead>
            <tbody>
              <tr><td><code>report:created</code></td><td>新建周报</td></tr>
              <tr><td><code>report:updated</code></td><td>保存周报</td></tr>
              <tr><td><code>report:deleted</code></td><td>移入回收站</td></tr>
              <tr><td><code>report:changed</code></td><td>以上变更的统一事件</td></tr>
              <tr><td><code>theme:changed</code></td><td>主题切换</td></tr>
            </tbody>
          </table>
        </template>

        <!-- 列扩展 -->
        <template v-else-if="active === 'columns'">
          <h1>列扩展</h1>
          <p class="docs-lead">插件脚本可以把已有组件注册进系统，注册后列设置的组件下拉框中会直接出现。</p>

          <DocCode title="resources/js/rating-column.js" :code="columnCode" />

          <h2>注册后</h2>
          <ol class="docs-steps">
            <li>打开周报任意区块的「列设置」。</li>
            <li>在「编辑器组件」中选择 <code>rating</code>。</li>
            <li>表格单元格会用该组件渲染；如果同时提供 <code>Rating.cslot.vue</code>，列设置中会出现属性编辑区。</li>
          </ol>

          <h2>内置列组件</h2>
          <div class="docs-chip-list">
            <code>status-selector</code>
            <code>date-selector</code>
            <code>number-input</code>
            <code>textarea</code>
            <code>select</code>
            <code>multi-select</code>
            <code>switch</code>
          </div>

          <div class="docs-warn">
            <strong>默认值</strong>
            <span>列默认值是 JS 表达式，新建行时执行。例如 <code>"开发中"</code>、<code>moment().format('YYYY-MM-DD')</code>、<code>Date.now()</code>。</span>
          </div>
        </template>

        <!-- API 参考 -->
        <template v-else-if="active === 'api'">
          <h1>API 参考</h1>
          <p class="docs-lead">全部能力都挂在 <code>window.weekReport</code> 下，API 版本为 2。</p>

          <table class="docs-table docs-api-table">
            <thead><tr><th>命名空间</th><th>方法</th></tr></thead>
            <tbody>
              <tr><td><code>reports</code></td><td><code>list</code> · <code>get</code> · <code>create</code> · <code>update</code> · <code>remove</code> · <code>restore</code> · <code>purge</code> · <code>emptyTrash</code> · <code>trashed</code> · <code>search</code> · <code>stats</code></td></tr>
              <tr><td><code>events</code></td><td><code>on(event, handler)</code></td></tr>
              <tr><td><code>templates</code></td><td><code>list</code> · <code>get</code> · <code>save</code> · <code>remove</code> · <code>setDefault</code></td></tr>
              <tr><td><code>config</code></td><td><code>get</code> · <code>set</code> · <code>reset</code></td></tr>
              <tr><td><code>data</code></td><td><code>createBackup</code> · <code>exportBackup</code></td></tr>
              <tr><td><code>ui</code></td><td><code>selectReport</code> · <code>toast</code> · <code>openSettings</code> · <code>openImportExport</code> · <code>openDesigner</code> · <code>openTemplates</code></td></tr>
              <tr><td><code>theme</code></td><td><code>get</code> · <code>set</code> · <code>cycle</code> · <code>onChange</code></td></tr>
              <tr><td><code>commands</code></td><td><code>register</code> · <code>run</code> · <code>list</code></td></tr>
              <tr><td><code>components</code></td><td><code>register</code> · <code>list</code> · <code>has</code></td></tr>
              <tr><td><code>extensions</code></td><td><code>list</code> · <code>errors</code></td></tr>
            </tbody>
          </table>

          <div class="docs-tip">
            <strong>完整参考</strong>
            <span>仓库内的 <code>docs/plugin-api.md</code> 和 <code>docs/report-designer.md</code> 包含完整字段与示例。</span>
          </div>
        </template>

        <!-- FAQ -->
        <template v-else>
          <h1>常见问题</h1>
          <p class="docs-lead">外部组件、插件脚本和列扩展的常见问题。</p>

          <el-collapse class="docs-collapse">
            <el-collapse-item title="保存组件后为什么没有生效？" name="1">
              <p>确认「设置 → 扩展」中该组件已启用；如果仍不生效，点击本页的「热加载组件」或重新加载应用，并查看扩展列表中的错误信息。</p>
            </el-collapse-item>
            <el-collapse-item title="组件里的样式不跟随主题？" name="2">
              <p>不要写死颜色。使用 <code>var(--el-bg-color)</code>、<code>var(--el-text-color-primary)</code> 等 Element Plus 变量，并避免在组件根节点上设置不透明背景。</p>
            </el-collapse-item>
            <el-collapse-item title="可以 import npm 包吗？" name="3">
              <p>只支持文档中列出的运行时模块。其他依赖请先放到 <code>resources/js</code> 并以全局变量形式使用，或改成资源目录内的 ES Module。</p>
            </el-collapse-item>
            <el-collapse-item title="插件脚本的执行顺序？" name="4">
              <p>按文件名排序串行加载。需要明确顺序时使用数字前缀，例如 <code>01-init.js</code>、<code>02-search.js</code>。</p>
            </el-collapse-item>
            <el-collapse-item title="修改资源后需要重新构建客户端吗？" name="5">
              <p>不需要。外部组件保存后热加载；插件脚本和样式重新加载应用即可生效。只有修改客户端本身的 Vue 源码才需要重新构建。</p>
            </el-collapse-item>
          </el-collapse>
        </template>

        <footer class="docs-pager">
          <button type="button" class="docs-pager-btn" :disabled="!prevItem" @click="prevItem && go(prevItem.key)">
            <el-icon><ArrowLeft /></el-icon>
            <span>{{ prevItem ? prevItem.label : '已是第一篇' }}</span>
          </button>
          <button type="button" class="docs-pager-btn next" :disabled="!nextItem" @click="nextItem && go(nextItem.key)">
            <span>{{ nextItem ? nextItem.label : '已是最后一篇' }}</span>
            <el-icon><ArrowRight /></el-icon>
          </button>
        </footer>
      </div>
    </el-scrollbar>
  </div>
</template>

<style scoped>
.dev-docs {
  display: flex;
  gap: 20px;
  height: min(620px, calc(100vh - 230px));
  min-height: 420px;
}

.dev-docs-nav {
  width: 178px;
  flex: none;
  border-right: 1px solid var(--el-border-color-lighter);
}

.docs-nav-inner {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 2px 14px 20px 0;
}

.docs-brand {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.docs-brand-badge {
  align-self: flex-start;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-family: var(--wr-mono);
  font-size: 9px;
}

.docs-brand strong {
  font-size: 14px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}

.docs-brand small {
  font-size: 10.5px;
  color: var(--el-text-color-secondary);
}

.docs-nav-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.docs-nav-title {
  padding: 0 8px 4px;
  font-size: 9.5px;
  font-weight: 650;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--el-text-color-placeholder);
}

.docs-nav-item {
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-family: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.docs-nav-item:hover {
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-primary);
}

.docs-nav-item.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

.dev-docs-main {
  flex: 1;
  min-width: 0;
}

.docs-content {
  max-width: 760px;
  padding: 2px 16px 28px 0;
}

.docs-breadcrumb {
  margin-bottom: 10px;
  font-size: 10.5px;
  color: var(--el-text-color-placeholder);
}

.docs-breadcrumb span {
  margin: 0 4px;
}

.docs-content h1 {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--el-text-color-primary);
}

.docs-content h2 {
  margin: 26px 0 10px;
  padding-top: 18px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 15px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}

.docs-lead {
  margin: 0 0 18px;
  font-size: 13px;
  line-height: 1.85;
  color: var(--el-text-color-regular);
}

.docs-content p {
  margin: 0 0 12px;
  font-size: 12.5px;
  line-height: 1.8;
  color: var(--el-text-color-regular);
}

.docs-content code {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--el-fill-color);
  font-family: var(--wr-mono);
  font-size: 11px;
  color: var(--el-text-color-primary);
}

.docs-muted {
  margin: 8px 0 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--el-text-color-placeholder);
}

.docs-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.docs-card {
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}

.docs-card-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin-bottom: 8px;
  border-radius: 7px;
  background: var(--el-bg-color);
  color: var(--el-color-primary);
}

.docs-card strong {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--el-text-color-primary);
}

.docs-card p {
  margin: 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}

.docs-steps {
  margin: 0 0 14px;
  padding-left: 20px;
  color: var(--el-text-color-regular);
  font-size: 12.5px;
  line-height: 1.9;
}

.docs-tip,
.docs-warn {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 14px 0;
  padding: 10px 12px;
  border-left: 3px solid var(--el-color-primary);
  border-radius: 0 6px 6px 0;
  background: var(--el-color-primary-light-9);
  font-size: 11.5px;
  line-height: 1.75;
  color: var(--el-text-color-regular);
}

.docs-warn {
  border-left-color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
}

.docs-tip strong,
.docs-warn strong {
  font-size: 11px;
  color: var(--el-text-color-primary);
}

.docs-path-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}

.docs-path-label {
  display: block;
  margin-bottom: 4px;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--el-text-color-secondary);
}

.docs-path {
  font-family: var(--wr-mono);
  font-size: 12px;
  color: var(--el-text-color-primary);
}

.docs-path-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.docs-step-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.docs-step-card {
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.docs-step-no {
  display: block;
  margin-bottom: 6px;
  font-family: var(--wr-mono);
  font-size: 10px;
  color: var(--el-color-primary);
}

.docs-step-card strong {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--el-text-color-primary);
}

.docs-step-card p {
  margin: 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}

.docs-segment {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: 7px;
  background: var(--el-fill-color-lighter);
}

.docs-segment button {
  height: 26px;
  padding: 0 10px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-family: inherit;
  font-size: 11.5px;
  cursor: pointer;
}

.docs-segment button.active {
  background: var(--el-bg-color);
  color: var(--el-color-primary);
  font-weight: 600;
  box-shadow: var(--el-box-shadow-lighter);
}

.docs-table {
  width: 100%;
  margin: 10px 0 14px;
  border-collapse: collapse;
  font-size: 11.5px;
}

.docs-table th,
.docs-table td {
  padding: 7px 9px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  text-align: left;
  vertical-align: top;
  color: var(--el-text-color-regular);
}

.docs-table th {
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-secondary);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.docs-api-table td:first-child {
  width: 110px;
  white-space: nowrap;
}

.docs-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}

.docs-chip-list code {
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--el-fill-color-lighter);
  font-size: 10.5px;
}

.docs-inline-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 0;
}

.docs-collapse {
  margin-top: 6px;
}

.docs-collapse :deep(.el-collapse-item__header) {
  height: 38px;
  font-size: 12.5px;
  font-weight: 600;
}

.docs-collapse :deep(.el-collapse-item__content) {
  padding-bottom: 12px;
}

.docs-pager {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 28px;
  padding-top: 14px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.docs-pager-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-family: inherit;
  font-size: 11.5px;
  cursor: pointer;
}

.docs-pager-btn:hover:not(:disabled) {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.docs-pager-btn.next {
  margin-left: auto;
}

.docs-pager-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

@media (max-width: 980px) {
  .docs-cards,
  .docs-step-cards {
    grid-template-columns: minmax(0, 1fr);
  }

  .dev-docs-nav {
    width: 150px;
  }
}
</style>
