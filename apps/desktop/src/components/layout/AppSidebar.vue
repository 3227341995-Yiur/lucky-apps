<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useReports } from '@/composables/useReports'
import { getIsoWeek } from '@/utils/date'
import { listNavItems } from '@/plugins/registry'
import { branding } from '@/composables/useBranding'
import ThemeToggle from '@/components/common/ThemeToggle.vue'

defineOptions({ name: 'AppSidebar' })

const props = defineProps({
  activePluginPage: { type: String, default: null },
})

const emit = defineEmits([
  'create', 'settings', 'templates', 'import-export', 'open-plugin-page',
  'open-welcome', 'open-reports',
])

const reports = useReports()
const { state } = reports
const keyword = ref('')
const pluginNavItems = computed(() => listNavItems())
const panelScrollRef = ref(null)

function reportStart(report) {
  return Array.isArray(report.dateRange) ? report.dateRange[0] || '' : String(report.dateRange || '')
}

function weekOf(report) {
  const start = reportStart(report)
  return start ? `W${String(getIsoWeek(new Date(start))).padStart(2, '0')}` : '—'
}

function displayTitle(report) {
  return String(report.title || '未命名周报')
    .replace(/\s*[-–—]\s*\d{4}-\d{2}-\d{2}\s*~\s*\d{4}-\d{2}-\d{2}$/, '')
}

function shortRange(report) {
  if (Array.isArray(report.dateRange) && report.dateRange.length === 2) {
    return `${report.dateRange[0].slice(5)} – ${report.dateRange[1].slice(5)}`
  }
  return String(report.dateRange || '未设置日期')
}

function monthLabel(key) {
  if (!/^\d{4}-\d{2}$/.test(key)) return '其他'
  const [year, month] = key.split('-')
  return `${year} 年 ${Number(month)} 月`
}

const groupedReports = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const filtered = state.reports.filter((report) => {
    if (!kw) return true
    return String(report.title || '').toLowerCase().includes(kw) ||
      shortRange(report).includes(kw) ||
      reportStart(report).includes(kw)
  })

  const groups = new Map()
  for (const report of filtered) {
    const start = reportStart(report)
    const key = start ? start.slice(0, 7) : 'other'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(report)
  }

  return [...groups.entries()].map(([key, list]) => ({
    key,
    label: monthLabel(key),
    reports: list,
  }))
})

async function handleSelect(id) {
  await reports.selectReport(id)
}

async function handleDelete(report) {
  try {
    await ElMessageBox.confirm(
      `确定把「${report.title}」移入回收站吗？`,
      '删除确认',
      {
        confirmButtonText: '移入回收站',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    await reports.deleteReport(report.id)
    ElMessage.success('已移入回收站')
  } catch {
    // 用户取消
  }
}

function handleScroll({ scrollTop }) {
  const wrap = panelScrollRef.value?.wrapRef
  if (!wrap || !state.hasMore || state.loading) return
  if (scrollTop + wrap.clientHeight >= wrap.scrollHeight - 60) {
    reports.loadReports(true)
  }
}

</script>

<template>
  <aside class="wr-nav">
    <nav class="nav-rail" aria-label="主导航">
      <div class="rail-brand" :title="branding.name">
        <img v-if="branding.icon" :src="branding.icon" alt="" />
        <span v-else>LA</span>
      </div>

      <el-tooltip content="新建周报（Ctrl N）" placement="right" :show-after="500">
        <button type="button" class="rail-create" aria-label="新建周报" @click="emit('create')">
          <el-icon :size="16"><Plus /></el-icon>
        </button>
      </el-tooltip>

      <div class="rail-items">
        <el-tooltip
          v-for="item in pluginNavItems"
          :key="item.id"
          :content="item.label"
          placement="right"
          :show-after="500"
        >
          <button
            type="button"
            class="rail-item"
            :title="item.label"
            :aria-label="item.label"
            :class="{ active: activePluginPage === item.id }"
            @click="emit('open-plugin-page', item)"
          >
            <component :is="item.iconComponent" v-if="item.iconComponent" />
            <span v-else-if="item.iconSvg" class="rail-custom-icon" v-html="item.iconSvg"></span>
            <el-icon v-else :size="18"><component :is="item.icon || 'Grid'" /></el-icon>
          </button>
        </el-tooltip>
      </div>

      <div class="rail-bottom">
        <ThemeToggle />
        <el-tooltip content="设置与扩展" placement="right" :show-after="500">
          <button type="button" class="rail-item" title="设置" aria-label="设置" @click="emit('settings')">
            <el-icon :size="17"><Setting /></el-icon>
          </button>
        </el-tooltip>
      </div>
    </nav>

    <div class="nav-panel">
      <header class="panel-head">
        <div class="panel-title">
          <span>周报</span>
          <span class="panel-count">{{ state.stats.reports }}</span>
        </div>
        <div class="panel-actions">
          <el-tooltip content="导出模板" placement="bottom" :show-after="500">
            <button type="button" title="模板" @click="emit('templates')">
              <el-icon :size="14"><DocumentCopy /></el-icon>
            </button>
          </el-tooltip>
          <el-tooltip content="导入 / 导出" placement="bottom" :show-after="500">
            <button type="button" title="导入导出" @click="emit('import-export')">
              <el-icon :size="14"><Sort /></el-icon>
            </button>
          </el-tooltip>
        </div>
      </header>

      <div class="panel-search">
        <el-input v-model="keyword" size="small" clearable placeholder="搜索周报标题 / 日期">
          <template #prefix><el-icon :size="11"><Search /></el-icon></template>
        </el-input>
      </div>

      <el-scrollbar ref="panelScrollRef" class="panel-list" @scroll="handleScroll">
        <div class="panel-list-inner">
        <section v-for="group in groupedReports" :key="group.key" class="report-group">
          <div class="group-label">
            <span>{{ group.label }}</span>
            <span>{{ group.reports.length }}</span>
          </div>

          <div
            v-for="report in group.reports"
            :key="report.id"
            class="report-row"
            :class="{ active: state.view === 'reports' && state.currentId === report.id }"
            role="button"
            tabindex="0"
            @click="handleSelect(report.id)"
            @keydown.enter.prevent="handleSelect(report.id)"
            @keydown.space.prevent="handleSelect(report.id)"
          >
            <span class="report-week">{{ weekOf(report) }}</span>
            <span class="report-copy">
              <span class="report-title">{{ displayTitle(report) }}</span>
              <span class="report-range">{{ shortRange(report) }}</span>
            </span>
            <button
              type="button"
              class="report-delete"
              title="移入回收站"
              aria-label="移入回收站"
              @click.stop="handleDelete(report)"
            >
              <el-icon :size="12"><Delete /></el-icon>
            </button>
          </div>
        </section>

        <div v-if="keyword && groupedReports.length === 0" class="panel-empty">
          <p>没有匹配的周报</p>
        </div>

        <div v-if="state.loading" class="panel-hint">
          <el-icon class="is-loading" :size="12"><Loading /></el-icon>
          <span>加载中</span>
        </div>
        <button v-else-if="state.hasMore" type="button" class="panel-more" @click="reports.loadReports(true)">
          加载更多
        </button>
        <div v-else-if="state.reports.length === 0 && !keyword" class="panel-empty">
          <el-icon :size="20"><DocumentAdd /></el-icon>
          <p>还没有周报</p>
          <button type="button" @click="emit('create')">新建第一份</button>
        </div>
        <div v-else-if="state.reports.length > 0 && !keyword" class="panel-hint muted">没有更多了</div>
        </div>
      </el-scrollbar>

      <footer class="panel-foot">
        <span class="foot-state"><i /> 本地 SQLite</span>
        <span class="foot-count">{{ state.reports.length }} / {{ state.stats.reports }}</span>
      </footer>
    </div>
  </aside>
</template>

<style scoped>
.wr-nav {
  display: flex;
  height: 100%;
  flex-shrink: 0;
}

.nav-rail {
  width: 52px;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 0 8px;
  background: var(--wr-sidebar-bg);
  border-right: 1px solid var(--wr-border);
}

.rail-custom-icon {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
}

.rail-custom-icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.rail-brand img {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  object-fit: cover;
}

.rail-brand {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin-bottom: 10px;
  border-radius: 6px;
  background: var(--el-color-primary);
  color: #fff;
  font-family: var(--wr-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: -0.04em;
  user-select: none;
}

.rail-create {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  margin-bottom: 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 7px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.rail-create:hover {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.rail-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rail-item {
  position: relative;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.rail-item:hover {
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
}

.rail-item.active {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.rail-item.active::before {
  content: '';
  position: absolute;
  left: -9px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  border-radius: 2px;
  background: var(--el-color-primary);
}

.rail-bottom {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding-top: 8px;
  border-top: 1px solid var(--wr-border);
}

.rail-bottom :deep(.theme-toggle) {
  color: var(--el-text-color-secondary);
}

.rail-bottom :deep(.theme-toggle:hover) {
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
}

.nav-panel {
  width: 268px;
  flex: none;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border-right: 1px solid var(--wr-border);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 46px;
  flex: none;
  padding: 0 10px 0 16px;
  border-bottom: 1px solid var(--wr-border);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 7px;
}

.panel-title > span:first-child {
  font-size: 13px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}

.panel-count {
  font-family: var(--wr-mono);
  font-size: 9.5px;
  color: var(--el-text-color-placeholder);
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 1px;
}

.panel-actions button {
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.panel-actions button:hover {
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
}

.panel-search {
  flex: none;
  padding: 6px 10px 8px;
}

.panel-list {
  flex: 1;
  min-height: 0;
}

.panel-list-inner {
  padding: 0 7px 8px;
}

.report-group {
  margin-bottom: 6px;
}

.group-label {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 8px 5px;
  background: var(--el-bg-color);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.06em;
  color: var(--el-text-color-secondary);
}

.group-label span:last-child {
  font-family: var(--wr-mono);
  font-weight: 400;
  color: var(--el-text-color-placeholder);
}

.report-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  padding: 6px 6px 6px 7px;
  margin-bottom: 2px;
  border-left: 2px solid transparent;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.report-row:hover {
  background: var(--el-fill-color-light);
}

.report-row.active {
  background: var(--wr-accent-soft);
  border-left-color: var(--el-color-primary);
}

html.dark .report-row.active {
  background: var(--el-color-primary-light-9);
}

.report-week {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-secondary);
  font-family: var(--wr-mono);
  font-size: 9px;
  letter-spacing: -0.02em;
}

.report-row.active .report-week {
  background: var(--el-bg-color);
  color: var(--el-color-primary);
}

.report-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.report-title {
  font-size: 12px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.report-range {
  font-family: var(--wr-mono);
  font-size: 9.5px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.report-delete {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-placeholder);
  opacity: 0;
  cursor: pointer;
  transition: opacity 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}

.report-row:hover .report-delete,
.report-row.active .report-delete {
  opacity: 1;
}

.report-delete:hover {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

.panel-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 10px;
  font-size: 10.5px;
  color: var(--el-text-color-secondary);
}

.panel-hint.muted {
  opacity: 0.6;
}

.panel-more {
  display: block;
  width: 100%;
  padding: 8px;
  border: 0;
  background: transparent;
  color: var(--el-color-primary);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
}

.panel-more:hover {
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 28px 14px;
  color: var(--el-text-color-secondary);
}

.panel-empty p {
  margin: 0;
  font-size: 11.5px;
}

.panel-empty button {
  border: 0;
  background: transparent;
  color: var(--el-color-primary);
  font-family: inherit;
  font-size: 11.5px;
  cursor: pointer;
}

.panel-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 34px;
  flex: none;
  padding: 0 12px;
  border-top: 1px solid var(--wr-border);
  font-family: var(--wr-mono);
  font-size: 8.5px;
  color: var(--el-text-color-placeholder);
}

.foot-state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.foot-state i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--el-color-success);
}
</style>
