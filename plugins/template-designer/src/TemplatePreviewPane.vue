<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useWeekReport } from '@week-report/plugin-api'
import Vditor from 'vditor'
import { renderReport } from './utils/templateRenderer'
import { formatDateRange } from './utils/reportExport'
import { debounce } from './utils/debounce'

defineOptions({ name: 'TemplatePreviewPane' })

const props = defineProps({
  type: {
    type: String,
    default: 'html'
  },
  template: {
    type: String,
    default: ''
  },
  reports: {
    type: Array,
    default: () => []
  },
  reportsLoading: {
    type: Boolean,
    default: false
  },
  report: {
    type: Object,
    default: null
  },
  sections: {
    type: Array,
    default: () => []
  },
  loadingSections: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const reportId = defineModel('reportId', {
  type: [Number, String],
  default: null
})

const api = useWeekReport()
const resolvedTheme = ref(api.theme.get().resolved)
let offTheme = null

const rendered = ref('')
const renderError = ref('')
const markdownFallback = ref(false)
const markdownRef = ref(null)

// 每次 Markdown 渲染自增，避免过期的异步结果覆盖降级状态
let markdownSeq = 0

const isMarkdown = computed(() => props.type === 'markdown')
const isCustom = computed(() => !['html', 'markdown'].includes(props.type))
const templateEmpty = computed(() => !props.template || !props.template.trim())

function reportDateText(report) {
  const value = formatDateRange(report.dateRange)
  return Array.isArray(value) ? '' : value || ''
}

function reportLabel(report) {
  const dateText = reportDateText(report)
  return dateText ? `${report.title} · ${dateText}` : report.title
}

// renderReport 内部捕获异常后返回一段错误 HTML，这里识别出来走错误面板
function readRenderError(output) {
  const match = /^<div class="render-error">渲染错误:\s*([\s\S]*)<\/div>$/.exec((output || '').trim())
  return match ? match[1].trim() : ''
}

async function renderMarkdown(markdown) {
  const seq = ++markdownSeq
  await nextTick()
  const element = markdownRef.value
  if (!element) return
  try {
    await Vditor.preview(element, markdown, {
      mode: resolvedTheme.value === 'dark' ? 'dark' : 'light',
      theme: { current: resolvedTheme.value === 'dark' ? 'dark' : 'light' },
      // 复用宿主已加载的文案，避免每次预览都从 CDN 拉取；没有则用默认兜底文案
      i18n: window.VditorI18n || {},
      icon: undefined
    })
    if (seq === markdownSeq) markdownFallback.value = false
  } catch (error) {
    console.warn('[TemplatePreviewPane] Markdown 预览失败，降级为纯文本:', error)
    if (seq === markdownSeq) markdownFallback.value = true
  }
}

function renderPreview() {
  if (!props.report || props.loadingSections || templateEmpty.value) {
    rendered.value = ''
    renderError.value = ''
    markdownSeq += 1
    return
  }

  const reportData = {
    title: props.report.title,
    dateRange: formatDateRange(props.report.dateRange),
    sections: props.sections || []
  }

  let output = ''
  try {
    output = renderReport(reportData, props.template)
  } catch (error) {
    renderError.value = error?.message || String(error)
    rendered.value = ''
    return
  }

  const error = readRenderError(output)
  if (error) {
    renderError.value = error
    rendered.value = ''
    return
  }

  renderError.value = ''
  rendered.value = output
  if (isMarkdown.value) renderMarkdown(output)
}

const scheduleRender = debounce(renderPreview, 300)

watch(
  [
    () => props.template,
    () => props.type,
    () => props.report,
    () => props.sections,
    () => props.loadingSections
  ],
  scheduleRender
)

watch(resolvedTheme, () => {
  if (isMarkdown.value) scheduleRender()
})

onMounted(() => {
  offTheme = api.theme.onChange(theme => {
    resolvedTheme.value = theme?.resolved || api.theme.get().resolved
  })
  scheduleRender()
})

onBeforeUnmount(() => {
  offTheme?.()
  scheduleRender.cancel()
  markdownSeq += 1
})
</script>

<template>
  <aside class="td-preview">
    <header class="td-preview-head">
      <div class="td-preview-head-row">
        <span class="td-preview-title">
          <el-icon><View /></el-icon>
          <span>预览周报</span>
        </span>
        <div class="td-preview-head-actions">
          <el-tooltip content="隐藏预览" placement="bottom">
            <button type="button" class="td-icon-btn" aria-label="隐藏预览" @click="emit('close')">
              <el-icon><Right /></el-icon>
            </button>
          </el-tooltip>
        </div>
      </div>

      <el-select
        v-model="reportId"
        class="td-report-select"
        size="small"
        filterable
        clearable
        :disabled="reportsLoading || !reports.length"
        :placeholder="reportsLoading ? '正在加载周报…' : reports.length ? '选择要预览的周报' : '暂无周报'"
      >
        <el-option
          v-for="item in reports"
          :key="item.id"
          :label="reportLabel(item)"
          :value="item.id"
        >
          <div class="td-report-option">
            <span class="td-report-name">{{ item.title }}</span>
            <span class="td-report-date">{{ reportDateText(item) || '未设置日期' }}</span>
          </div>
        </el-option>
      </el-select>
    </header>

    <div class="td-preview-body">
      <div v-if="reportsLoading && !reports.length" class="td-preview-hint">
        <el-icon :size="26" class="is-loading"><Loading /></el-icon>
        <p>正在加载周报列表…</p>
      </div>
      <div v-else-if="!reports.length" class="td-preview-hint">
        <el-icon :size="34"><Document /></el-icon>
        <p>暂无周报可预览</p>
        <span>新建一份周报后即可实时查看模板效果</span>
      </div>
      <div v-else-if="!report" class="td-preview-hint">
        <el-icon :size="34"><Pointer /></el-icon>
        <p>选择一份周报</p>
        <span>选择后会用当前模板草稿实时渲染预览</span>
      </div>
      <div v-else-if="loadingSections" class="td-preview-hint">
        <el-icon :size="26" class="is-loading"><Loading /></el-icon>
        <p>正在加载周报内容…</p>
      </div>
      <div v-else-if="renderError" class="td-preview-error">
        <el-icon :size="24"><WarningFilled /></el-icon>
        <div class="td-preview-error-body">
          <p>模板渲染失败</p>
          <pre>{{ renderError }}</pre>
        </div>
      </div>
      <div v-else-if="templateEmpty" class="td-preview-hint">
        <el-icon :size="34"><EditPen /></el-icon>
        <p>模板内容为空</p>
        <span>在中间编辑器输入 Handlebars 模板后即可预览</span>
      </div>
      <template v-else-if="isMarkdown">
        <div
          v-show="!markdownFallback"
          ref="markdownRef"
          class="td-markdown-content"
        ></div>
        <pre v-if="markdownFallback" class="td-markdown-fallback">{{ rendered }}</pre>
        <div v-if="markdownFallback" class="td-fallback-tip">
          Markdown 预览渲染失败，已降级为纯文本
        </div>
      </template>
      <pre v-else-if="isCustom" class="td-custom-content">{{ rendered }}</pre>
      <iframe
        v-else
        class="td-html-frame"
        sandbox=""
        title="周报预览"
        :srcdoc="rendered"
      ></iframe>
    </div>
  </aside>
</template>

<style scoped>
.td-preview {
  flex: 0 0 42%;
  max-width: 58%;
  min-width: 300px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.td-preview-head-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.td-preview-head-actions .td-icon-btn {
  width: 24px;
  height: 24px;
  font-size: 14px;
}

.td-preview-head {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}

.td-preview-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.td-preview-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--el-text-color-secondary);
}

.td-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.td-icon-btn:hover {
  color: var(--el-color-primary);
  background: var(--el-fill-color);
}

.td-report-select {
  width: 100%;
}

.td-report-option {
  display: flex;
  align-items: center;
  gap: 12px;
}

.td-report-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-report-date {
  flex: none;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.td-preview-body {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.td-preview-hint {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
  color: var(--el-text-color-secondary);
}

.td-preview-hint p {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.td-preview-hint span {
  font-size: 12.5px;
  line-height: 1.6;
  max-width: 280px;
}

.td-preview-error {
  flex: 1;
  display: flex;
  gap: 12px;
  padding: 24px;
  overflow: auto;
  color: var(--el-color-danger);
}

.td-preview-error-body p {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.td-preview-error-body pre {
  margin: 10px 0 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--el-text-color-regular);
}

.td-custom-content {
  margin: 0;
  padding: 16px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--wr-mono);
  font-size: 12px;
  line-height: 1.7;
  color: var(--el-text-color-primary);
}

.td-html-frame {
  flex: 1;
  width: 100%;
  min-height: 0;
  border: 0;
  background: #fff;
}

.td-markdown-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 18px 24px 32px;
  color: var(--el-text-color-primary);
}

.td-markdown-content :deep(.vditor-reset) {
  font-size: 14px;
  color: inherit;
  background: transparent;
}

.td-markdown-content :deep(.vditor-reset pre),
.td-markdown-content :deep(.vditor-reset code) {
  background: var(--el-fill-color-light);
}

.td-markdown-content :deep(.vditor-reset blockquote) {
  border-left-color: var(--el-border-color);
  color: var(--el-text-color-secondary);
}

.td-markdown-content :deep(.vditor-reset table) {
  border-color: var(--el-border-color);
}

.td-markdown-content :deep(.vditor-reset th),
.td-markdown-content :deep(.vditor-reset td) {
  border-color: var(--el-border-color);
}

.td-markdown-content :deep(.vditor-reset th) {
  background: var(--el-fill-color-lighter);
}

.td-markdown-fallback {
  flex: 1;
  margin: 0;
  padding: 18px 24px;
  overflow: auto;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.td-fallback-tip {
  flex: none;
  padding: 6px 14px;
  font-size: 12px;
  color: var(--el-color-warning);
  background: color-mix(in srgb, var(--el-color-warning) 10%, transparent);
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
