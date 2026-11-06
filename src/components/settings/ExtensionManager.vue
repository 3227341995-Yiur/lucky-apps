<script setup>
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useExtensions } from '@/composables/useExtensions'

defineOptions({ name: 'ExtensionManager' })

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
  reloadApp
} = useExtensions()

const groupOrder = ['style', 'script', 'component-module']

const STATUS_META = {
  loaded: { label: '已加载', type: 'success' },
  disabled: { label: '已禁用', type: 'info' },
  error: { label: '加载失败', type: 'danger' },
  pending: { label: '待加载', type: 'warning' }
}

const TYPE_LABELS = {
  style: '样式',
  script: '脚本',
  'component-module': '组件包'
}

const rescanning = ref(false)
const hotReloading = ref(false)

function statusOf(resource) {
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

async function handleToggle(resource) {
  let enabled
  try {
    enabled = await toggleResource(resource.id)
  } catch (error) {
    ElMessage.error(`保存扩展设置失败：${error?.message || error}`)
    return
  }
  if (enabled === null) return

  try {
    await ElMessageBox.confirm(
      `已${enabled ? '启用' : '禁用'}「${resource.name}」，启停状态需要重新加载应用后生效。是否立即重新加载？`,
      '需要重新加载',
      {
        confirmButtonText: '立即重新加载',
        cancelButtonText: '稍后',
        type: 'info'
      }
    )
    reloadApp()
  } catch {
    ElMessage.info('设置已保存，下次启动生效')
  }
}
</script>

<template>
  <div class="extension-manager">
    <div class="ext-toolbar">
      <div class="ext-counts">
        <span class="ext-count"><strong>{{ enabledCount }}</strong> 项已启用</span>
        <span class="ext-count" :class="{ danger: errorCount > 0 }">
          <strong>{{ errorCount }}</strong> 项加载失败
        </span>
        <span class="ext-count" :class="{ danger: extensionState.watcher === 'error' }">
          文件监听：{{ extensionState.watcher === 'active' ? '已启用' : extensionState.watcher === 'error' ? '不可用' : '未启动' }}
        </span>
      </div>
      <div class="ext-actions">
        <el-button size="small" :loading="rescanning" @click="handleRescan">
          <el-icon><Refresh /></el-icon><span>重新扫描</span>
        </el-button>
        <el-button size="small" type="primary" plain :loading="hotReloading" @click="handleHotReload">
          <el-icon><RefreshRight /></el-icon><span>热加载组件</span>
        </el-button>
        <el-button size="small" @click="handleCopyPath">
          <el-icon><CopyDocument /></el-icon><span>复制资源目录</span>
        </el-button>
        <el-button size="small" @click="handleCopyPluginsPath">
          <el-icon><FolderOpened /></el-icon><span>复制插件目录</span>
        </el-button>
        <el-button size="small" @click="reloadApp">
          <el-icon><SwitchButton /></el-icon><span>重新加载应用</span>
        </el-button>
      </div>
    </div>

    <p class="ext-note">
      内置组件包随应用打包；外部包安装到用户插件目录的 node_modules，并在
      <code>plugins/cordis.yml</code> 写包名即可被 Cordis 注册。启用 / 禁用需要重新加载应用生效。
    </p>

    <div v-if="extensionState.loading || rescanning" class="ext-state">
      <el-icon class="is-loading" :size="20"><Loading /></el-icon>
      <span>正在加载扩展资源…</span>
    </div>

    <div v-else-if="extensionState.resources.length === 0" class="wr-empty-state">
      <el-icon :size="28"><FolderOpened /></el-icon>
      <h3>暂无扩展资源</h3>
      <p>样式表与插件脚本放入资源目录的 css / js；外部组件包安装到用户插件目录的 node_modules。</p>
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

        <p v-if="key === 'component-module'" class="group-note">
          组件包默认导出 Cordis 插件，通过 <code>ctx.weekReport</code> 注册组件与列插槽；保存后自动热加载。
        </p>

        <div class="ext-list">
          <div v-for="resource in groups[key]" :key="resource.id" class="ext-item">
            <span class="type-mark" :class="`is-${key}`">{{ TYPE_LABELS[key] }}</span>
            <div class="ext-info">
              <div class="ext-line">
                <span class="ext-name">{{ resource.name }}</span>
                <code v-if="isComponentGroup(key)" class="ext-file">{{ resource.file }}</code>
                <el-tag size="small" effect="light" :type="statusOf(resource).type">
                  {{ statusOf(resource).label }}
                </el-tag>
              </div>
              <p v-if="resource.error || resource.status === 'error'" class="ext-error">
                {{ resource.error || '资源加载失败' }}
              </p>
            </div>
            <el-switch
              :model-value="resource.enabled"
              :aria-label="`启用 ${resource.name}`"
              @change="handleToggle(resource)"
            />
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.ext-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.ext-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ext-count {
  padding: 3px 9px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.ext-count strong {
  font-size: 12.5px;
  color: var(--el-text-color-primary);
}

.ext-count.danger strong {
  color: var(--el-color-danger);
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
  margin: 0 0 14px;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.ext-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 20px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.ext-group {
  margin-bottom: 18px;
}

.ext-group:last-child {
  margin-bottom: 0;
}

.group-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
}

.group-title-wrap {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.group-title {
  font-size: 12.5px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}

.group-hint {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.group-count {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--el-fill-color);
  font-size: 10.5px;
  line-height: 17px;
  text-align: center;
  color: var(--el-text-color-secondary);
}

.group-note {
  margin: 0 0 8px;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.ext-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
}

.ext-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--el-bg-color);
}

.ext-item + .ext-item {
  border-top: 1px solid var(--el-border-color-lighter);
}

.type-mark {
  flex: 0 0 54px;
  padding: 2px 0;
  border-radius: 4px;
  text-align: center;
  font-size: 10.5px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
}

.type-mark.is-component-vue {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.type-mark.is-component-slot {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
}

.type-mark.is-component-module {
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
}

.ext-info {
  flex: 1;
  min-width: 0;
}

.ext-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
}

.ext-name {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  overflow-wrap: anywhere;
}

.ext-file {
  font-family: var(--wr-mono);
  font-size: 10.5px;
  color: var(--el-text-color-secondary);
  padding: 0 5px;
  border-radius: 4px;
  background: var(--el-fill-color-lighter);
  overflow-wrap: anywhere;
}

.ext-error {
  margin: 3px 0 0;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--el-color-danger);
  overflow-wrap: anywhere;
}

.ext-item :deep(.el-switch) {
  flex-shrink: 0;
}
</style>
