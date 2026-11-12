<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'
import { cordis } from '@/plugins/cordis'
import { getNavItemComponent, listNavItems, listOverlays } from '@/plugins/registry'
import { branding } from '@/composables/useBranding'
import { apiGet } from '@/services/rpc'

const showSettings = ref(false)
const envIssue = ref<any>(null)
const activePluginPage = ref(null)
const overlays = computed(() => listOverlays())

const pluginPageComponent = computed(() => (
  activePluginPage.value ? getNavItemComponent(activePluginPage.value) : null
))

// 插件模块重载后组件对象会变：用组件对象身份做 KeepAlive key，
// 只重建真正变化的页面，其它页面实例与状态保持不动。
const pageKeys = new WeakMap<object, string>()
let pageKeySeq = 0
const pluginPageKey = computed(() => {
  const id = activePluginPage.value
  const component = pluginPageComponent.value
  if (!id) return ''
  if (!component) return id
  let key = pageKeys.get(component)
  if (!key) {
    key = `${id}:${++pageKeySeq}`
    pageKeys.set(component, key)
  }
  return key
})
let offExtensionsChanged = null

function closeDialogs() {
  showSettings.value = false
}

function openPluginPage(item) {
  closeDialogs()
  activePluginPage.value = item.id
}

function navigateTo(id) {
  if (!id) return false
  const alias = id === 'welcome' ? 'home' : id
  const item = listNavItems().find(entry => entry.id === alias)
  if (!item) return false
  openPluginPage(item)
  return true
}

function openSettings() {
  closeDialogs()
  showSettings.value = true
}

onMounted(async () => {
  cordis.ui.bind({ navigate: navigateTo, openSettings })
  try {
    const env = await apiGet('/api/env')
    const nodeMajor = Number(String(env?.node || '').split('.')[0]) || 0
    if (!env?.nodeOk || nodeMajor < (env?.requiredNode || 24)) {
      envIssue.value = { kind: 'node', ...env }
    }
  } catch {}
  offExtensionsChanged = cordis.on('extensions/components-reloaded', (result) => {
    if (result.failed > 0) {
      ElMessage.warning(`外部组件热更新：成功 ${result.loaded} 个，失败 ${result.failed} 个（见设置 → 扩展）`)
    } else {
      ElMessage.success(`外部组件已热更新（${result.loaded} 个）`)
    }
  })
  if (!activePluginPage.value) {
    const home = listNavItems().find(item => item.id === 'home') || listNavItems()[0]
    if (home) activePluginPage.value = home.id
  }
})

onBeforeUnmount(() => {
  offExtensionsChanged?.()
})

watch(
  () => branding.name,
  () => { document.title = branding.name },
  { immediate: true },
)

watch(
  () => listNavItems().map(item => item.id).join(','),
  () => {
    if (!activePluginPage.value) return
    if (listNavItems().some(item => item.id === activePluginPage.value)) return
    const home = listNavItems().find(item => item.id === 'home') || listNavItems()[0]
    activePluginPage.value = home?.id || null
  },
)

watch(
  activePluginPage,
  id => cordis.ui.setActiveView(id),
  { immediate: true },
)
</script>

<template>
  <div class="wr-app">
    <div v-if="envIssue" class="env-banner" role="alert">
      <strong>Node.js 版本不满足要求</strong>
      <span>当前 {{ envIssue.node || '未检测到' }}，Lucky Apps 需要 v{{ envIssue.requiredNode }} 或更高版本。</span>
      <a href="https://nodejs.org/zh-CN/download" target="_blank" rel="noopener">去安装</a>
    </div>
    <AppSidebar
      @settings="openSettings"
      :active-plugin-page="activePluginPage"
      @open-plugin-page="openPluginPage"
    />

    <main class="wr-main">
      <!-- 页面切换只挂起，不销毁：插件页面的编辑态、滚动位置和请求状态随导航保留。 -->
      <KeepAlive :max="12">
        <component
          :is="pluginPageComponent"
          v-if="activePluginPage && pluginPageComponent"
          :key="pluginPageKey"
          class="plugin-page-host"
        />
      </KeepAlive>
    </main>

    <component v-for="overlayItem in overlays" :is="overlayItem.component" :key="overlayItem.id" />

    <SettingsDialog v-model="showSettings" />
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
