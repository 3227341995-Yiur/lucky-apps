<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useExtensions } from '@/composables/useExtensions'
import { installPlugin, isScriptHot, searchPlugins, uninstallPluginStream } from '@/plugins/loader'
import { AppDialog } from '@lucky-apps/client-ui'

defineOptions({ name: 'ExtensionManager' })

// 资源卡片已经展示的错误不再在全局列表重复一遍
const visibleErrors = computed(() => {
  const resourceErrors = extensionState.resources
    .map(resource => String(resource.error || '').trim())
    .filter(Boolean)
  return extensionState.errors.filter(message => (
    !resourceErrors.some(error => error.includes(message) || message.includes(error))
  ))
})

const {
  extensionState,
  groups,
  groupLabels,
  groupHints,
  enabledCount,
  errorCount,
  toggleResource,
  rescan,
  hotReloadComponents,
  copyResourcesPath,
  copyPluginsPath,
  reloadApp,
} = useExtensions()

// 列组件 / 画布组件属于周报本体能力，由周报插件注册的「周报组件」设置面板维护
const groupOrder = ['component-feature', 'style', 'script', 'component-other']

const STATUS_META = {
  loaded: { label: '已加载', type: 'success' },
  disabled: { label: '已禁用', type: 'info' },
  error: { label: '加载失败', type: 'danger' },
  pending: { label: '待加载', type: 'warning' },
}

const TYPE_LABELS = {
  style: '样式',
  script: '脚本',
  'component-canvas': '画布',
  'component-column': '列',
  'component-feature': '功能',
  'component-other': '组件',
}

const rescanning = ref(false)
const hotReloading = ref(false)
const installSpec = ref('')
const installOpen = ref(false)
const installQuery = ref('')
const installResults = ref([])
const installInputRef = ref(null)
const searching = ref(false)
const installing = ref(false)
const removingName = ref('')
const installStage = ref('')
const installPercent = ref(0)
const installLogs = ref([])
const installError = ref('')
const pendingBuilds = ref([])
const approvedNames = ref([])
const approving = ref(false)
const uninstallOpen = ref(false)
const uninstallName = ref('')
const uninstallStage = ref('')
const uninstallPercent = ref(0)
const uninstallLogs = ref([])
const uninstallError = ref('')
let searchTimer = null
let installController = null

function statusOf(resource) {
  // 启停状态以开关为准，避免重新扫描/重载后 status 还是服务端的 loaded
  if (resource.enabled === false) return STATUS_META.disabled
  return STATUS_META[resource.status] || STATUS_META.pending
}

function isComponentGroup(key) {
  return key.startsWith('component-')
}

async function handleRescan() {
  rescanning.value = true
  try {
    await rescan()
    ElMessage.success(`已重新扫描，共 ${extensionState.resources.length} 项资源`)
  } catch (error) {
    ElMessage.error(`重新扫描失败：${error?.message || error}`)
  } finally {
    rescanning.value = false
  }
}

async function handleHotReload() {
  hotReloading.value = true
  try {
    // 成功提示由 App 监听 extensions:components-reloaded 统一展示，避免重复 toast
    await hotReloadComponents()
  } catch (error) {
    ElMessage.error(`热加载失败：${error?.message || error}`)
  } finally {
    hotReloading.value = false
  }
}

async function handleCopyPath() {
  try {
    const path = await copyResourcesPath()
    ElMessage.success(`资源目录路径已复制：${path}`)
  } catch {
    ElMessage.error('复制资源目录路径失败')
  }
}

async function handleCopyPluginsPath() {
  try {
    const path = await copyPluginsPath()
    ElMessage.success(`插件目录路径已复制：${path}`)
  } catch {
    ElMessage.error('复制插件目录路径失败')
  }
}

function focusInstallInput() {
  const input = installInputRef.value
  if (!input) return
  input.focus({ preventScroll: true })
  input.select()
}

function openInstallDialog() {
  installOpen.value = true
  installQuery.value = ''
  installResults.value = []
  installStage.value = ''
  installPercent.value = 0
  installLogs.value = []
  installError.value = ''
  pendingBuilds.value = []
  approvedNames.value = []
  // el-dialog 打开时会把焦点收到弹窗容器上，挂载后补一次聚焦。
  nextTick(() => {
    focusInstallInput()
    setTimeout(focusInstallInput, 180)
  })
}

function cancelInstall() {
  installController?.abort()
}

function guardInstallClose(done) {
  if (installing.value) cancelInstall()
  done()
}

function guardUninstallClose(done) {
  if (!removingName.value) done()
}

function friendlyError(raw) {
  const text = String(raw || '').trim()
  if (!text) return '操作没有完成，请稍后重试。'
  const rules = [
    [/ERR_PNPM_FETCH_404|404 Not Found/i, '找不到这个包，请检查包名或仓库地址。'],
    [/ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED|prepare script/i, '插件的构建脚本被拦截，无法生成运行文件。'],
    [/EACCES|EPERM|access is denied/i, '没有写入权限，请关闭占用该目录的程序后重试。'],
    [/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed|network/i, '网络连接失败，请检查网络或 registry 设置。'],
    [/ERR_PNPM_PEER_DEP_ISSUES/i, '依赖版本不兼容，请检查插件的 peerDependencies。'],
    [/ERR_PNPM_UNEXPECTED_VIRTUAL_STORE/i, 'profile 依赖目录不一致，重新加载应用后重试。'],
    [/ERR_PNPM_CMD_SHIM_READ_MANIFEST|os error 448|UNTRUSTED_MOUNT_POINT/i, '本地插件目录链接不可用，请改用 tarball 或重新安装。'],
    [/退出码|exit code/i, '依赖安装没有完成，展开日志可查看具体原因。'],
  ]
  for (const [pattern, message] of rules) if (pattern.test(text)) return message
  const first = text.split(/\r?\n/).find(line => line.trim()) || text
  return first.length > 160 ? `${first.slice(0, 160)}…` : first
}

async function copyErrorText(text) {
  try {
    await navigator.clipboard.writeText(String(text || ''))
    ElMessage.success('错误信息已复制')
  } catch {
    ElMessage.error('复制失败，请手动选择文本')
  }
}

/** allowBuilds 里本地/Git 包会带 @file: / @https: 后缀，界面上只显示包名。 */
function buildLabel(name) {
  return String(name || '').replace(/@(?:file|link|git\+https?|https?):.*$/i, '')
}

function appendLog(logs, line) {
  const value = String(line || '').trim()
  if (!value) return logs
  const next = logs[logs.length - 1] === value
    ? logs
    : [...logs, value]
  return next.slice(-300)
}

function handleInstallEvent(event) {
  if (event.type === 'stage') {
    installStage.value = event.message || installStage.value
    if (typeof event.progress === 'number') installPercent.value = event.progress
    return
  }
  if (event.type === 'log') {
    installLogs.value = appendLog(installLogs.value, event.line)
    return
  }
  if (event.type === 'error') {
    installError.value = event.error || '安装失败'
  }
}

function normalizeInstallSpec(value) {
  let spec = String(value || '').trim()
  if (!spec) return ''
  if (/^github\.com[:/]/i.test(spec)) {
    spec = `https://${spec.replace(/^github\.com[:/]/i, 'github.com/')}`
  } else if (/^git@github\.com:/i.test(spec)) {
    spec = `git+ssh://${spec.replace(/^git@github\.com:/i, 'git@github.com/')}`
  }
  return spec
}

function isGitSpec(spec) {
  return /^(https?:\/\/|git\+https?:\/\/|git\+ssh:\/\/|git@|github:|gitlab:|bitbucket:)/i.test(spec)
}

function isLocalSpec(spec) {
  return /^(?:[A-Za-z]:[\\/]|\\\\|\.{1,2}[\\/]|\/)/.test(spec)
}

function isPackageSpec(spec) {
  return /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+(?:@[a-z0-9._-]+)?$/i.test(spec)
}

function scheduleSearch() {
  clearTimeout(searchTimer)
  const query = installQuery.value.trim()
  if (!query) {
    installResults.value = []
    return
  }
  const spec = normalizeInstallSpec(query)
  if (isGitSpec(spec)) {
    installResults.value = [{ name: 'Git 仓库', version: '', description: spec, spec }]
    return
  }
  if (isLocalSpec(spec)) {
    installResults.value = [{ name: '本地组件目录', version: '', description: spec, spec }]
    return
  }
  if (!isPackageSpec(spec)) {
    installResults.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      installResults.value = await searchPlugins(spec)
    } catch {
      installResults.value = []
    } finally {
      searching.value = false
    }
  }, 280)
}

async function handleInstall(specArg) {
  const spec = normalizeInstallSpec(specArg || installSpec.value || installQuery.value)
  if (!spec) {
    ElMessage.warning('请输入 npm 包名、Git 地址或本地组件目录')
    return
  }
  if (!isGitSpec(spec) && !isLocalSpec(spec) && !isPackageSpec(spec)) {
    ElMessage.warning('输入内容不是有效的 npm 包名、Git 地址或本地目录')
    return
  }
  await runInstall(spec)
}

async function approveInstall() {
  const names = pendingBuilds.value
  if (!installSpec.value || !names.length) return
  approving.value = true
  try {
    await runInstall(installSpec.value, names)
  } finally {
    approving.value = false
  }
}

function retryInstall() {
  if (installSpec.value) runInstall(installSpec.value)
  else handleInstall()
}

async function runInstall(spec, approvedBuilds = []) {
  const controller = new AbortController()
  installController = controller
  installSpec.value = spec
  installing.value = true
  installError.value = ''
  pendingBuilds.value = []
  approvedNames.value = []
  installLogs.value = []
  installPercent.value = 0
  installStage.value = '准备安装…'
  try {
    const result = await installPlugin(spec, handleInstallEvent, approvedBuilds, controller.signal)
    installStage.value = '安装完成'
    installPercent.value = 100
    approvedNames.value = result?.approvedBuilds || []
    await rescan()
    installSpec.value = ''
    ElMessage.success(`已安装 ${result?.name || spec}${result?.hasBundle ? '，已加入 profile' : '（普通依赖）'}`)
  } catch (error) {
    if (controller.signal.aborted) {
      installStage.value = '已取消'
      installError.value = ''
      pendingBuilds.value = []
      installPercent.value = 0
      return
    }
    const message = error?.message || String(error)
    if (Array.isArray(error?.pendingBuilds) && error.pendingBuilds.length) {
      // pnpm 拦截了安装脚本：留在同一个安装窗口里授权，不弹第二个窗口。
      pendingBuilds.value = error.pendingBuilds
      installStage.value = '需要允许安装脚本'
      return
    }
    installError.value = message
    installStage.value = '安装失败'
    installLogs.value = appendLog(installLogs.value, message)
  } finally {
    installing.value = false
    if (installController === controller) installController = null
  }
}

function handleUninstallEvent(event) {
  if (event.type === 'stage') {
    uninstallStage.value = event.message || uninstallStage.value
    if (typeof event.progress === 'number') uninstallPercent.value = event.progress
    return
  }
  if (event.type === 'log') {
    uninstallLogs.value = appendLog(uninstallLogs.value, event.line)
    return
  }
  if (event.type === 'error') {
    uninstallError.value = event.error || '卸载失败'
    uninstallLogs.value = appendLog(uninstallLogs.value, uninstallError.value)
  }
}

async function handleUninstall(resource) {
  const name = resource.package || resource.name
  try {
    await ElMessageBox.confirm(
      `卸载「${name}」？会从 profile 移除该插件包并热卸载。`,
      '卸载插件',
      { type: 'warning', confirmButtonText: '卸载', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  removingName.value = name
  uninstallName.value = name
  uninstallStage.value = '准备卸载…'
  uninstallPercent.value = 0
  uninstallLogs.value = []
  uninstallError.value = ''
  uninstallOpen.value = true
  try {
    await uninstallPluginStream(name, handleUninstallEvent)
    uninstallStage.value = '卸载完成'
    uninstallPercent.value = 100
    removingName.value = ''
    await rescan()
    ElMessage.success(`已卸载 ${name}`)
  } catch (error) {
    const message = error?.message || String(error)
    uninstallError.value = message
    uninstallStage.value = '卸载失败'
    uninstallLogs.value = appendLog(uninstallLogs.value, message)
    removingName.value = ''
  }
}

function typeIcon(key) {
  if (key === 'style') return 'Brush'
  if (key === 'script') return 'Document'
  return 'Grid'
}

function handleMoreCommand(command) {
  if (command === 'resources') handleCopyPath()
  else if (command === 'plugins') handleCopyPluginsPath()
  else if (command === 'reload') reloadApp()
}

async function handleToggle(resource, enabled) {
  try {
    // 在卸载前记录，dispose 会把 hotScripts 里的记录删掉
    const hot = resource.hot || isScriptHot(resource.file)
    const result = await toggleResource(resource.id, enabled)
    if (result === null) return
    // 支持 teardown 的脚本走 Cordis 热卸载；没有 teardown 的旧脚本只能重载界面。
    if (resource.kind === 'script' && !result && !hot) {
      ElMessage.success(`已禁用「${resource.name}」，正在重新加载界面…`)
      setTimeout(() => window.location.reload(), 600)
      return
    }
    ElMessage.success(`已${result ? '启用' : '禁用'}「${resource.name}」`)
  } catch (error) {
    ElMessage.error(`切换扩展失败：${error?.message || error}`)
  }
}
</script>

<template>
  <div class="extension-manager">
    <div class="ext-hero">
      <div class="ext-hero-copy">
        <span class="ext-eyebrow">EXTENSIONS</span>
        <h3>扩展中心</h3>
        <p>功能插件是独立的 Cordis 包。安装后由 Node 服务组合进 profile；列组件与画布组件在「周报组件」设置里维护。</p>
      </div>
      <div class="ext-hero-stats">
        <span><strong>{{ enabledCount }}</strong> 已启用</span>
        <span :class="{ danger: errorCount > 0 }"><strong>{{ errorCount }}</strong> 失败</span>
        <span><strong>{{ extensionState.profile?.bundles?.length || 0 }}</strong> bundles</span>
      </div>
    </div>

    <div class="install-card">
      <div class="install-copy">
        <span class="install-icon"><el-icon :size="18"><Download /></el-icon></span>
        <div>
          <strong>安装外部组件</strong>
          <p>输入 npm 包名或本地组件项目路径，自动执行 pnpm add 并加入 profile。</p>
        </div>
      </div>
      <button type="button" class="install-trigger" @click="openInstallDialog">
        <el-icon><Search /></el-icon>
        <span>搜索并安装组件…</span>
        <kbd>Ctrl K</kbd>
      </button>
    </div>

    <div class="ext-toolbar">
      <span class="ext-watcher" :class="{ danger: extensionState.watcher === 'error' }">
        <i></i>
        {{ extensionState.watcher === 'active' ? 'profile 热监听已启用' : extensionState.watcher === 'error' ? '文件监听不可用' : '文件监听未启动' }}
      </span>
      <div class="ext-actions">
        <el-button size="small" :loading="rescanning" @click="handleRescan">
          <el-icon><Refresh /></el-icon><span>重新扫描</span>
        </el-button>
        <el-button size="small" type="primary" plain :loading="hotReloading" @click="handleHotReload">
          <el-icon><RefreshRight /></el-icon><span>热加载组件</span>
        </el-button>
        <el-dropdown trigger="click" placement="bottom-end" @command="handleMoreCommand">
          <el-button size="small">
            <el-icon><MoreFilled /></el-icon><span>更多</span>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="resources">复制资源目录</el-dropdown-item>
              <el-dropdown-item command="plugins">复制插件目录</el-dropdown-item>
              <el-dropdown-item command="reload" divided>重新加载应用</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <p class="ext-note">
      profile 由 <code>package.json</code> 的 <code>la.profile.bundles</code> 组合：
      先叠加各 bundle 的 <code>cordis.patch.yml</code>，再叠加 profile 自己的
      <code>cordis.patch.yml</code>。
    </p>

    <div v-if="visibleErrors.length" class="ext-errors">
      <div class="ext-errors-head">
        <el-icon><WarningFilled /></el-icon>
        <span>Cordis 插件错误</span>
      </div>
      <div v-for="message in visibleErrors" :key="message" class="ext-error-row">
        <span>{{ friendlyError(message) }}</span>
        <button type="button" class="ext-error-copy" @click="copyErrorText(message)">复制</button>
      </div>
    </div>

    <div v-if="extensionState.loading || rescanning" class="ext-state">
      <el-icon class="is-loading" :size="20"><Loading /></el-icon>
      <span>正在加载扩展资源…</span>
    </div>

    <div v-else-if="extensionState.resources.length === 0" class="wr-empty-state">
      <el-icon :size="28"><FolderOpened /></el-icon>
      <h3>暂无扩展资源</h3>
      <p>样式表与插件脚本放入资源目录的 css / js；组件包通过 profile 的 bundles 组合。</p>
      <el-button size="small" @click="handleCopyPluginsPath">复制插件目录路径</el-button>
    </div>

    <template v-else>
      <section v-for="key in groupOrder" :key="key" v-show="groups[key].length" class="ext-group">
        <div class="group-head">
          <div class="group-title-wrap">
            <span class="group-title">{{ groupLabels[key] }}</span>
            <span class="group-hint">{{ groupHints[key] }}</span>
          </div>
          <span class="group-count">{{ groups[key].length }}</span>
        </div>

        <p v-if="String(key).startsWith('component-')" class="group-note">
          每个组件包提供 <code>la.bundle.patch</code>，由 profile 组合后加载；保存后自动热加载。
        </p>

        <div class="ext-list">
          <div v-for="resource in groups[key]" :key="resource.id" class="ext-item">
            <span class="ext-type-icon">
              <el-icon :size="16"><component :is="typeIcon(key)" /></el-icon>
            </span>
            <div class="ext-info">
              <div class="ext-line">
                <span class="ext-name">{{ resource.name }}</span>
                <el-tag size="small" effect="light" round :type="statusOf(resource).type">
                  {{ statusOf(resource).label }}
                </el-tag>
                <span class="ext-type">{{ TYPE_LABELS[key] }}</span>
              </div>
              <code v-if="isComponentGroup(key) && resource.file" class="ext-file">{{ resource.file }}</code>
              <p v-if="resource.error || resource.status === 'error'" class="ext-error">
                {{ resource.error || '资源加载失败' }}
              </p>
            </div>
            <div class="ext-item-actions">
              <el-button
                v-if="isComponentGroup(key) && resource.removable"
                size="small"
                text
                type="danger"
                :loading="removingName === (resource.package || resource.name)"
                @click="handleUninstall(resource)"
              >卸载</el-button>
              <el-switch
                v-model="resource.enabled"
                :aria-label="`启用 ${resource.name}`"
                @change="handleToggle(resource, $event)"
              />
            </div>
          </div>
        </div>
      </section>
    </template>

    <AppDialog
      v-model="uninstallOpen"
      :title="`卸载 ${uninstallName}`"
      subtitle="正在从 profile 移除插件包"
      icon="Delete"
      width="620px"
      show-footer
      :close-on-click-modal="false"
      :close-on-press-escape="!removingName"
      :before-close="guardUninstallClose"
    >
      <div class="install-progress">
        <div class="install-progress-head">
          <span>{{ uninstallStage || '正在卸载…' }}</span>
          <strong>{{ uninstallPercent }}%</strong>
        </div>
        <el-progress :percentage="uninstallPercent" :show-text="false" :stroke-width="7" />
        <div v-if="uninstallError" class="install-error-card" role="alert">
          <span class="install-error-icon"><el-icon><WarningFilled /></el-icon></span>
          <div class="install-error-main">
            <strong>卸载没有完成</strong>
            <p>{{ friendlyError(uninstallError) }}</p>
          </div>
          <el-button size="small" text class="install-error-copy" @click="copyErrorText(uninstallError)">复制错误</el-button>
        </div>
        <details v-if="uninstallLogs.length" class="install-details">
          <summary>查看详细日志</summary>
          <pre class="install-log">{{ uninstallLogs.join('\n') }}</pre>
        </details>
      </div>
    </AppDialog>

    <AppDialog
      v-model="installOpen"
      title="安装外部组件"
      subtitle="搜索 npm 包，或粘贴本地组件项目路径"
      icon="Download"
      width="680px"
      show-footer
      :before-close="guardInstallClose"
    >
      <div class="install-search">
        <el-icon :size="17"><Search /></el-icon>
        <input
          ref="installInputRef"
          v-model="installQuery"
          placeholder="搜索 npm 包，或粘贴本地组件项目路径"
          autofocus
          spellcheck="false"
          :disabled="installing"
          @input="scheduleSearch"
          @keyup.enter="installResults.length ? handleInstall(installResults[0].spec || installResults[0].name) : handleInstall()"
        />
        <span v-if="searching" class="install-spinner"><el-icon class="is-loading"><Loading /></el-icon></span>
      </div>

      <div v-if="pendingBuilds.length" class="install-approval" role="group" aria-label="需要允许安装脚本">
        <h4>需要允许安装脚本</h4>
        <p>以下包声明了安装脚本，pnpm 默认不运行。</p>
        <ul>
          <li v-for="name in pendingBuilds" :key="name"><code>{{ buildLabel(name) }}</code></li>
        </ul>
        <p>允许后，脚本会以你的权限在本机运行，授权保存在当前 profile，之后不再询问。</p>
        <p class="approval-hint">只在信任这些包时允许。</p>
      </div>

      <div v-else-if="installing || installPercent > 0 || installError" class="install-progress">
        <div class="install-progress-head">
          <span>{{ installStage || '正在安装…' }}</span>
          <strong>{{ installPercent }}%</strong>
        </div>
        <el-progress :percentage="installPercent" :show-text="false" :stroke-width="7" />
        <p v-if="approvedNames.length" class="install-approved" role="status">
          已允许运行安装脚本：{{ approvedNames.map(buildLabel).join('、') }}
        </p>
        <div v-if="installError" class="install-error-card" role="alert">
          <span class="install-error-icon"><el-icon><WarningFilled /></el-icon></span>
          <div class="install-error-main">
            <strong>安装没有完成</strong>
            <p>{{ friendlyError(installError) }}</p>
          </div>
          <el-button size="small" text class="install-error-copy" @click="copyErrorText(installError)">复制错误</el-button>
        </div>
        <details v-if="installLogs.length" class="install-details">
          <summary>查看详细日志</summary>
          <pre class="install-log">{{ installLogs.join('\n') }}</pre>
        </details>
      </div>

      <div v-else class="install-results">
        <div v-if="!installQuery.trim()" class="install-hint">
          输入包名搜索 npm，或直接输入本地项目路径安装。
        </div>
        <button
          v-for="item in installResults"
          :key="item.name"
          type="button"
          class="install-result"
          @click="handleInstall(item.spec || item.name)"
        >
          <span class="install-package-icon"><el-icon><Box /></el-icon></span>
          <span class="install-result-copy">
            <strong>{{ item.name }}<small v-if="item.version">@{{ item.version }}</small></strong>
            <span>{{ item.description || item.spec }}</span>
          </span>
          <el-icon class="install-arrow"><ArrowRight /></el-icon>
        </button>
        <div v-if="installQuery.trim() && !installResults.length && !searching" class="install-hint">
          没有匹配的插件，请输入完整包名或 Git/本地路径。
        </div>
      </div>
      <template #footer>
        <template v-if="pendingBuilds.length">
          <span class="install-foot-hint">授权只保存在当前 profile。</span>
          <el-button type="primary" :loading="approving" @click="approveInstall">允许这些脚本并重试</el-button>
        </template>
        <template v-else>
          <span class="install-foot-hint">{{ installing ? '正在安装，关闭窗口会取消本次安装。' : installError ? '没有安装完成，可以点「重试」再试一次。' : installPercent === 100 ? '安装完成，插件已自动加载。' : '安装后自动加入 profile bundles，并热加载组件。' }}</span>
          <el-button v-if="installing" @click="cancelInstall">取消安装</el-button>
          <template v-else-if="installPercent === 100 && !installError">
            <el-button type="primary" @click="installOpen = false">关闭</el-button>
          </template>
          <el-button
            v-else
            type="primary"
            @click="installError ? retryInstall() : handleInstall()"
          >
            <el-icon><Download /></el-icon><span>{{ installError ? '重试' : '安装' }}</span>
          </el-button>
        </template>
      </template>
    </AppDialog>
  </div>
</template>

<style scoped>
.extension-manager {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 10px;
}

.ext-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 20px 22px;
  border-radius: 18px;
  background:
    radial-gradient(circle at 88% 10%, rgba(34, 211, 238, 0.3), transparent 32%),
    linear-gradient(135deg, #111827, #1e3a8a);
  color: #fff;
}

.ext-eyebrow {
  font-family: var(--wr-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  color: rgba(255, 255, 255, 0.6);
}

.ext-hero h3 {
  margin: 7px 0 5px;
  font-size: 20px;
  font-weight: 720;
  letter-spacing: -0.02em;
}

.ext-hero p {
  max-width: 480px;
  margin: 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.68);
}

.ext-hero-stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 7px;
  flex: none;
}

.ext-hero-stats span {
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.72);
}

.ext-hero-stats strong {
  color: #fff;
  font-size: 12px;
}

.ext-hero-stats span.danger strong {
  color: #fecaca;
}

.install-card {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 14px;
  background: var(--el-bg-color);
  box-shadow: 0 8px 24px -28px rgba(15, 23, 42, 0.5);
}

.install-copy {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 220px;
}

.install-icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 10px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.install-copy strong {
  display: block;
  font-size: 12px;
  color: var(--el-text-color-primary);
}

.install-copy p {
  margin: 2px 0 0;
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--el-text-color-placeholder);
}

.install-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex: 1;
  max-width: 480px;
  height: 30px;
  padding: 0 11px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  color: var(--el-text-color-placeholder);
  font-family: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.install-trigger:hover {
  border-color: var(--el-border-color-dark);
}

.install-trigger:focus-visible {
  outline: none;
  border-color: var(--el-color-primary);
}

.install-trigger kbd {
  margin-left: auto;
  padding: 1px 6px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 5px;
  background: var(--el-fill-color-lighter);
  font-family: var(--wr-mono);
  font-size: 9px;
  color: var(--el-text-color-placeholder);
}

.install-search {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 16px 18px 12px;
  padding: 12px 14px;
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 14px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.install-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--el-text-color-primary);
  font-family: inherit;
  font-size: 14px;
}

.install-search input::placeholder {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.ext-errors {
  padding: 12px 14px;
  border: 1px solid var(--el-color-danger-light-7);
  border-radius: 12px;
  background: var(--el-color-danger-light-9);
}

.ext-errors-head {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--el-color-danger);
  font-size: 11.5px;
  font-weight: 650;
}

.ext-error-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-top: 8px;
  padding: 9px 11px;
  border-radius: 9px;
  background: color-mix(in srgb, var(--el-bg-color) 72%, transparent);
  color: var(--el-text-color-regular);
  font-size: 11.5px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.ext-error-copy {
  flex: none;
  padding: 2px 9px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 999px;
  background: var(--el-bg-color);
  color: var(--el-text-color-secondary);
  font: inherit;
  font-size: 10.5px;
  cursor: pointer;
}

.ext-error-copy:hover {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary-light-5);
}

.install-progress {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 18px 4px;
}

.install-progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
}

.install-progress-head strong {
  color: var(--el-text-color-primary);
  font-family: var(--wr-mono);
  font-size: 11px;
}

.install-approval {
  display: grid;
  gap: 8px;
  padding: 14px 15px;
  border: 1px solid color-mix(in srgb, var(--el-color-warning) 26%, var(--el-border-color-lighter));
  border-radius: 12px;
  background: color-mix(in srgb, var(--el-color-warning-light-9) 64%, var(--el-bg-color));
}

.install-approval h4 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 12.5px;
  font-weight: 600;
}

.install-approval p {
  margin: 0;
  color: var(--el-text-color-regular);
  font-size: 12px;
  line-height: 1.6;
}

.install-approval ul {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.install-approval code {
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  font-family: var(--wr-mono);
  font-size: 11px;
}

.approval-hint {
  color: var(--el-text-color-placeholder) !important;
  font-size: 11px !important;
}

.install-approved {
  margin: 0;
  color: var(--el-color-success);
  font-size: 12px;
  line-height: 1.5;
}

.install-error-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 13px;
  border: 1px solid color-mix(in srgb, var(--el-color-danger) 22%, var(--el-border-color-lighter));
  border-radius: 12px;
  background: color-mix(in srgb, var(--el-color-danger-light-9) 72%, var(--el-bg-color));
}

.install-error-icon {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: none;
  border-radius: 50%;
  background: color-mix(in srgb, var(--el-color-danger) 12%, transparent);
  color: var(--el-color-danger);
  font-size: 14px;
}

.install-error-main {
  flex: 1;
  min-width: 0;
}

.install-error-main strong {
  display: block;
  color: var(--el-text-color-primary);
  font-size: 12px;
}

.install-error-main p {
  margin: 4px 0 0;
  color: var(--el-text-color-regular);
  font-size: 11.5px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.install-error-copy {
  flex: none;
  color: var(--el-text-color-secondary);
}

.install-error-copy:hover {
  color: var(--el-color-primary);
}

.install-details {
  margin-top: 2px;
}

.install-details summary {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  cursor: pointer;
  user-select: none;
}

.install-details[open] summary {
  margin-bottom: 8px;
}

.install-log {
  max-height: 180px;
  margin: 0;
  padding: 10px 12px;
  overflow: auto;
  border-radius: 9px;
  background: #0f172a;
  color: #cbd5e1;
  font-family: var(--wr-mono);
  font-size: 10.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.install-results {
  flex: 1;
  min-height: 120px;
  max-height: 52vh;
  overflow: auto;
  padding: 0 8px 12px;
}

.install-foot-hint {
  margin-right: auto;
  font-size: 10.5px;
  color: var(--el-text-color-placeholder);
}

.install-hint {
  padding: 28px 14px;
  text-align: center;
  font-size: 11.5px;
  color: var(--el-text-color-placeholder);
}

.install-result {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: 11px;
  background: transparent;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.14s ease, border-color 0.14s ease;
}

.install-result:hover {
  border-color: var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}

.install-result:disabled {
  opacity: 0.55;
  cursor: wait;
}

.install-package-icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 9px;
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
}

.install-result-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.install-result-copy strong {
  font-size: 12px;
  color: var(--el-text-color-primary);
}

.install-result-copy small {
  margin-left: 5px;
  font-family: var(--wr-mono);
  font-size: 9px;
  color: var(--el-text-color-placeholder);
}

.install-result-copy > span {
  font-size: 10.5px;
  color: var(--el-text-color-placeholder);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.install-arrow {
  color: var(--el-text-color-placeholder);
}

.ext-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.ext-watcher {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  color: var(--el-text-color-secondary);
}

.ext-watcher i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--el-color-success) 14%, transparent);
}

.ext-watcher.danger i {
  background: var(--el-color-danger);
}

.ext-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ext-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.ext-note {
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--el-text-color-placeholder);
}

.ext-note code {
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  font-family: var(--wr-mono);
  font-size: 10px;
}

.ext-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 42px 20px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.ext-group {
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 14px;
  background: var(--el-bg-color);
}

.group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.group-title-wrap {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.group-title {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.group-hint {
  font-size: 10.5px;
  color: var(--el-text-color-placeholder);
}

.group-count {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--el-fill-color);
  font-size: 10px;
  line-height: 17px;
  text-align: center;
  color: var(--el-text-color-secondary);
}

.group-note {
  margin: 0 0 10px;
  font-size: 10.5px;
  line-height: 1.6;
  color: var(--el-text-color-placeholder);
}

.ext-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ext-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
  transition: border-color 0.16s ease, background-color 0.16s ease;
}

.ext-item:hover {
  border-color: var(--el-color-primary-light-7);
  background: var(--el-color-primary-light-9);
}

.ext-type-icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex: none;
  border-radius: 9px;
  background: var(--el-bg-color);
  color: var(--el-color-primary);
  box-shadow: inset 0 0 0 1px var(--el-border-color-lighter);
}

.ext-info {
  flex: 1;
  min-width: 0;
}

.ext-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.ext-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow-wrap: anywhere;
}

.ext-type {
  font-size: 9.5px;
  color: var(--el-text-color-placeholder);
}

.ext-file {
  display: block;
  margin-top: 3px;
  font-family: var(--wr-mono);
  font-size: 9.5px;
  color: var(--el-text-color-placeholder);
  overflow-wrap: anywhere;
}

.ext-error {
  margin: 4px 0 0;
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--el-color-danger);
  overflow-wrap: anywhere;
}

.ext-item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
}

.ext-item :deep(.el-switch) {
  flex-shrink: 0;
}

@media (max-width: 720px) {
  .ext-hero,
  .install-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .ext-hero-stats {
    justify-content: flex-start;
  }

  .install-form {
    width: 100%;
    max-width: none;
    margin-left: 0;
  }
}
</style>
