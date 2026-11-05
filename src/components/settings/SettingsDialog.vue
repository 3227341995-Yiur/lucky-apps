<script setup>
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useTheme } from '@/composables/useTheme'
import { useReports } from '@/composables/useReports'
import { useExtensions } from '@/composables/useExtensions'
import { resetReportConfig } from '@/services/reportConfigService'
import { pluginApi } from '@/plugins/api'
import AppDialog from '@/components/common/AppDialog.vue'
import ExtensionManager from '@/components/settings/ExtensionManager.vue'
import pkg from '../../../package.json'

defineOptions({ name: 'SettingsDialog' })

const visible = defineModel({ type: Boolean, default: false })

const emit = defineEmits(['open-import-export', 'open-templates', 'open-designer'])

const { themeMode, labels, setTheme } = useTheme()
const { state } = useReports()
const { copyResourcesPath } = useExtensions()

const activeTab = ref('appearance')
const docsFullscreen = ref(false)

const tabs = [
  { key: 'appearance', label: '外观', icon: 'Sunny', desc: '选择界面主题' },
  { key: 'extensions', label: '扩展', icon: 'Grid', desc: '管理样式表、插件脚本与外部组件' },
  { key: 'templates', label: '模板', icon: 'Document', desc: '编辑导出模板与周报预览' },
  { key: 'data', label: '数据', icon: 'Coin', desc: '查看统计并维护周报结构' },
  { key: 'docs', label: '开发文档', icon: 'Reading', desc: '插件、外部组件与二开 API' },
  { key: 'about', label: '关于', icon: 'InfoFilled', desc: '版本与运行环境信息' }
]

const themeOptions = [
  { value: 'system', icon: 'Monitor', desc: '自动跟随操作系统的亮暗色' },
  { value: 'light', icon: 'Sunny', desc: '始终使用亮色主题' },
  { value: 'dark', icon: 'Moon', desc: '始终使用暗色主题' }
]

const dataStats = computed(() => [
  { label: '周报', value: state.stats.reports },
  { label: '工作项', value: state.stats.workItems },
  { label: '回收站', value: state.stats.trash },
  { label: '模板', value: state.stats.templates }
])

const currentTab = computed(() => tabs.find(tab => tab.key === activeTab.value) || tabs[0])

async function handleResetConfig() {
  try {
    await ElMessageBox.confirm(
      '将删除自定义的周报结构配置，恢复为系统默认结构。已有周报内容不会受到影响。',
      '恢复系统默认结构',
      {
        confirmButtonText: '恢复默认',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
  } catch {
    return
  }

  try {
    await resetReportConfig()
    ElMessage.success('已恢复系统默认结构')
  } catch (error) {
    ElMessage.error(`恢复默认结构失败：${error?.message || error}`)
  }
}

async function handleCopyResources() {
  try {
    await copyResourcesPath()
    ElMessage.success('资源目录路径已复制')
  } catch {
    ElMessage.error('复制资源目录路径失败')
  }
}
</script>

<template>
  <AppDialog
    v-model="visible"
    title="设置中心"
    subtitle="外观、扩展、模板与数据管理"
    icon="Setting"
    :width="activeTab === 'docs' ? 'min(1180px, 96vw)' : '920px'"
    fill-height
  >
    <div class="settings-body">
      <nav class="settings-nav" aria-label="设置分类">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="nav-item"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <el-icon :size="16"><component :is="tab.icon" /></el-icon>
          <span>{{ tab.label }}</span>
        </button>
      </nav>

      <el-scrollbar class="settings-content">
        <div class="settings-content-inner">
        <header class="panel-head">
          <h3>{{ currentTab.label }}</h3>
          <p>{{ currentTab.desc }}</p>
        </header>

        <!-- 外观 -->
        <div v-if="activeTab === 'appearance'" class="panel">
          <div class="theme-grid">
            <button
              v-for="option in themeOptions"
              :key="option.value"
              type="button"
              class="theme-card"
              :class="{ active: themeMode === option.value }"
              @click="setTheme(option.value)"
            >
              <span class="theme-icon">
                <el-icon :size="20"><component :is="option.icon" /></el-icon>
              </span>
              <span class="theme-name">{{ labels[option.value] }}</span>
              <span class="theme-desc">{{ option.desc }}</span>
              <el-icon v-if="themeMode === option.value" class="theme-check" :size="16">
                <CircleCheckFilled />
              </el-icon>
            </button>
          </div>
          <p class="hint">默认跟随系统，选择后立即生效并记住设置。</p>
        </div>

        <!-- 扩展 -->
        <div v-else-if="activeTab === 'extensions'" class="panel">
          <ExtensionManager />
        </div>

        <!-- 模板 -->
        <div v-else-if="activeTab === 'templates'" class="panel">
          <div class="template-summary">
            <div class="template-count">
              <el-icon :size="22"><Document /></el-icon>
              <span><strong>{{ state.stats.templates }}</strong> 个模板</span>
            </div>
            <el-button type="primary" @click="emit('open-templates')">
              <el-icon><EditPen /></el-icon><span>打开模板设计器</span>
            </el-button>
          </div>
          <p class="hint">模板支持 IDE 式编辑与周报预览，可新增、修改导出模板并设为默认。</p>
        </div>

        <!-- 数据 -->
        <div v-else-if="activeTab === 'data'" class="panel">
          <div class="stat-grid">
            <div v-for="item in dataStats" :key="item.label" class="stat-tile">
              <span class="stat-value">{{ item.value }}</span>
              <span class="stat-label">{{ item.label }}</span>
            </div>
          </div>

          <div class="action-row">
            <el-button @click="emit('open-import-export')">
              <el-icon><Sort /></el-icon><span>导入 / 导出</span>
            </el-button>
            <el-button @click="emit('open-designer')">
              <el-icon><MagicStick /></el-icon><span>打开结构设计器</span>
            </el-button>
          </div>

          <div class="reset-row">
            <div class="reset-text">
              <strong>默认结构</strong>
              <span>仅重置之后新建周报所使用的区块结构，不影响已有周报内容。</span>
            </div>
            <el-button type="danger" plain @click="handleResetConfig">恢复系统默认结构</el-button>
          </div>
        </div>

        <!-- 开发文档 -->
        <div v-else-if="activeTab === 'docs'" class="panel docs-panel">
          <div class="docs-toolbar">
            <span class="docs-toolbar-title">插件 · 外部组件 · 二开 API</span>
            <el-button size="small" @click="docsFullscreen = true">
              <el-icon><FullScreen /></el-icon>
              <span>全屏</span>
            </el-button>
          </div>
          <iframe
            class="docs-frame"
            src="/docs/index.html"
            title="周报开发文档"
          />
        </div>

        <!-- 关于 -->
        <div v-else class="panel">
          <div class="about-list">
            <div class="about-row">
              <span>应用版本</span>
              <strong>v{{ pkg.version }}</strong>
            </div>
            <div class="about-row">
              <span>对外 API</span>
              <strong>v{{ pluginApi.version }} · API {{ pluginApi.apiVersion }}</strong>
            </div>
            <div class="about-row">
              <span>技术栈</span>
              <strong>Vue 3.5 · Element Plus 2.14 · Tauri 2</strong>
            </div>
            <div class="about-row">
              <span>扩展资源目录</span>
              <el-button size="small" type="primary" plain @click="handleCopyResources">
                <el-icon><CopyDocument /></el-icon><span>复制路径</span>
              </el-button>
            </div>
          </div>
          <p class="hint">插件可通过 window.weekReport 调用对外 API，扩展资源修改后重新加载应用生效。</p>
        </div>
        </div>
      </el-scrollbar>
    </div>
  </AppDialog>

  <AppDialog
    v-model="docsFullscreen"
    title="开发文档"
    subtitle="插件、外部组件与二开 API"
    icon="Reading"
    width="96vw"
    fill-height
    :show-footer="false"
  >
    <iframe
      class="docs-frame is-fullscreen"
      src="/docs/index.html"
      title="周报开发文档"
    />
  </AppDialog>
</template>

<style scoped>
.settings-body {
  display: flex;
  gap: 20px;
  height: 100%;
  min-height: 0;
  padding: 18px 20px;
}

.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
  width: 160px;
  padding-right: 12px;
  border-right: 1px solid var(--el-border-color-lighter);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  text-align: left;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.nav-item:hover {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.nav-item.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

.settings-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.settings-content-inner {
  padding-right: 8px;
}

.docs-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.docs-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 2px 8px;
}

.docs-toolbar-title {
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--el-text-color-secondary);
}

.docs-frame {
  width: 100%;
  height: min(600px, calc(100vh - 260px));
  border: 0;
  border-radius: 8px;
  background: var(--el-bg-color);
}

.docs-frame.is-fullscreen {
  flex: 1;
  min-height: 0;
  height: 100%;
  border-radius: 0;
}

.panel-head {
  margin-bottom: 16px;
}

.panel-head h3 {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}

.panel-head p {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.hint {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}

/* 外观 */
.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.theme-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 16px 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  background: var(--el-bg-color);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.theme-card:hover {
  border-color: var(--el-color-primary-light-5);
}

.theme-card.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.theme-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.theme-card.active .theme-icon {
  background: var(--el-bg-color);
  color: var(--el-color-primary);
}

.theme-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.theme-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.theme-check {
  position: absolute;
  top: 10px;
  right: 10px;
  color: var(--el-color-primary);
}

/* 模板 */
.template-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-fill-color-lighter);
}

.template-count {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.template-count strong {
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
  color: var(--el-text-color-primary);
}

/* 数据 */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.stat-tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-fill-color-lighter);
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--el-text-color-primary);
}

.stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.action-row :deep(.el-button + .el-button) {
  margin-left: 0;
}

.reset-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 16px;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
}

.reset-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.reset-text strong {
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.reset-text span {
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

/* 关于 */
.about-list {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  overflow: hidden;
}

.about-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.about-row + .about-row {
  border-top: 1px solid var(--el-border-color-lighter);
}

.about-row strong {
  font-weight: 600;
  color: var(--el-text-color-primary);
}
</style>
