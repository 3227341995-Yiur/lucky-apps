<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import ReportEditor from '@/components/ReportEditor.vue'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'
import { useReports } from '@/composables/useReports'
import { pluginApi, setActiveView } from '@/plugins/api'
import { getNavItemComponent, listNavItems, listOverlays } from '@/plugins/registry'
import { branding } from '@/composables/useBranding'
import { emit as emitAppEvent } from '@/utils/eventBus'
import { apiGet } from '@/services/rpc'

const reports = useReports()
const { state } = reports

const showSettings = ref(false)
const envIssue = ref<any>(null)
const activePluginPage = ref(null)
const overlays = computed(() => listOverlays())

const activeHostView = computed(() => {
  const item = activePluginPage.value ? listNavItems().find(entry => entry.id === activePluginPage.value) : null
  return item?.hostView || ''
})

const pluginPageComponent = computed(() => (
  activePluginPage.value ? getNavItemComponent(activePluginPage.value) : null
))
let offExtensionsChanged = null

function closeDialogs() {
  showSettings.value = false
}

function openPluginPage(item) {
  closeDialogs()
  // 原周报行为：未选中任何周报时，周报 icon 点击无功能
  if (item.hostView === 'report-editor' && !state.currentReport) return
  activePluginPage.value = item.id
}

function openWelcomePage() {
  return navigateTo('home')
}

function openReportsPage() {
  return navigateTo('reports')
}

function navigateTo(id) {
  if (!id) return false
  const alias = id === 'welcome' ? 'home' : id
  // 程序化返回“周报”（如回收站按钮）：有打开的周报回编辑器，否则打开最近一份
  if (alias === 'reports') {
    closeDialogs()
    if (state.currentReport) {
      activePluginPage.value = 'reports'
      return true
    }
    const latest = state.reports?.[0]
    if (latest) {
      reports.selectReport(latest.id)
      return true
    }
    return navigateTo('home')
  }
  const item = listNavItems().find(entry => entry.id === alias)
  if (!item) return false
  openPluginPage(item)
  return true
}

function openSettings() {
  closeDialogs()
  showSettings.value = true
}

function openReportsDialog(name) {
  closeDialogs()
  emitAppEvent('reports:open-dialog', name)
  return true
}

function openTemplates() {
  return openReportsDialog('template')
}

function openImportExport() {
  return openReportsDialog('io')
}

function openDesigner() {
  return openReportsDialog('designer')
}

async function handleCreate() {
  activePluginPage.value = null
  try {
    await reports.createReport()
  } catch (error) {
    ElMessage.error(`新建周报失败: ${error?.message || error}`)
  }
}


function handleKeydown(event) {
  const ctrl = event.ctrlKey || event.metaKey
  if (ctrl && !event.shiftKey && event.key.toLowerCase() === 'p') {
    event.preventDefault()
    openTemplates()
  }
  if (ctrl && event.shiftKey && event.key.toLowerCase() === 'e') {
    event.preventDefault()
    openImportExport()
  }
  if (ctrl && !event.shiftKey && event.key.toLowerCase() === 'n') {
    event.preventDefault()
    handleCreate()
  }
}

onMounted(async () => {
  document.addEventListener('keydown', handleKeydown)
  try {
    const env = await apiGet('/api/env')
    const nodeMajor = Number(String(env?.node || '').split('.')[0]) || 0
    const pnpmMajor = Number(String(env?.pnpm || '').split('.')[0]) || 0
    if (!env?.nodeOk || nodeMajor < (env?.requiredNode || 24)) {
      envIssue.value = { kind: 'node', ...env }
    } else if (!env?.pnpmOk || pnpmMajor < (env?.requiredPnpm || 12)) {
      envIssue.value = { kind: 'pnpm', ...env }
    }
  } catch {}
  offExtensionsChanged = pluginApi.events.on('extensions:components-reloaded', (result) => {
    if (result.failed > 0) {
      ElMessage.warning(`外部组件热更新：成功 ${result.loaded} 个，失败 ${result.failed} 个（见设置 → 扩展）`)
    } else {
      ElMessage.success(`外部组件已热更新（${result.loaded} 个）`)
    }
  })
  reports.registerUiHooks({
    openSettings,
    openImportExport,
    openDesigner,
    openTemplates,
    navigate: navigateTo,
  })
  await reports.init()
  if (!activePluginPage.value && !state.currentReport) {
    const home = listNavItems().find(item => item.id === 'home') || listNavItems()[0]
    if (home) activePluginPage.value = home.id
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  offExtensionsChanged?.()
})

watch(
  () => branding.name,
  () => {
    const title = state.currentReport?.title
    document.title = title ? `${title} · ${branding.name}` : branding.name
  },
)

watch(
  () => state.currentId,
  (id) => { if (id != null) activePluginPage.value = null },
)

watch(
  activePluginPage,
  id => setActiveView(id),
  { immediate: true },
)

watch(
  () => state.currentReport?.title,
  (title) => {
    document.title = title ? `${title} · ${branding.name}` : branding.name
  },
  { immediate: true },
)
</script>

<template>
  <div class="wr-app">
    <div v-if="envIssue" class="env-banner" role="alert">
      <strong>{{ envIssue.kind === 'node' ? 'Node.js 版本不满足要求' : 'pnpm 不可用' }}</strong>
      <span v-if="envIssue.kind === 'node'">
        当前 {{ envIssue.node || '未检测到' }}，Lucky Apps 需要 v{{ envIssue.requiredNode }} 或更高版本。
      </span>
      <span v-else>
        当前 {{ envIssue.pnpm || '未安装' }}，安装插件需要 pnpm {{ envIssue.requiredPnpm }} 或更高版本。
      </span>
      <a
        :href="envIssue.kind === 'node' ? 'https://nodejs.org/zh-CN/download' : 'https://pnpm.io/zh/installation'"
        target="_blank"
        rel="noopener"
      >去安装</a>
    </div>
    <AppSidebar
      @settings="openSettings"
      :active-plugin-page="activePluginPage"
      :report-open="!!state.currentReport"
      @open-plugin-page="openPluginPage"
    />

    <main class="wr-main">
      <component
        :is="pluginPageComponent"
        v-if="activePluginPage && pluginPageComponent"
        class="plugin-page-host"
      />
      <ReportEditor
        v-else-if="state.currentReport"
        :key="state.currentReport.id"
        @open-import-export="openImportExport"
        @open-design="openDesigner()"
      />    </main>

    <component v-for="overlayItem in overlays" :is="overlayItem.component" :key="overlayItem.id" />

    <SettingsDialog
      v-model="showSettings"
      @open-import-export="openImportExport"
      @open-templates="openTemplates"
      @open-designer="openDesigner()"
    />
  </div>
</template>

<style scoped>
.env-banner {
  position: fixed;
  top: 12px;
  left: 50%;
  z-index: 3000;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: calc(100vw - 32px);
  padding: 9px 14px;
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 11px;
  background: var(--el-color-warning-light-9);
  box-shadow: 0 10px 30px -18px rgba(15, 23, 42, 0.45);
  color: var(--el-color-warning-dark-2);
  font-size: 11.5px;
  transform: translateX(-50%);
}

.env-banner strong {
  font-size: 11.5px;
}

.env-banner a {
  color: var(--el-color-primary);
  font-weight: 650;
  text-decoration: none;
  white-space: nowrap;
}
</style>
