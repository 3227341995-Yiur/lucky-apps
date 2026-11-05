<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  exportBackupFile,
  exportReport,
  exportReports,
  importData,
  parseImportFile
} from '@/services/importExportService'
import { getTotalReportCount, loadAllReports } from '@/services/database'
import { formatDateRange } from '@/utils/reportExport'
import { rangesOverlap } from '@/utils/date'
import AppDialog from '@/components/common/AppDialog.vue'
import DateRangeField from '@/components/common/DateRangeField.vue'

defineOptions({ name: 'ImportExportDialog' })

const visible = defineModel({ type: Boolean, default: false })

const props = defineProps({
  currentReport: {
    type: Object,
    default: null
  },
  initialTab: {
    type: String,
    default: 'export'
  }
})

const emit = defineEmits(['imported'])

const activeTab = ref('export')

// ============================================================
// 导出
// ============================================================
const exportFormat = ref('html')
const scope = ref('all')
const reports = ref([])
const reportTotal = ref(0)
const reportsLoaded = ref(false)
const reportsLoading = ref(false)
const loadError = ref('')
const selectedIds = ref([])
const rangeFilter = ref([])
const exporting = ref(false)
const exportError = ref('')
const progress = ref({ done: 0, total: 0 })

const reportsAvailable = computed(() => reportTotal.value > 0)

const canExport = computed(() => {
  if (exporting.value || reportsLoading.value || !reportsAvailable.value) return false
  if (exportFormat.value === 'backup') return true
  if (scope.value === 'current') return Boolean(props.currentReport)
  return selectedIds.value.length > 0
})

const exportActionText = computed(() => {
  if (exportFormat.value === 'backup') return '生成备份文件'
  const count = scope.value === 'current' ? (props.currentReport ? 1 : 0) : selectedIds.value.length
  return count > 0 ? `导出 ${count} 份` : '导出'
})

const progressPercent = computed(() => {
  const { done, total } = progress.value
  return total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
})

const allChecked = computed({
  get: () => reports.value.length > 0 && selectedIds.value.length === reports.value.length,
  set: value => {
    selectedIds.value = value ? reports.value.map(report => report.id) : []
  }
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

async function ensureReports(force = false) {
  if (reportsLoading.value) return
  if (reportsLoaded.value && !force) return

  reportsLoading.value = true
  loadError.value = ''
  try {
    const total = await getTotalReportCount()
    reportTotal.value = total
    reports.value = await loadAllReports({ limit: total || 9999, offset: 0 })
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
      await exportBackupFile()
      ElMessage.success('备份文件已导出')
      visible.value = false
      return
    }

    if (scope.value === 'current') {
      progress.value = { done: 0, total: 1 }
      await exportReport(props.currentReport, exportFormat.value)
      progress.value = { done: 1, total: 1 }
      ElMessage.success('周报已导出')
      visible.value = false
      return
    }

    const selected = reports.value.filter(report => selectedIds.value.includes(report.id))
    const { ok, fail } = await exportReports(selected, exportFormat.value, {
      onProgress: (done, total) => {
        progress.value = { done, total }
      }
    })

    if (fail === 0) {
      ElMessage.success(`已导出 ${ok} 份周报`)
      visible.value = false
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

const busy = computed(() => exporting.value || importing.value || importParsing.value)

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

  importing.value = true
  importError.value = ''
  try {
    const isBackup = importParsed.value.kind === 'backup'
    const result = await importData(importParsed.value, {
      importReports: importReportsEnabled.value,
      importTemplates: isBackup && importTemplatesEnabled.value,
      importConfig: isBackup && importConfigEnabled.value
    })

    importResult.value = result
    reportsLoaded.value = false
    emit('imported', {
      importedCount: result.reports,
      templates: result.templates,
      config: result.config
    })
  } catch (error) {
    importError.value = error?.message || '导入失败'
    ElMessage.error(importError.value)
  } finally {
    importing.value = false
  }
}

// ============================================================
// 弹窗控制
// ============================================================
function beforeClose(done) {
  if (busy.value) return
  done()
}

function closeDialog() {
  if (busy.value) return
  visible.value = false
}

function handleBeforeLeave() {
  return !busy.value
}

watch(visible, open => {
  if (!open) return

  activeTab.value = props.initialTab === 'import' ? 'import' : 'export'
  scope.value = props.currentReport ? 'current' : 'all'
  exportFormat.value = 'html'
  exportError.value = ''
  progress.value = { done: 0, total: 0 }
  selectedIds.value = []
  rangeFilter.value = []
  reportsLoaded.value = false
  resetImport()

  if (activeTab.value === 'export') ensureReports(true)
})

watch(activeTab, tab => {
  if (tab === 'export' && visible.value) ensureReports()
})
</script>

<template>
  <AppDialog
    v-model="visible"
    title="导入 / 导出"
    subtitle="导出单份或全部周报，也可以备份和恢复完整数据"
    icon="Sort"
    width="860px"
    show-footer
    :close-on-press-escape="!busy"
    :before-close="beforeClose"
  >
    <el-tabs v-model="activeTab" class="ie-tabs" :before-leave="handleBeforeLeave">
      <el-tab-pane label="导出" name="export">
        <div class="ie-pane">
          <section class="wr-dialog-section">
            <div class="wr-dialog-label">导出格式</div>
            <el-radio-group v-model="exportFormat" :disabled="exporting">
              <el-radio-button value="html">HTML</el-radio-button>
              <el-radio-button value="markdown">Markdown</el-radio-button>
              <el-radio-button value="json">JSON</el-radio-button>
              <el-radio-button value="backup">全量备份</el-radio-button>
            </el-radio-group>
          </section>

          <section v-if="exportFormat === 'backup'" class="wr-dialog-section">
            <el-alert type="info" :closable="false" show-icon>
              <template #title>备份内容</template>
              全部周报（含回收站）、自定义模板与当前默认结构会保存为一个 JSON 文件。导入备份时不会覆盖现有周报。
            </el-alert>
          </section>

          <template v-else>
            <section class="wr-dialog-section">
              <div class="wr-dialog-label">导出范围</div>
              <el-radio-group v-model="scope" :disabled="exporting">
                <el-radio value="current" :disabled="!currentReport">
                  当前周报
                </el-radio>
                <el-radio value="all">全部周报</el-radio>
              </el-radio-group>
              <p v-if="!currentReport" class="field-hint">当前没有打开中的周报，可直接选择“全部周报”。</p>
            </section>

            <section class="wr-dialog-section">
              <div v-if="scope === 'current'" class="current-card">
                <template v-if="currentReport">
                  <span class="current-icon">
                    <el-icon :size="18"><Document /></el-icon>
                  </span>
                  <div class="current-main">
                    <p class="current-title">{{ currentReport.title }}</p>
                    <p class="current-meta">{{ formatDateRange(currentReport.dateRange) }}</p>
                  </div>
                </template>
                <p v-else class="field-hint">请先在左侧打开一份周报。</p>
              </div>

              <div v-else class="scope-all">
                <div class="list-toolbar">
                  <DateRangeField
                      v-model="rangeFilter"
                      :allow-clear="true"
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
                    type="error"
                    :closable="false"
                    :title="loadError"
                    show-icon
                />
                <div v-else-if="reports.length === 0" class="list-state">暂无可导出的周报</div>
                <el-scrollbar v-else max-height="34vh">
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
              </div>
            </section>
          </template>

          <el-alert
              v-if="exportError"
              class="ie-error"
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
      </el-tab-pane>

      <el-tab-pane label="导入" name="import">
        <div class="ie-pane">
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
                class="ie-error"
                type="error"
                :closable="false"
                :title="importError"
                show-icon
            />

            <template v-if="importParsed">
              <section class="wr-dialog-section">
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
              </section>

              <section class="wr-dialog-section">
                <div class="wr-dialog-label">导入内容</div>
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
              </section>
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
            <el-button link type="primary" @click="resetImport">继续导入</el-button>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <el-button :disabled="busy" @click="closeDialog">
        {{ activeTab === 'export' ? '取消' : '关闭' }}
      </el-button>
      <template v-if="activeTab === 'export'">
        <el-button
            type="primary"
            :loading="exporting"
            :disabled="!canExport"
            @click="handleExport"
        >
          <el-icon v-if="!exporting"><Download /></el-icon>
          <span>{{ exportActionText }}</span>
        </el-button>
      </template>
      <template v-else>
        <el-button v-if="importResult" type="primary" @click="closeDialog">完成</el-button>
        <el-button
            v-else
            type="primary"
            :loading="importing"
            :disabled="!canImport"
            @click="handleImport"
        >
          <el-icon v-if="!importing"><Upload /></el-icon>
          <span>开始导入</span>
        </el-button>
      </template>
    </template>
  </AppDialog>
</template>

<style scoped>
.ie-tabs {
  padding: 4px 20px 12px;
}

.ie-tabs :deep(.el-tabs__header) {
  margin-bottom: 4px;
}

.ie-pane {
  min-height: 320px;
  padding-top: 4px;
}

.field-hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.field-hint.inline {
  margin: 0;
}

.ie-error {
  margin-top: 12px;
}

/* 当前周报 */
.current-card {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 68px;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--wr-radius-md);
  background: var(--el-fill-color-lighter);
}

.current-icon {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: var(--wr-radius-sm);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.current-main {
  min-width: 0;
}

.current-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.current-meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 全部周报 */
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
  padding: 10px 0 8px;
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
  gap: 12px;
  padding: 10px 12px;
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

/* 隐藏 el-checkbox 的空 label，避免撑高行 */
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
  min-width: 190px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.row-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
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

/* 导出进度 */
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
  gap: 8px;
  margin-top: 4px;
  padding: 28px 20px;
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
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.dz-hint {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.file-input {
  display: none;
}

.summary-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
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
}

.summary-item {
  flex: 1;
  min-width: 120px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--wr-radius-md);
  background: var(--el-fill-color-lighter);
}

.summary-value {
  font-size: 18px;
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
  padding: 48px 20px;
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
  .row-date {
    min-width: 0;
  }
}
</style>
