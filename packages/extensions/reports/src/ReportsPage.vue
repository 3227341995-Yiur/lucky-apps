<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useWeekReport } from 'plugin-api'
import { formatDateTime, getIsoWeek } from './utils-date'
import { createWeekReport } from './createReport'

defineOptions({ name: 'ReportsPage' })

const api = useWeekReport()
const reports = ref([])
const loading = ref(false)
const keyword = ref('')
let off = null

const filtered = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text) return reports.value
  return reports.value.filter(report => (
    String(report.title || '').toLowerCase().includes(text)
    || (Array.isArray(report.dateRange) && report.dateRange.join(' ').includes(text))
  ))
})

function weekOf(report) {
  const start = Array.isArray(report.dateRange) ? report.dateRange[0] : ''
  if (!start) return '—'
  const week = getIsoWeek(new Date(start))
  return week ? `W${String(week).padStart(2, '0')}` : '—'
}

function rangeText(report) {
  return Array.isArray(report.dateRange) && report.dateRange.length === 2
    ? report.dateRange.join(' ~ ')
    : '未设置日期'
}

async function loadReports() {
  loading.value = true
  try {
    reports.value = await api.reports.list({ limit: 500, offset: 0 })
  } catch (error) {
    ElMessage.error(`加载周报失败：${error?.message || error}`)
  } finally {
    loading.value = false
  }
}

function createReport() {
  createWeekReport()
}

function openReport(report) {
  api.ui.selectReport(report.id)
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
  loadReports()
  off = api.events.on('report:changed', loadReports)
})

onBeforeUnmount(() => off?.())
</script>

<template>
  <el-scrollbar class="wr-page reports-view">
    <div class="wr-page-inner reports-inner">
      <header class="reports-header">
        <div class="header-main">
          <div class="wr-eyebrow">Reports</div>
          <div class="title-row">
            <h1 class="wr-page-title">周报</h1>
            <span class="wr-chip">{{ reports.length }} 份</span>
          </div>
          <p class="wr-page-subtitle">查看历史周报，或按本周日期新建一份。</p>
        </div>

        <div class="header-actions">
          <el-button type="primary" @click="createReport">
            <el-icon><Plus /></el-icon>
            <span>新建周报</span>
          </el-button>
        </div>
      </header>

      <div class="reports-toolbar">
        <div class="toolbar-search">
          <el-icon><Search /></el-icon>
          <input v-model="keyword" placeholder="搜索标题 / 日期" spellcheck="false" />
        </div>
      </div>

      <div v-loading="loading" element-loading-text="加载中…" class="reports-body">
        <div v-if="!loading && filtered.length === 0" class="reports-empty">
          <span class="empty-icon"><el-icon :size="24"><DocumentAdd /></el-icon></span>
          <h3>{{ reports.length ? '没有匹配的周报' : '还没有周报' }}</h3>
          <p>{{ reports.length ? '换个关键词试试。' : '创建第一份周报，开始记录这一周。' }}</p>
          <el-button v-if="!reports.length" type="primary" plain @click="createReport">新建周报</el-button>
        </div>

        <div v-else class="report-list">
          <article
            v-for="report in filtered"
            :key="report.id"
            class="report-card"
            role="button"
            tabindex="0"
            @click="openReport(report)"
            @keydown.enter.prevent="openReport(report)"
          >
            <span class="report-week">{{ weekOf(report) }}</span>

            <div class="row-main">
              <h3 class="row-title">{{ report.title || '未命名周报' }}</h3>
              <div class="row-meta">
                <span class="meta-item">
                  <el-icon><Calendar /></el-icon>
                  {{ rangeText(report) }}
                </span>
                <span class="meta-item">
                  <el-icon><Clock /></el-icon>
                  更新于 {{ formatDateTime(report.updated_at) }}
                </span>
              </div>
            </div>

            <div class="row-actions" @click.stop>
              <el-button type="primary" plain size="small" @click="openReport(report)">
                <el-icon><View /></el-icon>
                <span>查看</span>
              </el-button>
              <el-button type="danger" text size="small" @click="removeReport(report)">
                <el-icon><Delete /></el-icon>
                <span>删除</span>
              </el-button>
            </div>
          </article>
        </div>
      </div>
    </div>
  </el-scrollbar>
</template>

<style scoped>
.reports-view {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.reports-inner {
  max-width: 1080px;
}

.reports-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}

.header-main {
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.reports-view :deep(.el-button + .el-button) {
  margin-left: 0;
}

.reports-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.toolbar-search {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  max-width: 320px;
  padding: 7px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-placeholder);
}

.toolbar-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--el-text-color-primary);
  font: inherit;
  font-size: 12px;
}

.reports-body {
  min-height: 280px;
}

.reports-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  border: 1px dashed var(--el-border-color);
  border-radius: 16px;
  background: var(--el-fill-color-lighter);
  text-align: center;
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  margin-bottom: 12px;
  border-radius: 50%;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.reports-empty h3 {
  margin: 0 0 5px;
  font-size: 15px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}

.reports-empty p {
  margin: 0 0 16px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.report-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.report-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 18px;
  background:
    radial-gradient(circle at 100% 0%, var(--el-color-primary-light-9), transparent 40%),
    var(--el-bg-color);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.report-card:hover {
  border-color: var(--el-color-primary-light-7);
  box-shadow: 0 12px 26px -20px rgba(15, 23, 42, 0.4);
  transform: translateY(-1px);
}

.report-week {
  display: grid;
  place-items: center;
  width: 40px;
  height: 36px;
  flex: none;
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-secondary);
  font-family: var(--wr-mono);
  font-size: 11px;
  font-weight: 600;
}

.report-card:hover .report-week {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.row-main {
  flex: 1;
  min-width: 0;
}

.row-title {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 4px;
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

@media (max-width: 720px) {
  .reports-header {
    flex-direction: column;
    align-items: stretch;
  }

  .report-card {
    flex-wrap: wrap;
  }

  .row-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
