<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useTheme } from '@/composables/useTheme'
import { branding, setBranding } from '@/composables/useBranding'
import { apiGet, apiPost } from '@/services/rpc'
import { useExtensions } from '@/composables/useExtensions'
import { buildIconPayload } from '@/utils/appIcon'
import { pluginApi } from '@/plugins/api'
import AppDialog from '@/components/common/AppDialog.vue'
import { getSettingsSectionComponent, listSettingsSections } from '@/plugins/registry'
import {
  DEFAULT_LOADING_CONFIG,
  LOADING_FONT_OPTIONS,
  previewStartupLoader,
  readLoadingConfig,
  saveLoadingConfig,
} from '@/startupLoader'
import FullscreenIcon from '@/components/common/FullscreenIcon.vue'
import ExtensionManager from '@/components/settings/ExtensionManager.vue'
import pkg from '../../../package.json'

defineOptions({ name: 'SettingsDialog' })

const visible = defineModel({ type: Boolean, default: false })

const emit = defineEmits(['open-import-export', 'open-templates', 'open-designer'])

const { themeMode, labels, setTheme } = useTheme()
const { copyResourcesPath } = useExtensions()

const activeTab = ref('appearance')
const docsFullscreen = ref(false)
const loadingConfig = ref(readLoadingConfig())
const autostartEnabled = ref(false)
const autostartSupported = ref(true)
const autostartLoading = ref(false)
const loadingEffects = [
  { value: 'explode', label: '爆炸粒子' },
  { value: 'dissolve', label: '上升消散' },
  { value: 'spark', label: '火花飞散' },
]
const loadingPresets = [
  {
    key: 'classic',
    label: '经典蓝',
    hint: '干净、克制',
    config: {
      color: '#3574f0',
      background: '',
      effect: 'explode',
      particleColors: '#3574f0,#36a3ff,#67c23a,#e6a23c,#f56c6c,#8b5cf6',
    },
  },
  {
    key: 'neon',
    label: '霓虹',
    hint: '高对比',
    config: {
      color: '#22d3ee',
      background: '#0b1020',
      effect: 'spark',
      particleColors: '#22d3ee,#a78bfa,#f472b6,#facc15',
    },
  },
  {
    key: 'candy',
    label: '糖果',
    hint: '轻快、明亮',
    config: {
      color: '#ec4899',
      background: '#fff7ed',
      effect: 'explode',
      particleColors: '#ec4899,#f59e0b,#8b5cf6,#22c55e',
    },
  },
  {
    key: 'night',
    label: '暗夜',
    hint: '安静、消散',
    config: {
      color: '#a78bfa',
      background: '#111827',
      effect: 'dissolve',
      particleColors: '#a78bfa,#60a5fa,#34d399,#f472b6',
    },
  },
]
const activePreset = computed(() => {
  const config = loadingConfig.value
  return loadingPresets.find(preset => (
    preset.config.color === config.color
    && preset.config.background === config.background
    && preset.config.effect === config.effect
  ))?.key || ''
})
const loadingShapes = [
  { value: 'circle', label: '圆点' },
  { value: 'star', label: '星形' },
]

async function loadAutostart() {
  try {
    const result = await apiGet('/api/app/autostart')
    autostartSupported.value = result.supported !== false
    autostartEnabled.value = Boolean(result.enabled)
  } catch {
    autostartSupported.value = false
  }
}

async function toggleAutostart(value) {
  autostartLoading.value = true
  try {
    const result = await apiPost('/api/app/autostart', { enabled: value })
    autostartEnabled.value = Boolean(result.enabled)
    ElMessage.success(value ? '已开启开机自启动' : '已关闭开机自启动')
  } catch (error) {
    autostartEnabled.value = !value
    ElMessage.error(`设置开机自启动失败：${error?.message || error}`)
  } finally {
    autostartLoading.value = false
  }
}

async function saveBranding() {
  setBranding({ name: branding.name, icon: branding.icon })
  try {
    const invoke = window.__TAURI__?.core?.invoke
    if (!invoke) {
      ElMessage.success('程序名称与图标已保存（当前环境不是桌面应用，仅更新界面）')
      return
    }
    let icon = null
    if (branding.icon) {
      icon = await buildIconPayload(branding.icon)
    }
    const message = await invoke('apply_branding', { name: branding.name, icon })
    ElMessage.success(message || '程序名称与图标已更新')
  } catch (error) {
    ElMessage.warning(`界面已保存，但更新程序图标失败：${error?.message || error}`)
  }
}

function persistLoading(patch = {}) {
  loadingConfig.value = saveLoadingConfig({ ...loadingConfig.value, ...patch })
}

function previewLoading() {
  persistLoading()
  previewStartupLoader(loadingConfig.value)
}

function applyLoadingPreset(preset) {
  loadingConfig.value = saveLoadingConfig({ ...loadingConfig.value, ...preset.config })
}

function resetLoading() {
  loadingConfig.value = saveLoadingConfig(DEFAULT_LOADING_CONFIG)
}

watch(visible, (open) => {
  if (!open) docsFullscreen.value = false
  else loadAutostart()
})

const BASE_TABS = [
  { key: 'appearance', label: '外观', icon: 'Sunny', desc: '选择界面主题' },
  { key: 'loading', label: '加载动画', icon: 'MagicStick', desc: '自定义启动 loading 文字、手绘动效与粒子' },
  { key: 'extensions', label: '扩展', icon: 'Grid', desc: '管理样式表、插件脚本与外部组件' },
  { key: 'docs', label: '开发文档', icon: 'Reading', desc: '插件、外部组件与二开 API' },
  { key: 'about', label: '关于', icon: 'InfoFilled', desc: '版本与运行环境信息' },
]

const tabs = computed(() => {
  const about = BASE_TABS.filter(tab => tab.key === 'about')
  const base = BASE_TABS.filter(tab => tab.key !== 'about')
  const external = listSettingsSections().map(item => ({
    ...item,
    key: item.id,
    desc: '外部插件注册的设置面板',
  }))
  // “关于”固定在最下面，外部插件设置面板排在它前面
  return [...base, ...external, ...about]
})

const themeOptions = [
  { value: 'system', icon: 'Monitor', desc: '自动跟随操作系统的亮暗色' },
  { value: 'light', icon: 'Sunny', desc: '始终使用亮色主题' },
  { value: 'dark', icon: 'Moon', desc: '始终使用暗色主题' },
]

const currentTab = computed(() => tabs.value.find(tab => tab.key === activeTab.value) || tabs.value[0])

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
    :fullscreen="docsFullscreen"
    fill-height
  >
    <template #actions>
      <button
        type="button"
        class="settings-fullscreen-btn"
        :title="docsFullscreen ? '退出全屏' : '全屏'"
        :aria-label="docsFullscreen ? '退出全屏' : '全屏'"
        @click="docsFullscreen = !docsFullscreen"
      >
        <fullscreen-icon :exit="docsFullscreen" />
      </button>
    </template>

    <div class="settings-body" :class="{ 'is-docs-fullscreen': docsFullscreen }">
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

      <el-scrollbar v-if="activeTab !== 'docs'" class="settings-content">
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

          <div class="brand-card">
            <div class="brand-head">
              <span class="brand-logo">
                <img v-if="branding.icon" :src="branding.icon" alt="" />
                <span v-else>WR</span>
              </span>
              <div>
                <strong>程序名称与图标</strong>
                <p>修改窗口标题、窗口/托盘图标与 exe 文件图标；也可由插件通过 weekReport.branding.set 修改界面部分。</p>
              </div>
            </div>
            <div class="brand-fields">
              <label class="loading-field">
                <span>程序名称</span>
                <el-input v-model="branding.name" maxlength="40" />
              </label>
              <label class="loading-field">
                <span>程序图标 URL</span>
                <el-input v-model="branding.icon" placeholder="https://… 或 data:image/…（建议方形）" />
              </label>
            </div>
            <p class="hint">会同步修改窗口标题、标题栏/任务栏/托盘图标与 exe 文件图标（exe 需重启后生效）。</p>
            <el-button type="primary" plain @click="saveBranding">保存品牌</el-button>
          </div>

          <div class="brand-card">
            <div class="brand-head">
              <span class="brand-logo system-logo"><el-icon :size="18"><Monitor /></el-icon></span>
              <div>
                <strong>启动与托盘</strong>
                <p>关闭或最小化窗口会隐藏到系统托盘，从托盘图标恢复。</p>
              </div>
            </div>
            <div class="system-row">
              <div>
                <strong>开机自启动</strong>
                <span>登录 Windows 后自动启动周报系统</span>
              </div>
              <el-switch
                v-model="autostartEnabled"
                :loading="autostartLoading"
                :disabled="!autostartSupported"
                @change="toggleAutostart"
              />
            </div>
          </div>
        </div>

        <!-- 加载动画 -->
        <div v-else-if="activeTab === 'loading'" class="panel loading-panel">
          <div class="loading-hero">
            <div class="loading-hero-copy">
              <span class="loading-eyebrow">LOADING STUDIO</span>
              <h3>把启动页改成你的样子</h3>
              <p>文字、字体、颜色、粒子都可以自己调。改完点预览，满意后下次启动生效。</p>
              <div class="loading-actions">
                <el-button type="primary" @click="previewLoading">
                  <el-icon><VideoPlay /></el-icon><span>预览动画</span>
                </el-button>
                <el-button plain @click="resetLoading">恢复经典</el-button>
              </div>
            </div>
            <div
              class="loading-word-preview"
              :style="{
                color: loadingConfig.color,
                fontFamily: loadingConfig.font,
                fontSize: `${Math.min(46, loadingConfig.fontSize * 0.62)}px`
              }"
            >{{ loadingConfig.text }}</div>
          </div>

          <div class="loading-presets">
            <button
              v-for="preset in loadingPresets"
              :key="preset.key"
              type="button"
              class="loading-preset"
              :class="{ active: activePreset === preset.key }"
              :style="{ '--preset-color': preset.config.color }"
              @click="applyLoadingPreset(preset)"
            >
              <span class="preset-swatch" :style="{ background: preset.config.color }"></span>
              <span class="preset-copy">
                <strong>{{ preset.label }}</strong>
                <small>{{ preset.hint }}</small>
              </span>
            </button>
          </div>

          <div class="loading-card">
            <h4>文字</h4>
            <div class="loading-row">
              <span class="loading-label">加载文字</span>
              <el-input
                v-model="loadingConfig.text"
                maxlength="40"
                show-word-limit
                @input="persistLoading()"
              />
            </div>
            <div class="loading-row">
              <span class="loading-label">副标题</span>
              <el-input
                v-model="loadingConfig.subtitle"
                maxlength="60"
                @input="persistLoading()"
              />
            </div>
            <div class="loading-row">
              <span class="loading-label">字体</span>
              <el-select v-model="loadingConfig.font" @change="persistLoading()">
                <el-option
                  v-for="font in LOADING_FONT_OPTIONS"
                  :key="font.value"
                  :label="font.label"
                  :value="font.value"
                />
              </el-select>
            </div>
            <div class="loading-row">
              <span class="loading-label">字号</span>
              <el-input-number
                v-model="loadingConfig.fontSize"
                :min="28"
                :max="160"
                controls-position="right"
                @change="persistLoading()"
              />
            </div>
            <div class="loading-row">
              <span class="loading-label">文字颜色</span>
              <div class="loading-inline">
                <el-color-picker v-model="loadingConfig.color" @change="persistLoading()" />
                <code>{{ loadingConfig.color }}</code>
              </div>
            </div>
            <div class="loading-row">
              <span class="loading-label">背景颜色</span>
              <div class="loading-inline">
                <el-color-picker v-model="loadingConfig.background" @change="persistLoading()" />
                <code>{{ loadingConfig.background || '跟随主题' }}</code>
              </div>
            </div>
          </div>

          <div class="loading-card">
            <h4>收尾</h4>
            <div class="loading-row">
              <span class="loading-label">收尾效果</span>
              <el-select v-model="loadingConfig.effect" @change="persistLoading()">
                <el-option v-for="item in loadingEffects" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </div>
            <div class="loading-row">
              <span class="loading-label">播放速度</span>
              <div class="loading-slider">
                <el-slider v-model="loadingConfig.speed" :min="0.4" :max="2.5" :step="0.1" @change="persistLoading()" />
                <strong>{{ Number(loadingConfig.speed).toFixed(1) }}×</strong>
              </div>
            </div>
            <div class="loading-row">
              <span class="loading-label">笔尖</span>
              <el-switch v-model="loadingConfig.showPen" @change="persistLoading()" />
            </div>
          </div>

          <div class="loading-card">
            <h4>粒子</h4>
            <div class="loading-row">
              <span class="loading-label">粒子形状</span>
              <el-select v-model="loadingConfig.particleShape" @change="persistLoading()">
                <el-option v-for="item in loadingShapes" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </div>
            <div class="loading-row">
              <span class="loading-label">数量 / 字</span>
              <div class="loading-slider">
                <el-slider v-model="loadingConfig.particleCount" :min="0" :max="40" :step="1" @change="persistLoading()" />
                <strong>{{ loadingConfig.particleCount }}</strong>
              </div>
            </div>
            <div class="loading-row">
              <span class="loading-label">颜色</span>
              <el-input
                v-model="loadingConfig.particleColors"
                placeholder="#3574f0,#67c23a"
                @input="persistLoading()"
              />
            </div>
          </div>

        </div>

        <!-- 扩展 -->
        <div v-else-if="activeTab === 'extensions'" class="panel">
          <ExtensionManager />
        </div>

        <!-- 外部设置面板 -->
        <div v-else-if="getSettingsSectionComponent(activeTab)" class="panel">
          <component :is="getSettingsSectionComponent(activeTab)" />
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

      <div v-else class="settings-content docs-content-wrap">
        <iframe
          class="docs-frame"
          src="/docs/index.html"
          title="周报开发文档"
        />
      </div>
    </div>
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

.settings-fullscreen-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.settings-fullscreen-btn:hover {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.settings-body.is-docs-fullscreen {
  padding: 12px 16px;
}

.docs-content-wrap {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.docs-frame {
  flex: 1;
  width: 100%;
  min-height: 0;
  height: 100%;
  border: 0;
  border-radius: 8px;
  background: var(--el-bg-color);
}

.settings-body.is-docs-fullscreen .docs-frame {
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
.loading-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 8px;
}

.loading-hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  min-height: 174px;
  padding: 22px 26px;
  overflow: hidden;
  border-radius: 18px;
  background:
    radial-gradient(circle at 82% 18%, rgba(34, 211, 238, 0.42), transparent 32%),
    radial-gradient(circle at 12% 88%, rgba(139, 92, 246, 0.34), transparent 34%),
    linear-gradient(135deg, #0f172a 0%, #1e3a8a 52%, #0891b2 100%);
  color: #fff;
  box-shadow: 0 18px 40px -24px rgba(15, 23, 42, 0.7);
}

.loading-hero::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, 0.08) 48%, transparent 64%);
}

.loading-hero-copy {
  position: relative;
  z-index: 1;
  max-width: 58%;
  min-width: 0;
}

.loading-eyebrow {
  display: inline-flex;
  padding: 3px 8px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  font-family: var(--wr-mono);
  font-size: 9px;
  letter-spacing: 0.16em;
  color: rgba(255, 255, 255, 0.82);
}

.loading-hero h3 {
  margin: 10px 0 6px;
  font-size: 20px;
  font-weight: 720;
  letter-spacing: -0.02em;
  color: #fff;
}

.loading-hero p {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.7);
}

.loading-hero .loading-actions {
  margin-top: 14px;
}

.loading-hero :deep(.el-button--primary) {
  --el-button-bg-color: #fff;
  --el-button-border-color: #fff;
  --el-button-text-color: #0f172a;
  --el-button-hover-bg-color: #e2e8f0;
  --el-button-hover-border-color: #e2e8f0;
  --el-button-hover-text-color: #0f172a;
}

.loading-hero :deep(.el-button.is-plain) {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.08);
}

.loading-hero :deep(.el-button.is-plain:hover) {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.16);
}

.loading-word-preview {
  position: relative;
  z-index: 1;
  flex: 1;
  max-width: 42%;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
  text-shadow: 0 4px 24px rgba(0, 0, 0, 0.24);
}

.loading-presets {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.loading-preset {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-bg-color);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}

.loading-preset:hover {
  transform: translateY(-1px);
  border-color: var(--preset-color);
  box-shadow: 0 8px 20px -14px var(--preset-color);
}

.loading-preset.active {
  border-color: var(--preset-color);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--preset-color) 22%, transparent);
}

.preset-swatch {
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28);
}

.preset-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.preset-copy strong {
  font-size: 11.5px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}

.preset-copy small {
  font-size: 9.5px;
  color: var(--el-text-color-placeholder);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.loading-card {
  padding: 16px 18px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 14px;
  background: var(--el-bg-color);
  box-shadow: 0 8px 24px -26px rgba(15, 23, 42, 0.54);
}

.loading-card h4 {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 14px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--el-text-color-secondary);
}

.loading-card h4::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-primary);
}

.loading-row {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  min-height: 34px;
}

.loading-row + .loading-row {
  margin-top: 10px;
}

.loading-label {
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.loading-row :deep(.el-input),
.loading-row :deep(.el-select),
.loading-row :deep(.el-input-number) {
  width: 100%;
}

.loading-inline {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.loading-inline code {
  min-width: 0;
  overflow-wrap: anywhere;
  font-family: var(--wr-mono);
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.loading-slider {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.loading-slider :deep(.el-slider) {
  flex: 1;
  min-width: 0;
}

.loading-slider strong {
  flex: none;
  width: 42px;
  text-align: right;
  font-family: var(--wr-mono);
  font-size: 11px;
  color: var(--el-text-color-primary);
}

.loading-actions {
  display: flex;
  gap: 8px;
}

@media (max-width: 760px) {
  .loading-presets {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .loading-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .loading-hero-copy,
  .loading-word-preview {
    max-width: 100%;
  }
}

.system-logo {
  background: var(--el-color-success);
}

.system-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
}

.system-row strong {
  display: block;
  font-size: 12px;
  color: var(--el-text-color-primary);
}

.system-row span {
  display: block;
  margin-top: 2px;
  font-size: 10.5px;
  color: var(--el-text-color-placeholder);
}

.brand-card {
  margin-top: 20px;
  padding: 16px 18px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 14px;
  background: var(--el-bg-color);
}

.brand-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.brand-logo {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex: none;
  overflow: hidden;
  border-radius: 12px;
  background: var(--el-color-primary);
  color: #fff;
  font-family: var(--wr-mono);
  font-size: 10px;
  font-weight: 700;
}

.brand-logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.brand-head strong {
  display: block;
  font-size: 12.5px;
  color: var(--el-text-color-primary);
}

.brand-head p {
  margin: 3px 0 0;
  font-size: 10.5px;
  color: var(--el-text-color-placeholder);
}

.brand-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

</style>
