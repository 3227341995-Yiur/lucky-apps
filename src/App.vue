<script setup>
import { inject, ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DynamicTable from '@/components/DynamicTable.vue'
import ConfigEditor from '@/components/ConfigEditor.vue'
import TemplateDesigner from '@/components/TemplateDesigner/index.vue'
import ExportTemplateList from '@/components/TemplateDesigner/ExportTemplateList.vue'
import { initDatabase, loadAllReports, saveReport, deleteReportById } from '@/services/database'
import { ensureDefaultTemplate, getDefaultTemplate } from '@/services/templateService'
import { generateId } from '@/utils/idGenerator'
import { renderHtml, renderMarkdown } from '@/utils/templateRenderer'

const $modal = inject('$modal')

// 状态管理v
const reports = ref([])
const currentReportId = ref(null)
const currentReport = ref(null)
const showSaveIndicator = ref(false)
const dbReady = ref(false)

// 计算总工作项数
const totalItems = computed(() => {
  return reports.value.reduce((total, report) => {
    // 遍历每个报表的所有sections
    return total + report.sections.reduce((sectionTotal, section) => {
      // 累加每个section的items数量
      return sectionTotal + (section.items?.length || 0)
    }, 0)
  }, 0)
})

// 初始化
onMounted(async () => {
  try {
    await initDatabase()
    await ensureDefaultTemplate()
    dbReady.value = true
    await loadReports()
  } catch (error) {
    ElMessage.error('初始化失败: ' + (error?.message || String(error)))
  }

  // 注册 Ctrl+P 快捷键打开模板设计器
  document.addEventListener('keydown', handleGlobalKeydown)
})

// 加载周报数据
const loadReports = async () => {
  const savedReports = await loadAllReports()
  if (savedReports && savedReports.length > 0) {
    reports.value = _.sortBy(savedReports, o => -o.id)
  }
}

// 保存周报数据
const saveReports = async () => {
  if (!dbReady.value) return
  for (const report of reports.value) {
    await saveReport(report)
  }
}

// 选择周报
const selectReport = (id) => {
  currentReportId.value = id
  const report = reports.value.find(r => r.id === id)
  if (report) {
    currentReport.value = report
  }
}

// 创建新周报
const createNewReport = async () => {
  let config = []

  try {
    // 尝试读取配置
    const savedConfig = localStorage.getItem('reportConfig') || configStringify(defaultConfig)

    // 使用eval解析配置
    config = eval(`(${savedConfig})`)
  } catch (e) {
    ElMessage.error('配置解析失败，使用默认配置')
    // 使用eval解析默认配置
    try {
      config = defaultConfig
    } catch (e2) {
      ElMessage.error('默认配置解析失败')
    }
  }

  // 计算日期范围
  const today = new Date()
  const dayOfWeek = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const formatDate = (date) => moment(date).format('YYYY-MM-DD')

  const newReport = {
    id: new Date().getTime(),
    title: `工作周报 - ${formatDate(monday)} ~ ${formatDate(sunday)}`,
    dateRange: [formatDate(monday), formatDate(sunday)],
    sections: config
  }

  reports.value = [newReport, ...reports.value]
  await saveReports()
  selectReport(newReport.id)
}

// 格式化日期范围显示
const formatDateRange = (dateRange) => {
  if (Array.isArray(dateRange) && dateRange.length === 2) {
    return dateRange.join(' ~ ')
  }
  return dateRange
}

// 删除周报
const deleteReport = async (id) => {
  ElMessageBox.confirm(
      '确定要删除此周报吗？此操作不可恢复',
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
  ).then(async () => {
    const index = reports.value.findIndex(r => r.id === id)
    if (index !== -1) {
      reports.value.splice(index, 1)
      await deleteReportById(id)

      if (currentReportId.value === id) {
        currentReportId.value = null
        currentReport.value = null
        if (reports.value.length > 0) {
          selectReport(reports.value[0].id)
        }
      }

      ElMessage.success('周报已删除')
    }
  }).catch(() => {
  })
}

// 使用lodash的debounce优化自动保存
const autoSaveActual = async () => {
  if (!currentReport.value || !dbReady.value) return
  await saveReports()

  // 显示保存指示器
  showSaveIndicator.value = true
  setTimeout(() => {
    showSaveIndicator.value = false
  }, 2000)
}

// 创建防抖函数（500毫秒）
const autoSave = _.debounce(autoSaveActual, 500)

// 组件卸载时取消防抖
onUnmounted(() => {
  autoSave.cancel()
  document.removeEventListener('keydown', handleGlobalKeydown)
})

// 全局快捷键处理
const handleGlobalKeydown = (e) => {
  if (e.ctrlKey && e.key === 'p') {
    e.preventDefault()
    openTemplateDesigner()
  }
}

const openTemplateDesigner = () => {
  const templateListInstance = $modal.open(ExportTemplateList, {
    attrs: {},
    listeners: {
      edit: (template) => {
        $modal.open(TemplateDesigner, {
          attrs: { templateId: template.id },
          listeners: {
            close: () => {
              // 关闭设计师后刷新列表
              templateListInstance.loadTemplates()
            }
          }
        })
      },
      add: (template) => {
        $modal.open(TemplateDesigner, {
          attrs: { template },
          listeners: {
            close: () => {
              templateListInstance.loadTemplates()
            }
          }
        })
      }
    }
  })
}

// 复制内容
const copyContent = async (e) => {
  if (!currentReport.value) return

  const isMarkdown = e.shiftKey
  const templateType = isMarkdown ? 'markdown' : 'html'

  // 获取活动模板（按类型获取默认模板）
  const template = await getDefaultTemplate(templateType)
  if (!template || !template.template) {
    ElMessage.error('未找到模板配置')
    return
  }

  // 准备报告数据
  const reportData = {
    title: currentReport.value.title,
    dateRange: formatDateRange(currentReport.value.dateRange),
    sections: currentReport.value.sections || []
  }

  try {
    let content
    if (isMarkdown) {
      content = renderMarkdown(reportData, template.template)
    } else {
      content = renderHtml(reportData, template.template)
    }

    const textArea = document.createElement('textarea')
    textArea.value = content
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      ElMessage.success(isMarkdown ? '周报内容(Markdown格式)已复制到剪贴板' : '周报内容已复制到剪贴板')
    } catch (err) {
      ElMessage.error('复制失败')
    }
    document.body.removeChild(textArea)
  } catch (err) {
    console.error('渲染失败:', err)
    ElMessage.error('渲染失败: ' + err.message)
  }
}

// 修改配置 - 打开ConfigEditor
const modifyConfig = () => {
  const config = eval(localStorage.getItem('reportConfig') || configStringify(defaultConfig))
  $modal.open(ConfigEditor, {
    attrs: { config, mode: 'edit' },
    listeners: {
      save: (data) => {
        localStorage.setItem('reportConfig', configStringify(data))
        ElMessage.success('配置已保存')
      }
    }
  })
}

// 查看默认配置
const showConfig = () => {
  // 使用eval解析默认配置
  const config = eval(localStorage.getItem('reportConfig') || configStringify(defaultConfig))

  // 打开编辑器进行查看
  $modal.open(ConfigEditor, {
    attrs: {
      config: config,
      mode: 'view'
    }
  })
}

// 清空配置
const clearConfig = () => {
  localStorage.removeItem('reportConfig')
  ElMessage.success('配置已清空')
}

// 导入周报
const importWeekly = () => {
  if (!currentReport.value) {
    return ElMessage.warning('请选择周报在进行操作！')
  }
  // 打开编辑器进行查看
  const currentModal = $modal.open({
    props: ['modelValue'],
    emits: ['save'],
    template: `
      <base-dialog
          title="导入周报"
          width="80%"
          align-center
      >
        <code-editor v-model="value" language="json" />
        <template #footer>
          <el-button type="primary" @click="$emit('save', value)">保存</el-button>
        </template>
      </base-dialog>
    `,
    data() {
      return {
        value: this.modelValue
      }
    },
  }, {
    attrs: {
      modelValue: JSON.stringify(currentReport.value, null, 2)
    },
    listeners: {
      save(data) {
        if (data) {
          currentReport.value = JSON.parse(data)
          const index = reports.value.findIndex(f => f.id === currentReport.value.id)
          reports.value[index] = currentReport.value
          autoSave()
          currentModal.close()
        }
      }
    }
  })
}

// 导出周报
const exportWeekly = () => {
  if (!currentReport.value) {
    return ElMessage.warning('请选择周报在进行操作！')
  }

  // 生成文件名（使用周报标题+日期）
  const fileName = `${currentReport.value.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`

  // 创建JSON Blob
  const jsonData = JSON.stringify(currentReport.value, null, 2)
  const blob = new Blob([jsonData], { type: 'application/json' })

  // 创建下载链接
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)

  // 触发下载
  link.click()

  // 清理
  setTimeout(() => {
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    ElMessage.success('周报已导出为JSON文件')
  }, 100)
}

// 配置字符串化
const configStringify = (config) => {
  return `[
    ${config.map(item => {
    return `{
      type: '${item.type}',
      title: '${item.title}',
      icon: '${item.icon}',
      hasExpandColumn: ${JSON.stringify(item.hasExpandColumn)},
      columns: [
      ${item.columns.map(col => {
      return `{
        prop: '${col.prop}',
        label: '${col.label}',
        width: ${col.width},
        component: ${JSON.stringify(col.component)},
        fixed: ${col.fixed},
        defaultValue: ${JSON.stringify(col.defaultValue)},
        attrs: {
        ${Object.entries(col.attrs || {}).map(([key, value]) => {
          return `${key}: ${JSON.stringify(value)}`
        }).join(',')}
        }
      }`
      }).join(',')}],
      items: [{id: generateId()}]
    }`
    }).join(',')}
  ]`
}

// 使用配置或默认配置
const defaultConfig = [
  {
    type: 'completed',
    title: '本周完成',
    icon: 'fas fa-check-circle',
    columns: [
      {
        prop: 'title',
        label: '标题',
        fixed: true
      },
      {
        prop: 'status',
        label: '状态',
        fixed: true,
        component: 'status-selector',
        defaultValue: "开发中",
        attrs: {options: ['开发中', '待测试', '已完成']}
      }
    ],
    items: [{id: generateId()}]
  },
  {
    type: 'support',
    title: '开发支持',
    icon: 'fas fa-headset',
    columns: [
      {
        prop: 'title',
        label: '标题',
        fixed: true
      },
      {
        prop: 'date',
        label: '日期',
        fixed: true,
        component: 'date-selector',
        defaultValue: "moment().format('YYYY-MM-DD')"
      }
    ],
    items: [{id: generateId()}],
    hasExpandColumn: true
  },
  {
    type: 'plan',
    title: '下周计划',
    icon: 'fas fa-calendar-week',
    columns: [
      {
        prop: 'title',
        label: '标题',
        fixed: true
      }
    ],
    items: [{id: generateId()}]
  }
]

window.selectReport = selectReport
window.getReports = () => reports.value
</script>

<template
  v-contextmenu:config
  @contextmenu-config-modify="modifyConfig"
  @contextmenu-config-show="showConfig"
  @contextmenu-config-clear="clearConfig"
  @contextmenu-config-weekly-import="importWeekly"
  @contextmenu-config-weekly-export="exportWeekly"
>
  <!-- 左侧边栏 -->
  <div class="sidebar">
    <div class="sidebar-header">
      <div class="logo-container">
        <div class="logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M3 19V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19Z"
                stroke="white" stroke-width="2"/>
            <path d="M8 8H16" stroke="white" stroke-width="2" stroke-linecap="round"/>
            <path d="M8 12H16" stroke="white" stroke-width="2" stroke-linecap="round"/>
            <path d="M8 16H13" stroke="white" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="logo-text">周报管理系统</div>
      </div>
      <el-button type="primary" @click="createNewReport" style="width: 100%">
        <i class="fas fa-plus"></i><span>创建新周报</span>
      </el-button>
    </div>
    <div class="sidebar-content">
      <el-scrollbar>
        <div
            v-for="report in reports"
            :key="report.id"
            class="report-item"
            :class="{ active: currentReportId === report.id }"
            @click="selectReport(report.id)"
        >
          <div class="report-date">{{ formatDateRange(report.dateRange) }}</div>
          <div class="report-title">
            <i class="fas fa-book"></i><span>{{ report.title }}</span>
          </div>
          <div class="report-actions">
            <el-button
                type="danger"
                size="small"
                @click.stop="deleteReport(report.id)"
                class="action-text-button"
            ><i class="fas fa-trash"></i><span>删除</span>
            </el-button>
          </div>
        </div>

        <div v-if="reports.length === 0" class="empty-state">
          <el-empty class="empty-text" description="暂无周报记录"/>
        </div>
      </el-scrollbar>
    </div>
  </div>

  <!-- 右侧主内容区 -->
  <div class="main-content">
    <template v-if="currentReport">
      <div class="content-header">
        <div class="header-left">
          <div class="report-header-title">
            <input v-model="currentReport.title" placeholder="请输入周报标题" @input="autoSave">
          </div>
          <div class="report-header-date">
            <span>日期范围：</span>
            <div class="date-range-picker">
              <el-date-picker
                  v-model="currentReport.dateRange"
                  type="daterange"
                  range-separator="至"
                  start-placeholder="开始日期"
                  end-placeholder="结束日期"
                  value-format="YYYY-MM-DD"
                  @change="autoSave"
              />
            </div>
          </div>
        </div>
        <div class="header-actions">
          <el-tooltip content="按住[shift]获取md内容">
            <el-button type="primary" size="large" @click="copyContent">
              <i class="fas fa-copy"></i><span>复制内容</span>
            </el-button>
          </el-tooltip>
        </div>
      </div>

      <el-scrollbar class="content-body">
        <template v-for="(section, index) in currentReport.sections" :key="index">
          <dynamic-table
              :section-type="section.type"
              :title="section.title"
              :icon="section.icon"
              :has-expand-column="section.hasExpandColumn"
              v-model:columns="section.columns"
              v-model:items="section.items"
              @auto-save="autoSave"
          ></dynamic-table>
        </template>
      </el-scrollbar>
    </template>
    <template v-else>
      <el-scrollbar class="welcome-container">
        <h1 class="welcome-title">欢迎使用周报管理系统</h1>
        <p class="welcome-text">高效、简洁、易用的周报管理工具，帮助您轻松完成团队工作汇报</p>

        <div class="stats-container">
          <div class="stat-card">
            <div class="stat-value">{{ reports.length }}</div>
            <div class="stat-label">已创建周报</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ totalItems }}</div>
            <div class="stat-label">总工作项</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">100%</div>
            <div class="stat-label">用户满意度</div>
          </div>
        </div>

        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon"><i class="fas fa-table"></i></div>
            <h3 class="feature-title">动态表格</h3>
            <p class="feature-description">灵活自定义表格列，满足不同场景需求，支持多种数据类型</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon"><i class="fas fa-edit"></i></div>
            <h3 class="feature-title">Markdown编辑</h3>
            <p class="feature-description">强大的富文本编辑器，支持Markdown语法和图片上传</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon"><i class="fas fa-sync"></i></div>
            <h3 class="feature-title">自动保存</h3>
            <p class="feature-description">实时保存您的编辑内容，无需担心数据丢失</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon"><i class="fas fa-clipboard"></i></div>
            <h3 class="feature-title">一键复制</h3>
            <p class="feature-description">轻松生成美观的HTML格式周报，一键复制分享</p>
          </div>
        </div>
      </el-scrollbar>
    </template>
  </div>

  <!-- 自动保存指示器 -->
  <div class="auto-save-indicator" :class="{ visible: showSaveIndicator }">
    <i class="fas fa-check-circle"></i><span>自动保存成功</span>
  </div>
</template>

<style scoped>

</style>
