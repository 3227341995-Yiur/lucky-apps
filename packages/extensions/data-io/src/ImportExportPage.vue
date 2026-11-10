<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useWeekReport } from 'plugin-api'
import { parseImportFile } from './utils/importParsing'
import { exportReports, formatDateRange } from './utils/reportExport'
import { rangesOverlap } from './utils/date'

defineOptions({ name: 'ImportExportPage' })

const api = useWeekReport()

const formats = [
  { value: 'html', label: 'HTML', hint: '带样式的网页', icon: 'Document' },
  { value: 'markdown', label: 'Markdown', hint: '纯文本 / 笔记', icon: 'EditPen' },
  { value: 'json', label: 'JSON', hint: '结构化数据', icon: 'Tickets' },
  { value: 'backup', label: '全量备份', hint: '全部数据', icon: 'FolderOpened' },
]

// ============================================================
// 导出
// ============================================================
const exportFormat = ref('html')
const reports = ref([])
const reportsLoading = ref(false)
const reportsLoaded = ref(false)
const loadError = ref('')
const selectedIds = ref([])
const rangeFilter = ref([])
const exporting = ref(false)
const exportError = ref('')
const progress = ref({ done: 0, total: 0 })

const busy = computed(() => exporting.value || importing.value || importParsing.value)

const reportsAvailable = computed(() => reports.value.length > 0)

const canExport = computed(() => {
  if (busy.value || reportsLoading.value || !reportsAvailable.value) return false
  if (exportFormat.value === 'backup') return true
  return selectedIds.value.length > 0
})

const exportActionText = computed(() => {
  if (exportFormat.value === 'backup') return '生成备份文件'
  const count = selectedIds.value.length
  return count > 0 ? `导出 ${count} 份` : '导出'
})

const progressPercent = computed(() => {
  const { done, total } = progress.value
  return total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
})

const allChecked = computed({
  get: () => reports.value.length > 0 && selectedIds.value.length === reports.value.length,
  set: (value) => {
    selectedIds.value = value ? reports.value.map(report => report.id) : []
  },
})

const indeterminate = computed(() => {
  const count = selectedIds.value.length
  return count > 0 && count < reports.value.length
})

function isChecked(id) {
  return selectedIds.value.includes(id)
}

function toggleReport(report) {
  const index = selectedIds.value.indexOf(report.id)
  if (index === -1) selectedIds.value.push(report.id)
  else selectedIds.value.splice(index, 1)
}

function clearSelection() {
  selectedIds.value = []
}

function reportRange(report) {
  if (Array.isArray(report.dateRange) && report.dateRange.length === 2) {
    return report.dateRange
  }
  return [report.dateRange, report.dateRange]
}

function onRangeChange(value) {
  if (!Array.isArray(value) || value.length !== 2 || !value[0] || !value[1]) return
  const [start, end] = value
  selectedIds.value = reports.value
    .filter(report => rangesOverlap(reportRange(report), [start, end]))
    .map(report => report.id)

  if (selectedIds.value.length === 0) {
    ElMessage.info('该日期区间内没有周报')
  } else {
    ElMessage.success(`已选中区间内 ${selectedIds.value.length} 份周报`)
  }
}

async function loadReports(force = false) {
  if (reportsLoading.value) return
  if (reportsLoaded.value && !force) return

  reportsLoading.value = true
  loadError.value = ''
  try {
    reports.value = await api.reports.search()
    reportsLoaded.value = true

    const available = new Set(reports.value.map(report => report.id))
    selectedIds.value = selectedIds.value.filter(id => available.has(id))
  } catch (error) {
    loadError.value = error?.message || '加载周报列表失败'
  } finally {
    reportsLoading.value = false
  }
}

async function handleExport() {
  if (!canExport.value) return

  exporting.value = true
  exportError.value = ''
  progress.value = { done: 0, total: 0 }

  try {
    if (exportFormat.value === 'backup') {
      await api.data.exportBackup()
      ElMessage.success('备份文件已导出')
      return
    }

    const selected = reports.value.filter(report => selectedIds.value.includes(report.id))
    const { ok, fail } = await exportReports(api, selected, exportFormat.value, {
      onProgress: (done, total) => {
        progress.value = { done, total }
      },
    })

    if (fail === 0) {
      ElMessage.success(`已导出 ${ok} 份周报`)
    } else {
      ElMessage.warning(`成功 ${ok} 份，失败 ${fail} 份`)
    }
  } catch (error) {
    exportError.value = error?.message || '导出失败'
    ElMessage.error(exportError.value)
  } finally {
    exporting.value = false
    progress.value = { done: 0, total: 0 }
  }
}

// ============================================================
// 导入
// ============================================================
const fileInput = ref(null)
const currentFileName = ref('')
const dragActive = ref(false)
const importParsing = ref(false)
const importing = ref(false)
const importParsed = ref(null)
const importError = ref('')
const importResult = ref(null)
const importReportsEnabled = ref(true)
const importTemplatesEnabled = ref(true)
const importConfigEnabled = ref(false)

const canImport = computed(() => {
  if (!importParsed.value || busy.value) return false
  return importReportsEnabled.value || importTemplatesEnabled.value || importConfigEnabled.value
})

function resetImport() {
  currentFileName.value = ''
  dragActive.value = false
  importParsing.value = false
  importing.value = false
  importParsed.value = null
  importError.value = ''
  importResult.value = null
  importReportsEnabled.value = true
  importTemplatesEnabled.value = true
  importConfigEnabled.value = false
  if (fileInput.value) fileInput.value.value = ''
}

function pickFile() {
  if (importing.value || importParsing.value) return
  fileInput.value?.click()
}

function onFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file) handleFile(file)
}

function onDrop(event) {
  dragActive.value = false
  if (importing.value || importParsing.value) return
  const file = event.dataTransfer?.files?.[0]
  if (file) handleFile(file)
}

async function handleFile(file) {
  if (importing.value || importParsing.value) return

  currentFileName.value = file.name || '未命名文件'
  importParsing.value = true
  importError.value = ''
  importParsed.value = null
  importResult.value = null

  try {
    const parsed = await parseImportFile(file)
    importParsed.value = parsed
    importReportsEnabled.value = parsed.summary.reports > 0
    importTemplatesEnabled.value = parsed.summary.templates > 0
    importConfigEnabled.value = false
  } catch (error) {
    importError.value = error?.message || '文件解析失败'
    ElMessage.error(importError.value)
  } finally {
    importParsing.value = false
  }
}

async function handleImport() {
  if (!canImport.value) return

  if (importParsed.value.kind === 'backup' && importConfigEnabled.value) {
    try {
      await ElMessageBox.confirm(
        '导入默认结构会覆盖当前的默认周报结构，已有周报内容不会受影响。确定继续吗？',
        '覆盖默认结构',
        { confirmButtonText: '继续导入', cancelButtonText: '取消', type: 'warning' },
      )
    } catch {
      return
    }
  }

  importing.value = true
  importError.value = ''
  try {
    const isBackup = importParsed.value.kind === 'backup'
    const result = await api.data.importBackup(importParsed.value, {
      importReports: importReportsEnabled.value,
      importTemplates: isBackup && importTemplatesEnabled.value,
      importConfig: isBackup && importConfigEnabled.value,
    })

    importResult.value = result
    if (result.reports > 0) {
      reportsLoaded.value = false
      await loadReports(true)
    }
  } catch (error) {
    importError.value = error?.message || '导入失败'
    ElMessage.error(importError.value)
  } finally {
    importing.value = false
  }
}

// ============================================================
// 生命周期
// ============================================================
let off = null

onMounted(() => {
  loadReports()
  off = api.events.on('report:changed', () => {
    reportsLoaded.value = false
    loadReports()
  })
})

onBeforeUnmount(() => off?.())
</script>

<template>
  <el-scrollbar class="wr-page data-io-view">
    <div class="wr-page-inner data-io-inner">
      <header class="data-io-header">
        <div class="header-main">
          <div class="wr-eyebrow">Data I/O</div>
          <div class="title-row">
            <h1 class="wr-page-title">导入导出</h1>
            <span class="wr-chip">{{ reports.length }} 份周报</span>
          </div>
          <p class="wr-page-subtitle">导出单份或批量周报，也可以备份和恢复完整数据。</p>
        </div>

        <div class="header-actions">
          <el-button text @click="api.navigation.open('reports')">
            <el-icon><ArrowLeft /></el-icon>
            <span>返回周报</span>
          </el-button>
        </div>
      </header>

      <!-- 导出 -->
      <section class="wr-card io-card">
        <div class="io-card-head">
          <div class="io-card-title">
            <span class="io-card-icon"><el-icon :size="18"><Download /></el-icon></span>
            <div class="io-card-copy">
              <h2>导出</h2>
              <p>选择格式与周报，导出为文件或全量备份。</p>
            </div>
          </div>
          <el-button
            type="primary"
            :loading="exporting"
            :disabled="!canExport"
            @click="handleExport"
          >
            <el-icon v-if="!exporting"><Download /></el-icon>
            <span>{{ exportActionText }}</span>
          </el-button>
        </div>

        <div class="io-card-body">
          <div class="io-label">导出格式</div>
          <div class="format-grid">
            <button
              v-for="format in formats"
              :key="format.value"
              type="button"
              class="format-card"
              :class="{ active: exportFormat === format.value }"
              :disabled="exporting"
              @click="exportFormat = format.value"
            >
              <span class="format-icon"><el-icon :size="15"><component :is="format.icon" /></el-icon></span>
              <span class="format-copy">
                <strong>{{ format.label }}</strong>
                <small>{{ format.hint }}</small>
              </span>
            </button>
          </div>

          <el-alert
            v-if="exportFormat === 'backup'"
            class="io-alert"
            type="info"
            :closable="false"
            show-icon
          >
            <template #title>备份内容</template>
            全部周报（含回收站）、自定义模板与当前默认结构会保存为一个 JSON 文件。导入备份时不会覆盖现有周报。
          </el-alert>

          <template v-else>
            <div class="io-label io-label-spaced">选择周报</div>
            <div class="list-toolbar">
              <el-date-picker
                v-model="rangeFilter"
                type="daterange"
                value-format="YYYY-MM-DD"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                :clearable="true"
                :disabled="exporting"
                @change="onRangeChange"
              />
              <span class="field-hint inline">按日期区间快速勾选（区间重叠即选中）</span>
            </div>

            <div class="select-bar">
              <el-checkbox
                v-model="allChecked"
                :indeterminate="indeterminate"
                :disabled="reports.length === 0 || exporting"
              >全选</el-checkbox>
              <span class="select-count">已选 <b>{{ selectedIds.length }}</b> / {{ reports.length }}</span>
              <el-button
                v-if="selectedIds.length > 0"
                link
                type="primary"
                size="small"
                :disabled="exporting"
                @click="clearSelection"
              >清空</el-button>
            </div>

            <div v-if="reportsLoading" class="list-state">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>加载中…</span>
            </div>
            <el-alert
              v-else-if="loadError"
              class="io-alert"
              type="error"
              :closable="false"
              :title="loadError"
              show-icon
            />
            <div v-else-if="reports.length === 0" class="list-state">暂无可导出的周报</div>
            <el-scrollbar v-else max-height="280px">
              <div class="report-list">
                <div
                  v-for="report in reports"
                  :key="report.id"
                  class="report-row"
                  :class="{ checked: isChecked(report.id), disabled: exporting }"
                  @click="exporting || toggleReport(report)"
                >
                  <el-checkbox
                    class="row-check"
                    :model-value="isChecked(report.id)"
                    :disabled="exporting"
                  />
                  <span class="row-date">{{ formatDateRange(report.dateRange) }}</span>
                  <span class="row-title">{{ report.title }}</span>
                </div>
              </div>
            </el-scrollbar>
          </template>

          <el-alert
            v-if="exportError"
            class="io-alert io-alert-top"
            type="error"
            :closable="false"
            :title="exportError"
            show-icon
          />

          <div v-if="exporting" class="progress-box">
            <div class="progress-head">
              <span>{{ progress.total > 1 ? `正在导出 ${progress.done}/${progress.total}…` : '正在导出…' }}</span>
              <span>{{ progressPercent }}%</span>
            </div>
            <el-progress :percentage="progressPercent" :show-text="false" :stroke-width="6" />
          </div>
        </div>
      </section>

      <!-- 导入 -->
      <section class="wr-card io-card">
        <div class="io-card-head">
          <div class="io-card-title">
            <span class="io-card-icon"><el-icon :size="18"><Upload /></el-icon></span>
            <div class="io-card-copy">
              <h2>导入</h2>
              <p>恢复备份、单份周报 JSON 或周报数组 JSON。</p>
            </div>
          </div>
          <el-button
            v-if="!importResult"
            type="primary"
            :loading="importing"
            :disabled="!canImport"
            @click="handleImport"
          >
            <el-icon v-if="!importing"><Upload /></el-icon>
            <span>开始导入</span>
          </el-button>
        </div>

        <div class="io-card-body">
          <template v-if="!importResult">
            <div
              class="dropzone"
              :class="{ active: dragActive, disabled: importing || importParsing }"
              role="button"
              tabindex="0"
              aria-label="选择或拖拽 JSON 文件"
              @click="pickFile"
              @keydown.enter.prevent="pickFile"
              @keydown.space.prevent="pickFile"
              @dragover.prevent="dragActive = true"
              @dragleave.prevent="dragActive = false"
              @drop.prevent="onDrop"
            >
              <el-icon :size="30"><UploadFilled /></el-icon>
              <p class="dz-title">{{ currentFileName || '点击选择或拖拽 JSON 文件到这里' }}</p>
              <p class="dz-hint">
                {{ importParsing ? '正在解析文件…' : '支持全量备份、单份周报 JSON 或周报数组 JSON' }}
              </p>
            </div>
            <input
              ref="fileInput"
              class="file-input"
              type="file"
              accept=".json,application/json"
              @change="onFileChange"
            />

            <el-alert
              v-if="importError"
              class="io-alert io-alert-top"
              type="error"
              :closable="false"
              :title="importError"
              show-icon
            />

            <template v-if="importParsed">
              <div class="summary-head">
                <el-tag :type="importParsed.kind === 'backup' ? 'warning' : 'info'" effect="light">
                  {{ importParsed.kind === 'backup' ? '全量备份' : '周报文件' }}
                </el-tag>
                <span class="summary-file">{{ currentFileName }}</span>
              </div>
              <div class="summary-grid">
                <div class="summary-item">
                  <span class="summary-value">{{ importParsed.summary.reports }}</span>
                  <span class="summary-label">份周报</span>
                </div>
                <div v-if="importParsed.kind === 'backup'" class="summary-item">
                  <span class="summary-value">{{ importParsed.summary.templates }}</span>
                  <span class="summary-label">个自定义模板</span>
                </div>
                <div v-if="importParsed.kind === 'backup'" class="summary-item">
                  <span class="summary-value">{{ importParsed.summary.hasConfig ? '包含' : '未包含' }}</span>
                  <span class="summary-label">默认结构</span>
                </div>
              </div>

              <div class="io-label io-label-spaced">导入内容</div>
              <div class="option-list">
                <el-checkbox
                  v-model="importReportsEnabled"
                  :disabled="!importParsed.summary.reports"
                >
                  导入周报
                  <span class="option-hint">生成新 ID，不覆盖现有周报；回收站状态会保留</span>
                </el-checkbox>
                <el-checkbox
                  v-if="importParsed.kind === 'backup'"
                  v-model="importTemplatesEnabled"
                  :disabled="!importParsed.summary.templates"
                >
                  导入模板
                  <span class="option-hint">仅导入自定义模板，重名时自动追加“（导入）”</span>
                </el-checkbox>
                <el-checkbox
                  v-if="importParsed.kind === 'backup'"
                  v-model="importConfigEnabled"
                  :disabled="!importParsed.summary.hasConfig"
                >
                  导入默认结构
                  <span class="option-hint">将覆盖当前的默认周报结构</span>
                </el-checkbox>
              </div>
            </template>
          </template>

          <div v-else class="import-result">
            <span class="result-icon">
              <el-icon :size="34"><CircleCheckFilled /></el-icon>
            </span>
            <h4>导入完成</h4>
            <p class="result-text">
              已导入 {{ importResult.reports }} 份周报<template v-if="importParsed?.kind === 'backup'">、{{ importResult.templates }} 个模板</template><template v-if="importResult.config">，并更新了默认结构</template>
            </p>
            <el-button link type="primary" :disabled="importing || importParsing" @click="resetImport">继续导入</el-button>
          </div>
        </div>
      </section>
    </div>
  </el-scrollbar>
</template>

<style scoped>
.data-io-view {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.data-io-inner {
  max-width: 1080px;
}

.data-io-header {
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

.data-io-view :deep(.el-button + .el-button) {
  margin-left: 0;
}

.io-card {
  padding: 16px 18px 18px;
}

.io-card + .io-card {
  margin-top: 16px;
}

.io-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.io-card-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.io-card-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: none;
  border-radius: 9px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.io-card-copy {
  min-width: 0;
}

.io-card-copy h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}

.io-card-copy p {
  margin: 2px 0 0;
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
}

.io-card-body {
  padding-top: 14px;
}

.io-label {
  margin-bottom: 8px;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--el-text-color-secondary);
}

.io-label-spaced {
  margin-top: 16px;
}

.format-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.format-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.format-card:hover {
  border-color: var(--el-border-color);
  background: var(--el-fill-color-lighter);
}

.format-card.active {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}

.format-card:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.format-icon {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}

.format-card.active .format-icon {
  background: var(--el-color-primary);
  color: #fff;
}

.format-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.format-copy strong {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.format-copy small {
  font-size: 10px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.io-alert {
  margin-top: 12px;
}

.io-alert-top {
  margin-top: 14px;
}

.field-hint {
  margin: 7px 0 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.field-hint.inline {
  margin: 0;
}

.list-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 14px;
}

.select-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 0 6px;
}

.select-count {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.select-count b {
  font-size: 14px;
  color: var(--el-color-primary);
}

.report-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 2px 6px 2px 2px;
}

.report-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--wr-radius-sm);
  background: var(--el-bg-color);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.report-row:hover {
  border-color: var(--el-border-color);
  background: var(--el-fill-color-lighter);
}

.report-row.checked {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.report-row.disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.row-check {
  flex-shrink: 0;
  height: auto;
  line-height: 1;
  margin: 0;
  align-items: center;
}

.row-check :deep(.el-checkbox__label) {
  display: none;
}

.row-date {
  flex-shrink: 0;
  min-width: 160px;
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.row-title {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 36px 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.progress-box {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: var(--wr-radius-md);
  background: var(--el-fill-color-lighter);
}

.progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 导入 */
.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 2px;
  padding: 22px 18px;
  text-align: center;
  border: 1px dashed var(--el-border-color);
  border-radius: var(--wr-radius-md);
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.dropzone:hover,
.dropzone.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.dropzone:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.dropzone.disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.dropzone .el-icon {
  color: var(--el-color-primary);
}

.dz-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.dz-hint {
  margin: 0;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.file-input {
  display: none;
}

.summary-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}

.summary-file {
  min-width: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.summary-item {
  flex: 1;
  min-width: 120px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--wr-radius-md);
  background: var(--el-fill-color-lighter);
}

.summary-value {
  font-size: 16px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}

.summary-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.option-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-hint {
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.import-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36px 20px;
  text-align: center;
}

.result-icon {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  margin-bottom: 12px;
  border-radius: 50%;
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.import-result h4 {
  margin: 0 0 6px;
  font-size: 16px;
  color: var(--el-text-color-primary);
}

.result-text {
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}

@media (max-width: 720px) {
  .data-io-header {
    flex-direction: column;
    align-items: stretch;
  }

  .format-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .row-date {
    min-width: 0;
  }
}
</style>
