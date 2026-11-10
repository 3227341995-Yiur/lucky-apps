<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useWeekReport } from '@week-report/plugin-api'
import TemplateListPane from './TemplateListPane.vue'
import TemplateEditorPane from './TemplateEditorPane.vue'
import TemplatePreviewPane from './TemplatePreviewPane.vue'
import { getCopySettings, saveCopySettings } from './utils/reportExport'
import defaultHtmlTemplate from './config/default-html.html?raw'
import defaultMarkdownTemplate from './config/default-markdown.md?raw'

defineOptions({ name: 'TemplateDesignerPage' })

const api = useWeekReport()

const BUILTIN_TEMPLATE_TYPES = [
  { value: 'html', label: 'HTML' },
  { value: 'markdown', label: 'Markdown' }
]
const CUSTOM_TYPE_TEMPLATE = `# {{title}}

**日期范围：** {{dateRange}}

{{#each sections}}## {{title}}

{{/each}}`

const templates = ref([])
const loadingTemplates = ref(false)
const currentId = ref(null)

const draft = reactive({
  id: null,
  name: '',
  type: 'html',
  isDefault: false,
  isSystem: false,
  template: ''
})
const baseline = ref('')
const saving = ref(false)
const showPreview = ref(true)
const copyEnabled = ref(true)
const copyDefaultType = ref('html')

const reports = ref([])
const loadingReports = ref(false)
const selectedReportId = ref(null)
const sections = ref([])
const loadingSections = ref(false)

let sectionSeq = 0
let offReportChanged = null

const snapshot = () => JSON.stringify([draft.id, draft.name, draft.type, draft.template])
const dirty = computed(() => snapshot() !== baseline.value)
const hasDraft = computed(() => draft.id !== null)
const currentReport = computed(
  () => reports.value.find(item => item.id === selectedReportId.value) || null
)

const templateTypes = computed(() => {
  const map = new Map(BUILTIN_TEMPLATE_TYPES.map(item => [item.value, item.label]))
  for (const template of templates.value) {
    if (template.type && !map.has(template.type)) map.set(template.type, template.type)
  }
  return [...map.entries()].map(([value, label]) => ({ value, label }))
})

function templateTypeLabel(type) {
  return templateTypes.value.find(item => item.value === type)?.label
    || String(type || '').toUpperCase()
}

function applyTemplate(template) {
  if (!template) {
    clearDraft()
    return
  }
  draft.id = template.id
  draft.name = template.name || ''
  draft.type = template.type || 'html'
  draft.isDefault = Boolean(template.isDefault)
  draft.isSystem = Boolean(template.isSystem)
  draft.template = template.template || ''
  currentId.value = template.id
  baseline.value = snapshot()
}

function clearDraft() {
  draft.id = null
  draft.name = ''
  draft.type = 'html'
  draft.isDefault = false
  draft.isSystem = false
  draft.template = ''
  currentId.value = null
  baseline.value = snapshot()
}

async function refreshTemplates(preferredId = currentId.value) {
  loadingTemplates.value = true
  try {
    const list = await api.templates.list()
    templates.value = list
    if (preferredId != null) {
      const found = list.find(item => item.id === preferredId)
      if (found) return found
    }
    return list.find(item => item.isDefault) || list[0] || null
  } catch (error) {
    console.error('[TemplateDesigner] 加载模板失败:', error)
    api.ui.toast('加载模板失败', 'error')
    return null
  } finally {
    loadingTemplates.value = false
  }
}

async function loadReports() {
  loadingReports.value = true
  try {
    reports.value = await api.reports.search()
  } catch (error) {
    console.error('[TemplateDesigner] 加载周报列表失败:', error)
    reports.value = []
    api.ui.toast('加载周报列表失败', 'error')
  } finally {
    loadingReports.value = false
  }
}

async function openWorkspace() {
  selectedReportId.value = null
  sections.value = []
  loadingSections.value = false

  const next = await refreshTemplates(currentId.value)
  applyTemplate(next)

  await loadReports()
}

// 选择预览周报后懒加载区块数据
watch(selectedReportId, async id => {
  const seq = ++sectionSeq
  sections.value = []
  if (id == null || id === '') {
    loadingSections.value = false
    return
  }
  loadingSections.value = true
  try {
    const report = await api.reports.get(id)
    if (seq !== sectionSeq) return
    sections.value = report?.sections || []
  } catch (error) {
    if (seq !== sectionSeq) return
    console.error('[TemplateDesigner] 加载周报内容失败:', error)
    api.ui.toast('加载周报内容失败', 'error')
  } finally {
    if (seq === sectionSeq) loadingSections.value = false
  }
})

// 模板类型增减后，保证默认复制类型仍然有效
watch(templateTypes, types => {
  if (types.some(item => item.value === copyDefaultType.value)) return
  copyDefaultType.value = types[0]?.value || 'html'
  saveCopySettings({ defaultType: copyDefaultType.value })
})

async function confirmDiscard(actionLabel) {
  if (!dirty.value) return true
  try {
    await ElMessageBox.confirm(
      `当前模板「${draft.name || '未命名'}」有未保存的修改，${actionLabel}将丢失这些修改，是否继续？`,
      '未保存的修改',
      { confirmButtonText: '放弃修改', cancelButtonText: '返回编辑', type: 'warning' }
    )
    return true
  } catch {
    return false
  }
}

async function handleSelect(template) {
  if (!template || template.id === draft.id) return
  if (!(await confirmDiscard('切换模板'))) return
  applyTemplate(template)
}

function uniqueTemplateName(base) {
  const names = new Set(templates.value.map(item => item.name))
  if (!names.has(base)) return base
  let index = 2
  while (names.has(`${base} ${index}`)) index++
  return `${base} ${index}`
}

async function handleCreate(type = 'html') {
  if (!(await confirmDiscard('新建模板'))) return
  const label = templateTypeLabel(type)
  const content = type === 'markdown'
    ? defaultMarkdownTemplate
    : type === 'html'
      ? defaultHtmlTemplate
      : CUSTOM_TYPE_TEMPLATE
  try {
    const id = await api.templates.save({
      id: 0,
      name: uniqueTemplateName(`新建 ${label} 模板`),
      type,
      isDefault: false,
      isSystem: false,
      template: content
    })
    const created = await refreshTemplates(id)
    if (created) applyTemplate(created)
    api.ui.toast('已创建模板', 'success')
  } catch (error) {
    console.error('[TemplateDesigner] 新建模板失败:', error)
    api.ui.toast(`新建模板失败：${error?.message || error}`, 'error')
  }
}

async function handleCreateCustomType() {
  try {
    const { value } = await ElMessageBox.prompt(
      '输入模板类型名称，例如 text、jira、weekly',
      '新建模板类型',
      {
        confirmButtonText: '创建',
        cancelButtonText: '取消',
        inputPattern: /^[A-Za-z][\w-]*$/,
        inputErrorMessage: '类型只能包含字母、数字、下划线或短横线，并以字母开头'
      }
    )
    const type = String(value || '').trim()
    if (type) await handleCreate(type)
  } catch {
    // 用户取消
  }
}

function handleCreateCommand(command) {
  if (command === 'custom') handleCreateCustomType()
  else handleCreate(command)
}

async function handleCopy(template) {
  if (!template) return
  const isCurrent = template.id === draft.id
  // 复制当前模板时带上编辑器里的最新草稿，避免丢改动
  if (!isCurrent && !(await confirmDiscard('复制模板'))) return

  const source = isCurrent
    ? { name: draft.name, type: draft.type, template: draft.template }
    : template

  try {
    const id = await api.templates.save({
      id: 0,
      name: uniqueTemplateName(`${source.name || '未命名'} 副本`),
      type: source.type,
      isDefault: false,
      isSystem: false,
      template: source.template
    })
    const created = await refreshTemplates(id)
    if (created) applyTemplate(created)
    api.ui.toast('已复制模板', 'success')
  } catch (error) {
    console.error('[TemplateDesigner] 复制模板失败:', error)
    api.ui.toast(`复制模板失败：${error?.message || error}`, 'error')
  }
}

async function handleSetDefault(template) {
  if (!template || template.isDefault) return
  try {
    await api.templates.setDefault(template.id, template.type)
    templates.value = await api.templates.list()
    const current = templates.value.find(item => item.id === draft.id)
    if (current) draft.isDefault = Boolean(current.isDefault)
    api.ui.toast(`已将「${template.name}」设为默认模板`, 'success')
  } catch (error) {
    console.error('[TemplateDesigner] 设置默认模板失败:', error)
    api.ui.toast('设置默认模板失败', 'error')
  }
}

async function handleRemove(template) {
  if (!template) return
  if (template.isSystem) {
    api.ui.toast('系统模板不能删除', 'warning')
    return
  }

  const isCurrent = template.id === draft.id
  try {
    await ElMessageBox.confirm(
      isCurrent && dirty.value
        ? `模板「${template.name}」有未保存的修改，删除后这些修改也会丢失，确定删除吗？`
        : `确定删除模板「${template.name}」吗？删除后不可恢复。`,
      '删除模板',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  const index = templates.value.findIndex(item => item.id === template.id)
  try {
    await api.templates.remove(template.id)
    let list = await api.templates.list()

    // 删除的若是同类型默认模板，补一个默认，避免导出时找不到模板
    if (template.isDefault) {
      const replacement = list.find(item => item.type === template.type)
      if (replacement) {
        await api.templates.setDefault(replacement.id, replacement.type)
        list = await api.templates.list()
      }
    }

    templates.value = list
    if (isCurrent) {
      const next = list[Math.min(Math.max(index, 0), list.length - 1)] || null
      if (next) applyTemplate(next)
      else clearDraft()
    }
    api.ui.toast('已删除模板', 'success')
  } catch (error) {
    console.error('[TemplateDesigner] 删除模板失败:', error)
    api.ui.toast('删除模板失败', 'error')
  }
}

async function handleSave() {
  if (!hasDraft.value) return
  if (!draft.name.trim()) {
    api.ui.toast('请输入模板名称', 'warning')
    return
  }
  if (saving.value) return
  saving.value = true
  try {
    const payload = {
      id: draft.id || 0,
      name: draft.name.trim(),
      type: draft.type,
      isDefault: draft.isDefault,
      isSystem: draft.isSystem,
      template: draft.template
    }
    const id = await api.templates.save(payload)
    draft.id = id
    draft.name = payload.name
    currentId.value = id
    // 以提交时的内容作为已保存基线，保存期间的新编辑仍应保持未保存状态
    baseline.value = JSON.stringify([id, payload.name, payload.type, payload.template])

    const saved = await refreshTemplates(id)
    if (saved) {
      draft.isDefault = Boolean(saved.isDefault)
      draft.isSystem = Boolean(saved.isSystem)
    }
    api.ui.toast('模板已保存', 'success')
  } catch (error) {
    console.error('[TemplateDesigner] 保存模板失败:', error)
    api.ui.toast(`保存模板失败：${error?.message || error}`, 'error')
  } finally {
    saving.value = false
  }
}

function handleSetDefaultCurrent() {
  const template = templates.value.find(item => item.id === draft.id)
  if (template) handleSetDefault(template)
}

function handleRemoveCurrent() {
  const template = templates.value.find(item => item.id === draft.id)
  if (template) handleRemove(template)
}

function handleCopyEnabledChange(value) {
  copyEnabled.value = Boolean(value)
  saveCopySettings({ enabled: copyEnabled.value })
}

function handleCopyDefaultTypeChange(value) {
  if (!value) return
  copyDefaultType.value = value
  saveCopySettings({ defaultType: value })
}

function handleKeydown(event) {
  const modifier = event.ctrlKey || event.metaKey
  if (!modifier || event.shiftKey || event.altKey) return
  if (event.key.toLowerCase() !== 's') return
  event.preventDefault()
  event.stopPropagation()
  if (!saving.value) handleSave()
}

onMounted(() => {
  const settings = getCopySettings()
  copyEnabled.value = settings.enabled
  copyDefaultType.value = settings.defaultType

  openWorkspace()
  offReportChanged = api.events.on('report:changed', loadReports)
  document.addEventListener('keydown', handleKeydown, true)
})

onBeforeUnmount(() => {
  sectionSeq += 1
  offReportChanged?.()
  document.removeEventListener('keydown', handleKeydown, true)
})
</script>

<template>
  <el-scrollbar class="wr-page td-page">
    <div class="wr-page-inner td-page-inner">
      <header class="td-page-header">
        <div class="td-header-main">
          <div class="wr-eyebrow">Templates</div>
          <div class="td-title-row">
            <h1 class="wr-page-title">模板设计</h1>
            <span class="wr-chip">{{ templates.length }} 个模板</span>
          </div>
          <p class="wr-page-subtitle">Handlebars 模板 · 选择周报实时预览</p>
        </div>

        <div class="td-toolbar">
          <el-dropdown trigger="click" @command="handleCreateCommand">
            <el-button type="primary">
              <el-icon><Plus /></el-icon>
              <span>新建</span>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="item in templateTypes"
                  :key="item.value"
                  :command="item.value"
                >
                  <el-icon><Document /></el-icon>新建 {{ item.label }} 模板
                </el-dropdown-item>
                <el-dropdown-item command="custom" divided>
                  <el-icon><Plus /></el-icon>新建周报类型…
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <el-button :loading="saving" :disabled="!hasDraft" @click="handleSave">
            <el-icon v-if="!saving"><Check /></el-icon>
            <span>保存</span>
          </el-button>

          <el-button :disabled="!hasDraft || draft.isDefault" @click="handleSetDefaultCurrent">
            <el-icon><Star /></el-icon>
            <span>设为默认</span>
          </el-button>

          <el-button
            type="danger"
            plain
            :disabled="!hasDraft || draft.isSystem"
            @click="handleRemoveCurrent"
          >
            <el-icon><Delete /></el-icon>
            <span>删除</span>
          </el-button>

          <el-popover placement="bottom-end" :width="260" trigger="click">
            <template #reference>
              <el-button>
                <el-icon><Setting /></el-icon>
                <span>复制设置</span>
              </el-button>
            </template>
            <div class="td-copy-settings">
              <div class="td-copy-row">
                <span>复制使用模板</span>
                <el-switch
                  :model-value="copyEnabled"
                  size="small"
                  @change="handleCopyEnabledChange"
                />
              </div>
              <div class="td-copy-row">
                <span>默认复制类型</span>
                <el-select
                  :model-value="copyDefaultType"
                  size="small"
                  :disabled="!copyEnabled"
                  @change="handleCopyDefaultTypeChange"
                >
                  <el-option
                    v-for="item in templateTypes"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </div>
            </div>
          </el-popover>
        </div>
      </header>

      <div class="td-shell">
        <TemplateListPane
          :templates="templates"
          :current-id="currentId"
          :loading="loadingTemplates"
          @select="handleSelect"
          @copy="handleCopy"
          @remove="handleRemove"
          @set-default="handleSetDefault"
        />

        <TemplateEditorPane
          v-model:name="draft.name"
          v-model:type="draft.type"
          v-model:content="draft.template"
          :types="templateTypes"
          :has-draft="hasDraft"
          :template-id="draft.id"
          :is-default="draft.isDefault"
          :is-system="draft.isSystem"
          :dirty="dirty"
          :show-preview="showPreview"
          @create="handleCreate"
          @toggle-preview="showPreview = !showPreview"
        />

        <TemplatePreviewPane
          v-if="showPreview"
          v-model:report-id="selectedReportId"
          :type="draft.type"
          :template="draft.template"
          :reports="reports"
          :reports-loading="loadingReports"
          :report="currentReport"
          :sections="sections"
          :loading-sections="loadingSections"
          @close="showPreview = false"
        />
      </div>
    </div>
  </el-scrollbar>
</template>

<style scoped>
.td-page {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* el-scrollbar 的 view 默认高度自适应，撑满页面才能让三栏工作区吃满剩余高度 */
.td-page :deep(.el-scrollbar__view) {
  height: 100%;
}

.td-page-inner {
  max-width: 1400px;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding-bottom: 24px;
}

.td-page-header {
  flex: none;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px 20px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.td-header-main {
  min-width: 0;
}

.td-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.td-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.td-page :deep(.el-button + .el-button) {
  margin-left: 0;
}

.td-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 14px;
  background: var(--el-bg-color);
}

.td-copy-settings {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.td-copy-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.td-copy-row :deep(.el-select) {
  width: 120px;
}

@media (max-width: 900px) {
  .td-page-header {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
