<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useWeekReport } from 'plugin-api'
import { getIsoWeek } from './utils-date'
import { createWeekReport } from './createReport'
import { openReportsDialog } from './dialogs'

defineOptions({ name: 'ReportsSidebar' })

const api = useWeekReport()
const keywords = ref('')
const reports = ref([])
const loading = ref(false)
let off = null

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
  const keyword = keywords.value.trim().toLowerCase()
  const filtered = reports.value.filter((report) => {
    if (!keyword) return true
    return String(report.title || '').toLowerCase().includes(keyword)
      || shortRange(report).includes(keyword)
      || reportStart(report).includes(keyword)
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

async function load() {
  loading.value = true
  try {
    reports.value = await api.reports.list({ limit: 500, offset: 0 })
  } catch (error) {
    ElMessage.error(`加载周报失败：${error?.message || error}`)
  } finally {
    loading.value = false
  }
}

function selectReport(report) {
  api.ui.selectReport(report.id)
}

// 只在报表视图可见时高亮当前报表；切到其他功能页后取消选中
function isActive(report) {
  return api.ui.isReportsVisible() && api.ui.currentReportId() === report.id
}

async function removeReport(report) {
  try {
    await ElMessageBox.confirm(
      `确定把「${report.title}」移入回收站吗？`,
      '删除确认',
      { confirmButtonText: '移入回收站', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await api.reports.remove(report.id)
    ElMessage.success('已移入回收站')
  } catch (error) {
    ElMessage.error(`删除失败：${error?.message || error}`)
  }
}

onMounted(() => {
  load()
  off = api.events.on('report:changed', load)
})

onBeforeUnmount(() => off?.())
</script>

<template>
  <div class="reports-panel">
    <header class="panel-head">
      <div class="panel-title">
        <span>周报</span>
        <span class="panel-count">{{ reports.length }}</span>
      </div>
      <div class="panel-actions">
        <el-tooltip content="模板设计" placement="bottom" :show-after="500">
          <button type="button" title="模板设计" aria-label="模板设计" @click="openReportsDialog('template')">
            <el-icon :size="14"><DocumentCopy /></el-icon>
          </button>
        </el-tooltip>
        <el-tooltip content="导入 / 导出" placement="bottom" :show-after="500">
          <button type="button" title="导入导出" aria-label="导入导出" @click="openReportsDialog('io')">
            <el-icon :size="14"><Sort /></el-icon>
          </button>
        </el-tooltip>
      </div>
    </header>

    <div class="panel-search">
      <el-input v-model="keywords" size="small" clearable placeholder="搜索周报标题 / 日期">
        <template #prefix><el-icon :size="11"><Search /></el-icon></template>
      </el-input>
    </div>

    <el-scrollbar class="panel-list">
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
            :class="{ active: isActive(report) }"
            role="button"
            tabindex="0"
            @click="selectReport(report)"
            @keydown.enter.prevent="selectReport(report)"
            @keydown.space.prevent="selectReport(report)"
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
              @click.stop="removeReport(report)"
            >
              <el-icon :size="12"><Delete /></el-icon>
            </button>
          </div>
        </section>

        <div v-if="keywords && groupedReports.length === 0" class="panel-empty">
          <p>没有匹配的周报</p>
        </div>
        <div v-if="loading" class="panel-hint">
          <el-icon class="is-loading" :size="12"><Loading /></el-icon>
          <span>加载中</span>
        </div>
        <div v-else-if="reports.length === 0 && !keywords" class="panel-empty">
          <el-icon :size="20"><DocumentAdd /></el-icon>
          <p>还没有周报</p>
          <button type="button" @click="createWeekReport()">新建第一份</button>
        </div>
      </div>
    </el-scrollbar>

    <footer class="panel-foot">
      <span class="foot-state"><i /> 本地 SQLite</span>
      <span class="foot-count">{{ reports.length }}</span>
    </footer>
  </div>
</template>

<style scoped>
.reports-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 4px 10px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}

.panel-count {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--el-fill-color-light);
  font-family: var(--wr-mono);
  font-size: 9.5px;
  font-weight: 500;
  line-height: 16px;
  text-align: center;
  color: var(--el-text-color-secondary);
}

.panel-actions {
  display: flex;
  gap: 2px;
}

.panel-actions button {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.panel-actions button:hover {
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
}

.panel-search {
  padding: 0 4px 8px;
}

.panel-list {
  flex: 1;
  min-height: 0;
}

.panel-list-inner {
  padding: 0 2px 8px;
}

.report-group + .report-group {
  margin-top: 10px;
}

.group-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px;
  font-size: 9.5px;
  letter-spacing: 0.05em;
  color: var(--el-text-color-placeholder);
}

.report-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.15s;
}

.report-row:hover {
  background: var(--el-fill-color-lighter);
}

.report-row.active {
  background: var(--el-color-primary-light-9);
}

.report-week {
  display: grid;
  place-items: center;
  width: 30px;
  height: 26px;
  flex: none;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-secondary);
  font-family: var(--wr-mono);
  font-size: 9px;
  font-weight: 600;
}

.report-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.report-title {
  overflow: hidden;
  color: var(--el-text-color-primary);
  font-size: 11.5px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-range {
  color: var(--el-text-color-placeholder);
  font-family: var(--wr-mono);
  font-size: 9px;
}

.report-delete {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex: none;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s, color 0.15s;
}

.report-row:hover .report-delete {
  opacity: 1;
}

.report-delete:hover {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 26px 10px;
  color: var(--el-text-color-placeholder);
  font-size: 11px;
  text-align: center;
}

.panel-empty p {
  margin: 0;
}

.panel-empty button {
  border: 0;
  background: transparent;
  color: var(--el-color-primary);
  font-size: 11px;
  cursor: pointer;
}

.panel-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 14px;
  font-size: 10.5px;
  color: var(--el-text-color-placeholder);
}

.panel-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 6px 2px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 9.5px;
  color: var(--el-text-color-placeholder);
}

.foot-state {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.foot-state i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--el-color-success);
}

.foot-count {
  font-family: var(--wr-mono);
}
</style>
