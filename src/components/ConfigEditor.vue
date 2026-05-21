<script setup>
import { computed, reactive } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  config: {
    type: Array,
    required: true
  },
  mode: {
    type: String,
    default: 'view' // 'view' 或 'edit'
  }
})

const config = reactive(props.config)

const emit = defineEmits(['save', 'close'])

// 计算标题
const title = computed(() => {
  return props.mode === 'edit' ? '编辑配置' : '查看配置'
})

// 添加新报表配置
const addReportConfig = () => {
  config.push({
    type: 'new-section',
    title: '新报表配置',
    icon: 'fas fa-plus-circle',
    columns: [
      {
        prop: 'title',
        label: '标题',
        fixed: true
      }
    ],
    hasExpandColumn: false
  })
}

// 删除报表配置
const removeReportConfig = (index) => {
  if (config.length <= 1) {
    ElMessage.warning('至少需要保留一个报表配置')
    return
  }
  config.splice(index, 1)
}

// 添加新列
const addColumn = (report) => {
  report.columns.push({
    label: `新列${report.columns.length + 1}`,
    prop: `column${report.columns.length + 1}`,
    component: '',
    fixed: false,
    defaultValue: '',
    attrs: {}
  })
}

// 删除列
const removeColumn = (report, index) => {
  if (report.columns[index].fixed) {
    ElMessage.warning('固定列不能删除')
    return
  }
  report.columns.splice(index, 1)
}

// 保存配置
const saveConfig = () => {
  emit('save', config)
  handleClose()
}

// 关闭弹窗
const handleClose = () => {
  emit('close')
}
</script>

<template>
  <base-dialog
      :title="title"
      top="5vh"
      width="80%"
      :show-footer="mode === 'edit'"
      @close="handleClose"
  >
    <div class="config-editor">
      <!-- 添加报表配置按钮 -->
      <div class="add-report-config" v-if="mode === 'edit'">
        <el-button type="primary" @click="addReportConfig">
          <i class="fas fa-plus"></i><span>添加报表配置</span>
        </el-button>
      </div>

      <!-- 报表配置 -->
      <div class="section-config" v-for="(report, reportIndex) in config" :key="reportIndex">
        <div class="section-header">
          <!-- 修改后的标题编辑框 -->
          <div class="report-header-title">
            <input
                v-model="report.title"
                placeholder="请输入报表配置标题"
                :disabled="mode === 'view'"
            >
          </div>

          <!-- 删除报表配置按钮 -->
          <el-button
              v-if="mode === 'edit'"
              type="danger"
              size="small"
              @click="removeReportConfig(reportIndex)"
          >
            <i class="fas fa-trash"></i><span>删除配置</span>
          </el-button>
        </div>

        <el-form label-width="120px">
          <el-form-item label="类型">
            <el-input v-model="report.type" :disabled="mode === 'view'"></el-input>
          </el-form-item>
          <el-form-item label="图标">
            <el-input v-model="report.icon" :disabled="mode === 'view'"></el-input>
          </el-form-item>
          <el-form-item label="展开明细">
            <el-switch v-model="report.hasExpandColumn" :disabled="mode === 'view'"></el-switch>
          </el-form-item>
        </el-form>

        <!-- 列配置区域 -->
        <div class="section-header">
          <h3>列配置（按住ctrl左右滚动）</h3>
          <el-button
              v-if="mode === 'edit'"
              type="primary"
              size="small"
              @click="addColumn(report)"
          >
            <i class="fas fa-columns"></i><span>添加列</span>
          </el-button>
        </div>

        <!-- 列卡片容器（支持横向滚动） -->
        <el-scrollbar v-horizontal-scroll>
          <div class="columns-container">
            <column-card
                v-for="(column, colIndex) in report.columns"
                :key="colIndex"
                v-model="report.columns[colIndex]"
                :disabled="mode === 'view'"
            >
              <template #header>
                <el-button
                    v-if="mode === 'edit'"
                    type="danger"
                    circle
                    size="small"
                    @click="removeColumn(report, colIndex)"
                >
                  <i class="fas fa-trash"></i>
                </el-button>
              </template>
            </column-card>
          </div>
        </el-scrollbar>
      </div>
    </div>

    <template #footer>
      <el-button
          type="primary"
          @click="saveConfig"
          v-if="mode === 'edit'"
      >
        保存配置
      </el-button>
    </template>
  </base-dialog>
</template>

<style scoped>
.add-report-config {
  margin-bottom: 20px;
  text-align: center;
}

.report-header-title input {
  font-size: 20px;
  font-weight: 600;
  border: none;
  outline: none;
  padding: 5px 10px;
  border-radius: 6px;
  width: 100%;
  max-width: 600px;
  background: #f5f7fa;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 6px;
}

.config-editor {
  padding: 10px;
}

.section-config {
  margin-bottom: 25px;
  padding: 15px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background-color: #f8fafc;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.columns-container {
  display: flex;
  gap: 15px;
  padding: 10px 5px;
}
</style>