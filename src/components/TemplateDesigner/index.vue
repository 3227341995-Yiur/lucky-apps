<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppDialog from '@/components/common/AppDialog.vue'
import TemplateListPane from './TemplateListPane.vue'
import TemplateEditorPane from './TemplateEditorPane.vue'
import TemplatePreviewPane from './TemplatePreviewPane.vue'
import {
  BUILTIN_TEMPLATE_TYPES,
  createDefaultTemplateData,
  createMarkdownTemplateData,
  createTemplate,
  deleteTemplate,
  getAllTemplates,
  getTemplateTypes,
  saveTemplate,
  setDefaultTemplate,
  templateTypeLabel
} from '@/services/templateService'
import { getCopySettings, saveCopySettings } from '@/utils/reportExport'
import { emit } from '@/utils/eventBus'
import { loadAllReports, loadReportSections } from '@/services/database'

defineOptions({ name: 'TemplateDesigner' })

const visible = defineModel({ type: Boolean, default: false })

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
const previewFullscreen = ref(false)
const copyEnabled = ref(true)
const copyDefaultType = ref('html')
const templateTypes = ref([...BUILTIN_TEMPLATE_TYPES])

const reports = ref([])
const loadingReports = ref(false)
const selectedReportId = ref(null)
const sections = ref([])
const loadingSections = ref(false)

let openSeq = 0
let sectionSeq = 0

const snapshot = () => JSON.stringify([draft.id, draft.name, draft.type, draft.template])
const dirty = computed(() => snapshot() !== baseline.value)
const hasDraft = computed(() => draft.id !== null)
const currentReport = computed(
  () => reports.value.find(item => item.id === selectedReportId.value) || null
)

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

async function refreshTemplateTypes() {
  try {
    const [types, settings] = await Promise.all([getTemplateTypes(), getCopySettings()])
    templateTypes.value = types
    copyEnabled.value = settings.enabled
    const fallback = types[0]?.value || 'html'
    const nextType = types.some(item => item.value === settings.defaultType)
      ? settings.defaultType
      : fallback
    if (nextType !== copyDefaultType.value) copyDefaultType.value = nextType
    if (nextType !== settings.defaultType) {
      await saveCopySettings({ defaultType: nextType })
    }
  } catch (error) {
    console.warn('[TemplateDesigner] 加载模板类型失败:', error)
  }
}

async function handleCopyEnabledChange(value) {
  copyEnabled.value = Boolean(value)
  await saveCopySettings({ enabled: copyEnabled.value })
  emit('template:copy-settings')
}

async function handleCopyDefaultTypeChange(value) {
  if (!value) return
  copyDefaultType.value = value
  await saveCopySettings({ defaultType: value })
  emit('template:copy-settings')
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
    const list = await getAllTemplates()
    templates.value = list
    if (preferredId != null) {
      const found = list.find(item => item.id === preferredId)
      if (found) return found
    }
    return list.find(item => item.isDefault) || list[0] || null
  } catch (error) {
    console.error('[TemplateDesigner] 加载模板失败:', error)
    ElMessage.error('加载模板失败')
    return null
  } finally {
    loadingTemplates.value = false
  }
}

async function loadReports() {
  loadingReports.value = true
  try {
    reports.value = await loadAllReports({ limit: 1000 })
  } catch (error) {
    console.error('[TemplateDesigner] 加载周报列表失败:', error)
    reports.value = []
    ElMessage.error('加载周报列表失败')
  } finally {
    loadingReports.value = false
  }
}

async function openWorkspace() {
  const seq = ++openSeq
  selectedReportId.value = null
  sections.value = []
  loadingSections.value = false

  const [next] = await Promise.all([refreshTemplates(currentId.value), refreshTemplateTypes()])
  if (seq !== openSeq) return
  applyTemplate(next)

  await loadReports()
}

watch(
  visible,
  open => {
    if (open) openWorkspace()
  },
  { immediate: true }
)

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
    const loaded = await loadReportSections(id)
    if (seq !== sectionSeq) return
    sections.value = loaded
  } catch (error) {
    if (seq !== sectionSeq) return
    console.error('[TemplateDesigner] 加载周报内容失败:', error)
    ElMessage.error('加载周报内容失败')
  } finally {
    if (seq === sectionSeq) loadingSections.value = false
  }
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
  const label = templateTypeLabel(type, templateTypes.value)
  const content = type === 'markdown'
    ? createMarkdownTemplateData()
    : type === 'html'
      ? createDefaultTemplateData()
      : `# {{title}}

**日期范围：** {{dateRange}}

{{#each sections}}## {{title}}

{{/each}}`
  try {
    const template = createTemplate(uniqueTemplateName(`新建 ${label} 模板`), type, content)
    const id = await saveTemplate(template)
    await refreshTemplateTypes()
    emit('template:copy-settings')
    const created = await refreshTemplates(id)
    if (created) applyTemplate(created)
    ElMessage.success('已创建模板')
  } catch (error) {
    console.error('[TemplateDesigner] 新建模板失败:', error)
    ElMessage.error(`新建模板失败：${error?.message || error}`)
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

async function handleCopy(template) {
  if (!template) return
  const isCurrent = template.id === draft.id
  // 复制当前模板时带上编辑器里的最新草稿，避免丢改动
  if (!isCurrent && !(await confirmDiscard('复制模板'))) return

  const source = isCurrent
    ? { name: draft.name, type: draft.type, template: draft.template }
    : template

  try {
    const copy = createTemplate(
      uniqueTemplateName(`${source.name || '未命名'} 副本`),
      source.type,
      source.template
    )
    const id = await saveTemplate(copy)
    const created = await refreshTemplates(id)
    if (created) applyTemplate(created)
    ElMessage.success('已复制模板')
  } catch (error) {
    console.error('[TemplateDesigner] 复制模板失败:', error)
    ElMessage.error(`复制模板失败：${error?.message || error}`)
  }
}

async function handleSetDefault(template) {
  if (!template || template.isDefault) return
  try {
    await setDefaultTemplate(template.id, template.type)
    emit('template:copy-settings')
    templates.value = await getAllTemplates()
    const current = templates.value.find(item => item.id === draft.id)
    if (current) draft.isDefault = Boolean(current.isDefault)
    ElMessage.success(`已将「${template.name}」设为默认模板`)
  } catch (error) {
    console.error('[TemplateDesigner] 设置默认模板失败:', error)
    ElMessage.error('设置默认模板失败')
  }
}

async function handleRemove(template) {
  if (!template) return
  if (template.isSystem) {
    ElMessage.warning('系统模板不能删除')
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
    await deleteTemplate(template.id)
    let list = await getAllTemplates()

    // 删除的若是同类型默认模板，补一个默认，避免导出时找不到模板
    if (template.isDefault) {
      const replacement = list.find(item => item.type === template.type)
      if (replacement) {
        await setDefaultTemplate(replacement.id, replacement.type)
        list = await getAllTemplates()
      }
    }

    templates.value = list
    await refreshTemplateTypes()
    emit('template:copy-settings')
    if (isCurrent) {
      const next = list[Math.min(Math.max(index, 0), list.length - 1)] || null
      if (next) applyTemplate(next)
      else clearDraft()
    }
    ElMessage.success('已删除模板')
  } catch (error) {
    console.error('[TemplateDesigner] 删除模板失败:', error)
    ElMessage.error('删除模板失败')
  }
}

async function handleSave() {
  if (!hasDraft.value) return
  if (!draft.name.trim()) {
    ElMessage.warning('请输入模板名称')
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
    const id = await saveTemplate(payload)
    draft.id = id
    draft.name = payload.name
    currentId.value = id
    // 以提交时的内容作为已保存基线，保存期间的新编辑仍应保持未保存状态
    baseline.value = JSON.stringify([id, payload.name, payload.type, payload.template])

    await refreshTemplateTypes()
    emit('template:copy-settings')
    const saved = await refreshTemplates(id)
    if (saved) {
      draft.isDefault = Boolean(saved.isDefault)
      draft.isSystem = Boolean(saved.isSystem)
    }
    ElMessage.success('模板已保存')
  } catch (error) {
    console.error('[TemplateDesigner] 保存模板失败:', error)
    ElMessage.error(`保存模板失败：${error?.message || error}`)
  } finally {
    saving.value = false
  }
}

async function handleBeforeClose(done) {
  if (!dirty.value) {
    done()
    return
  }
  try {
    await ElMessageBox.confirm(
      `模板「${draft.name || '未命名'}」有未保存的修改，关闭后将丢失，确定关闭吗？`,
      '关闭模板设计器',
      { confirmButtonText: '放弃并关闭', cancelButtonText: '继续编辑', type: 'warning' }
    )
    done()
  } catch {
    // 留在编辑器
  }
}

function handleKeydown(event) {
  if (!visible.value) return
  const modifier = event.ctrlKey || event.metaKey
  if (!modifier || event.shiftKey || event.altKey) return
  if (event.key.toLowerCase() !== 's') return
  event.preventDefault()
  event.stopPropagation()
  if (!saving.value) handleSave()
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown, true)
})
</script>

<template>
  <AppDialog
    v-model="visible"
    title="模板设计器"
    subtitle="Handlebars 模板 · 选择周报实时预览"
    icon="EditPen"
    width="96vw"
    fill-height
    :close-on-press-escape="false"
    :before-close="handleBeforeClose"
  >
    <div class="td-shell">
      <TemplateListPane
        :templates="templates"
        :current-id="currentId"
        :loading="loadingTemplates"
        @select="handleSelect"
        @create="handleCreate"
        @copy="handleCopy"
        @remove="handleRemove"
        @set-default="handleSetDefault"
        @create-custom="handleCreateCustomType"
        :types="templateTypes"
        :copy-enabled="copyEnabled"
        :copy-default-type="copyDefaultType"
        @update:copy-enabled="handleCopyEnabledChange"
        @update:copy-default-type="handleCopyDefaultTypeChange"
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
        :saving="saving"
        :show-preview="showPreview"
        @save="handleSave"
        @create="handleCreate"
        @toggle-preview="showPreview = !showPreview; if (!showPreview) previewFullscreen = false"
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
        :fullscreen="previewFullscreen"
        @toggle-fullscreen="previewFullscreen = !previewFullscreen"
        @close="previewFullscreen = false; showPreview = false"
      />
    </div>
  </AppDialog>
</template>

<style scoped>
.td-shell {
  display: flex;
  flex: 1;
  height: 100%;
  min-height: 0;
  background: var(--el-bg-color);
}
</style>

