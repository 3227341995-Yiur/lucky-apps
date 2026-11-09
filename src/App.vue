<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import ReportEditor from '@/components/ReportEditor.vue'
import WelcomePage from '@/components/WelcomePage.vue'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'
import ImportExportDialog from '@/components/importexport/ImportExportDialog.vue'
import ReportStructureDesigner from '@/components/designer/ReportStructureDesigner.vue'
import TemplateDesigner from '@/components/TemplateDesigner/index.vue'
import { useReports } from '@/composables/useReports'
import { pluginApi } from '@/plugins/api'
import { getNavItemComponent } from '@/plugins/registry'
import { branding } from '@/composables/useBranding'

const reports = useReports()
const { state } = reports

const showSettings = ref(false)
const showImportExport = ref(false)
const importInitialTab = ref('export')
const showDesigner = ref(false)
const designerMode = ref('edit')
const showTemplates = ref(false)
const activePluginPage = ref(null)
const pluginPageComponent = computed(() => (
  activePluginPage.value ? getNavItemComponent(activePluginPage.value) : null
))
let offExtensionsChanged = null

function closeDialogs() {
  showSettings.value = false
  showImportExport.value = false
  showDesigner.value = false
  showTemplates.value = false
}

function openPluginPage(item) {
  closeDialogs()
  activePluginPage.value = item.id
}

function openSettings() {
  closeDialogs()
  activePluginPage.value = null
  showSettings.value = true
}

function openTemplates() {
  closeDialogs()
  activePluginPage.value = null
  showTemplates.value = true
}

function openImportExport(tab = 'export') {
  closeDialogs()
  importInitialTab.value = tab
  showImportExport.value = true
}

function openDesigner(mode = 'edit') {
  closeDialogs()
  designerMode.value = mode
  showDesigner.value = true
}

async function handleCreate() {
  activePluginPage.value = null
  try {
    await reports.createReport()
  } catch (error) {
    ElMessage.error(`新建周报失败: ${error?.message || error}`)
  }
}

async function handleImported(payload = {}) {
  await reports.refreshAll()
  reports.setView('reports')
  if (payload.importedCount) {
    ElMessage.success(`已导入 ${payload.importedCount} 份周报`)
  }
}

async function handleApplyConfig(config) {
  try {
    await ElMessageBox.confirm(
      '将使用该结构重建当前周报的区块（相同类型保留原数据行），确定继续吗？',
      '应用到当前周报',
      { confirmButtonText: '应用', cancelButtonText: '取消', type: 'warning' }
    )
    await reports.applyConfigToCurrent(config)
    showDesigner.value = false
    ElMessage.success('结构已应用并保存')
  } catch {
    // 用户取消
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
    openImportExport('export')
  }
  if (ctrl && !event.shiftKey && event.key.toLowerCase() === 'n') {
    event.preventDefault()
    handleCreate()
  }
}

onMounted(async () => {
  document.addEventListener('keydown', handleKeydown)
  offExtensionsChanged = pluginApi.events.on('extensions:components-reloaded', result => {
    if (result.failed > 0) {
      ElMessage.warning(`外部组件热更新：成功 ${result.loaded} 个，失败 ${result.failed} 个（见设置 → 扩展）`)
    } else {
      ElMessage.success(`外部组件已热更新（${result.loaded} 个）`)
    }
  })
  reports.registerUiHooks({
    openSettings,
    openImportExport: () => openImportExport('export'),
    openDesigner: () => openDesigner('edit'),
    openTemplates,
    openReports: () => { activePluginPage.value = null; reports.setView('reports') },
    openWelcome: () => { activePluginPage.value = null; reports.clearCurrent(); reports.setView('reports') }
  })
  await reports.init()
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
  }
)

watch(
  () => state.currentId,
  id => { if (id != null) activePluginPage.value = null }
)

watch(
  () => state.currentReport?.title,
  title => {
    document.title = title ? `${title} · ${branding.name}` : branding.name
  },
  { immediate: true }
)
</script>

<template>
  <div class="wr-app">
    <AppSidebar
      @create="handleCreate"
      @settings="openSettings"
      @templates="openTemplates"
      @import-export="openImportExport('export')"
      :active-plugin-page="activePluginPage"
      @open-plugin-page="openPluginPage"
    />

    <main class="wr-main">
      <component
        :is="pluginPageComponent"
        v-if="activePluginPage && pluginPageComponent"
        class="plugin-page-host"
      />
      <ReportEditor
        v-else-if="state.view === 'reports' && state.currentReport"
        :key="state.currentReport.id"
        @open-import-export="openImportExport"
        @open-design="openDesigner('edit')"
      />
      <WelcomePage
        v-else-if="state.view === 'reports'"
        @create="handleCreate"
        @open-report="reports.selectReport"
        @open-import-export="openImportExport('import')"
        @open-designer="openDesigner('edit')"
        @open-settings="openSettings"
      />
    </main>

    <SettingsDialog
      v-model="showSettings"
      @open-import-export="openImportExport('import')"
      @open-templates="openTemplates"
      @open-designer="openDesigner('edit')"
    />

    <ImportExportDialog
      v-model="showImportExport"
      :current-report="state.currentReport"
      :initial-tab="importInitialTab"
      @imported="handleImported"
    />

    <ReportStructureDesigner
      v-model="showDesigner"
      :mode="designerMode"
      :current-report="state.currentReport"
      @apply="handleApplyConfig"
    />

    <TemplateDesigner v-model="showTemplates" />
  </div>
</template>
