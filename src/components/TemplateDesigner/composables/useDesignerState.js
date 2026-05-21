/**
 * 模板设计器状态管理
 * 使用 Composition API 的 provide/inject 模式
 */
import { reactive, provide, inject, computed } from 'vue'
import { getAllTemplates, saveTemplate, getTemplateById, createTemplate, deleteTemplate, setDefaultTemplate, getDefaultTemplate, ensureDefaultTemplate, createDefaultTemplateData } from '@/services/templateService'
import { generateId } from '@/utils/idGenerator'

// 注入 key
const DESIGNER_STATE_KEY = Symbol('designerState')

/**
 * 创建设计器状态
 */
export function useDesignerState() {
  const state = reactive({
    isOpen: false,
    templates: [],
    activeTemplateId: null,
    currentTemplate: null,      // 当前编辑中的模板（deep clone）
    selectedElement: null,       // { type: 'section'|'column', sectionIndex, columnIndex }
    selectedSection: null,
    selectedColumn: null,
    isLoading: false,
    error: null
  })

  // 计算属性
  const currentTemplateName = computed(() => {
    if (!state.currentTemplate) return ''
    const template = state.templates.find(t => t.id === state.activeTemplateId)
    return template?.name || '未命名模板'
  })

  /**
   * 打开设计器
   */
  const openDesigner = async () => {
    state.isOpen = true
    await loadTemplates()
  }

  /**
   * 关闭设计器
   */
  const closeDesigner = () => {
    state.isOpen = false
    state.selectedElement = null
    state.selectedSection = null
    state.selectedColumn = null
  }

  /**
   * 加载所有模板
   */
  const loadTemplates = async () => {
    state.isLoading = true
    try {
      // 确保有默认模板
      await ensureDefaultTemplate()
      state.templates = await getAllTemplates()

      // 默认选中第一个
      const defaultTemplate = state.templates.find(t => t.isDefault) || state.templates[0]
      if (defaultTemplate) {
        await selectTemplate(defaultTemplate.id)
      }
    } catch (e) {
      state.error = e.message
      console.error('加载模板失败:', e)
    } finally {
      state.isLoading = false
    }
  }

  /**
   * 选择模板
   */
  const selectTemplate = async (templateId) => {
    const template = state.templates.find(t => t.id === templateId)
    if (template) {
      state.activeTemplateId = templateId
      // 模板内容是 template.template 字符串
      state.currentTemplate = template.template || ''
      clearSelection()
    }
  }

  /**
   * 切换模板（用户点击切换）
   */
  const switchTemplate = async (templateId) => {
    if (state.activeTemplateId !== templateId) {
      await selectTemplate(templateId)
    }
  }

  /**
   * 保存当前模板
   */
  const saveCurrentTemplate = async () => {
    if (!state.currentTemplate || !state.activeTemplateId) return

    const template = state.templates.find(t => t.id === state.activeTemplateId)
    if (template) {
      // currentTemplate 是模板字符串
      template.template = state.currentTemplate
      template.updatedAt = Date.now()
      await saveTemplate(template)
    }
  }

  /**
   * 创建新模板
   */
  const addNewTemplate = async (name) => {
    try {
      const template = await createTemplate(name)
      state.templates.unshift(template)
      await selectTemplate(template.id)
      return template
    } catch (e) {
      state.error = e.message
      console.error('创建模板失败:', e)
      return null
    }
  }

  /**
   * 删除模板
   */
  const removeTemplate = async (templateId) => {
    const template = state.templates.find(t => t.id === templateId)
    if (!template) return

    // 不能删除默认模板
    if (template.isDefault) {
      state.error = '默认模板不能删除'
      return
    }

    try {
      await deleteTemplate(templateId)
      const index = state.templates.findIndex(t => t.id === templateId)
      if (index !== -1) {
        state.templates.splice(index, 1)
      }

      // 如果删除的是当前活动模板，切换到其他模板
      if (state.activeTemplateId === templateId) {
        const defaultTemplate = state.templates.find(t => t.isDefault) || state.templates[0]
        if (defaultTemplate) {
          await selectTemplate(defaultTemplate.id)
        }
      }
    } catch (e) {
      state.error = e.message
      console.error('删除模板失败:', e)
    }
  }

  /**
   * 设为默认模板
   */
  const makeDefault = async (templateId) => {
    try {
      await setDefaultTemplate(templateId)
      // 更新本地状态
      state.templates.forEach(t => {
        t.isDefault = t.id === templateId
      })
    } catch (e) {
      state.error = e.message
      console.error('设置默认模板失败:', e)
    }
  }

  /**
   * 选择元素
   */
  const selectElement = (element) => {
    state.selectedElement = element

    if (element?.type === 'section') {
      state.selectedSection = state.currentTemplate?.[element.sectionIndex] || null
      state.selectedColumn = null
    } else if (element?.type === 'column') {
      state.selectedSection = state.currentTemplate?.[element.sectionIndex] || null
      state.selectedColumn = state.selectedSection?.columns?.[element.columnIndex] || null
    } else {
      state.selectedSection = null
      state.selectedColumn = null
    }
  }

  /**
   * 清除选择
   */
  const clearSelection = () => {
    state.selectedElement = null
    state.selectedSection = null
    state.selectedColumn = null
  }

  /**
   * 添加 Section 到画布
   */
  const addSection = (sectionType) => {
    if (!state.currentTemplate) return

    const sectionData = {
      type: sectionType.type,
      title: sectionType.title,
      icon: sectionType.icon,
      hasExpandColumn: sectionType.type === 'support',
      columns: sectionType.type === 'completed'
        ? [
            { prop: 'title', label: '标题', fixed: true },
            { prop: 'status', label: '状态', fixed: true, component: 'status-selector', defaultValue: '开发中', attrs: { options: ['开发中', '待测试', '已完成'] } }
          ]
        : sectionType.type === 'support'
        ? [
            { prop: 'title', label: '标题', fixed: true },
            { prop: 'date', label: '日期', fixed: true, component: 'date-selector', defaultValue: "moment().format('YYYY-MM-DD')" }
          ]
        : [
            { prop: 'title', label: '标题', fixed: true }
          ],
      items: [{ id: generateId() }],
      // Handlebars 模板
      template: sectionType.template || getDefaultTemplate(sectionType.type),
      // 自定义样式
      styles: '',
      // 值结构定义
      valueSchema: sectionType.valueSchema || {}
    }

    state.currentTemplate.push(sectionData)
  }

  /**
   * 获取默认模板
   */
  const getDefaultTemplate = (type) => {
    const templates = {
      completed: `<table class="section-table">
{{#each items}}
<tr>
  <td>{{title}}</td>
  <td>{{status}}</td>
</tr>
{{/each}}
</table>`,
      support: `<div class="support-list">
{{#each items}}
<div class="support-item">
  <span class="support-title">{{title}}</span>
  <span class="support-date">{{date}}</span>
</div>
{{/each}}
</div>`,
      plan: `<ul class="plan-list">
{{#each items}}
<li>{{title}}</li>
{{/each}}
</ul>`
    }
    return templates[type] || templates.completed
  }

  /**
   * 删除 Section
   */
  const removeSection = (sectionIndex) => {
    if (!state.currentTemplate || sectionIndex >= state.currentTemplate.length) return

    state.currentTemplate.splice(sectionIndex, 1)

    // 如果删除的是选中元素，清除选择
    if (state.selectedElement?.type === 'section' && state.selectedElement.sectionIndex === sectionIndex) {
      clearSelection()
    }
  }

  /**
   * 更新 Section 属性
   */
  const updateSection = (sectionIndex, updates) => {
    if (!state.currentTemplate || sectionIndex >= state.currentTemplate.length) return

    Object.assign(state.currentTemplate[sectionIndex], updates)

    // 更新选中引用
    if (state.selectedElement?.type === 'section' && state.selectedElement.sectionIndex === sectionIndex) {
      state.selectedSection = state.currentTemplate[sectionIndex]
    }
  }

  /**
   * 添加 Column 到 Section
   */
  const addColumn = (sectionIndex, columnData = null) => {
    if (!state.currentTemplate || sectionIndex >= state.currentTemplate.length) return

    const col = columnData || {
      prop: `column${Date.now()}`,
      label: `新列${state.currentTemplate[sectionIndex].columns.length + 1}`,
      fixed: false
    }

    state.currentTemplate[sectionIndex].columns.push(col)
  }

  /**
   * 删除 Column
   */
  const removeColumn = (sectionIndex, columnIndex) => {
    if (!state.currentTemplate || sectionIndex >= state.currentTemplate.length) return

    const section = state.currentTemplate[sectionIndex]
    if (columnIndex >= section.columns.length) return

    // 不能删除固定列
    if (section.columns[columnIndex].fixed) return

    section.columns.splice(columnIndex, 1)

    // 如果删除的是选中元素，清除选择
    if (state.selectedElement?.type === 'column' &&
        state.selectedElement.sectionIndex === sectionIndex &&
        state.selectedElement.columnIndex === columnIndex) {
      clearSelection()
    }
  }

  /**
   * 更新 Column 属性
   */
  const updateColumn = (sectionIndex, columnIndex, updates) => {
    if (!state.currentTemplate || sectionIndex >= state.currentTemplate.length) return

    const section = state.currentTemplate[sectionIndex]
    if (columnIndex >= section.columns.length) return

    Object.assign(section.columns[columnIndex], updates)

    // 更新选中引用
    if (state.selectedElement?.type === 'column' &&
        state.selectedElement.sectionIndex === sectionIndex &&
        state.selectedElement.columnIndex === columnIndex) {
      state.selectedColumn = section.columns[columnIndex]
    }
  }

  /**
   * 获取当前模板的克隆数据（用于导出）
   */
  const getTemplateDataForExport = () => {
    if (!state.currentTemplate) return null
    return JSON.parse(JSON.stringify(state.currentTemplate))
  }

  return {
    state,
    currentTemplateName,
    openDesigner,
    closeDesigner,
    loadTemplates,
    selectTemplate,
    switchTemplate,
    saveCurrentTemplate,
    addNewTemplate,
    removeTemplate,
    makeDefault,
    selectElement,
    clearSelection,
    addSection,
    removeSection,
    updateSection,
    addColumn,
    removeColumn,
    updateColumn,
    getTemplateDataForExport
  }
}

/**
 * 提供设计器状态（用于父组件）
 */
export function provideDesignerState() {
  const designerState = useDesignerState()
  provide(DESIGNER_STATE_KEY, designerState)
  return designerState
}

/**
 * 注入设计器状态（用于子组件）
 */
export function injectDesignerState() {
  const state = inject(DESIGNER_STATE_KEY)
  if (!state) {
    throw new Error('未找到设计器状态，请确保在 DesignerProvider 内使用')
  }
  return state
}

export { DESIGNER_STATE_KEY }