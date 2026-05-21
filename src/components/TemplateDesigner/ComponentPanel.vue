<script setup>
const props = defineProps({
  onDragStart: Function
})

// Element Plus 基础组件
const basicComponents = [
  { name: 'el-button', label: '按钮', icon: 'fa-solid fa-square' },
  { name: 'el-input', label: '输入框', icon: 'fa-solid fa-pen-to-square' },
  { name: 'el-select', label: '选择器', icon: 'fa-solid fa-list' },
  { name: 'el-switch', label: '开关', icon: 'fa-solid fa-toggle-on' },
  { name: 'el-slider', label: '滑块', icon: 'fa-solid fa-sliders' },
  { name: 'el-date-picker', label: '日期选择', icon: 'fa-solid fa-calendar' },
  { name: 'el-time-picker', label: '时间选择', icon: 'fa-solid fa-clock' },
  { name: 'el-color-picker', label: '颜色选择', icon: 'fa-solid fa-palette' },
]

// 业务组件
const businessComponents = [
  { name: 'el-table', label: '表格', icon: 'fa-solid fa-table' },
  { name: 'el-tabs', label: '标签页', icon: 'fa-solid fa-folder-tree' },
  { name: 'el-collapse', label: '折叠面板', icon: 'fa-solid fa-layer-group' },
  { name: 'el-card', label: '卡片', icon: 'fa-solid fa-id-card' },
  { name: 'el-descriptions', label: '描述列表', icon: 'fa-solid fa-list-ul' },
  { name: 'el-tag', label: '标签', icon: 'fa-solid fa-tag' },
  { name: 'el-badge', label: '徽章', icon: 'fa-solid fa-circle-exclamation' },
  { name: 'el-progress', label: '进度条', icon: 'fa-solid fa-spinner' },
]

// 布局组件
const layoutComponents = [
  { name: 'el-row', label: '行', icon: 'fa-solid fa-rows' },
  { name: 'el-col', label: '列', icon: 'fa-solid fa-columns' },
  { name: 'el-space', label: '间距', icon: 'fa-solid fa-arrows-alt' },
  { name: 'el-divider', label: '分割线', icon: 'fa-solid fa-minus' },
  { name: 'el-container', label: '容器', icon: 'fa-solid fa-square' },
  { name: 'el-header', label: '头部', icon: 'fa-solid fa-chevron-up' },
  { name: 'el-aside', label: '侧边', icon: 'fa-solid fa-chevron-left' },
  { name: 'el-main', label: '主体', icon: 'fa-solid fa-th-large' },
]

// Handlebars 表达式组件
const handlebarsComponents = [
  { name: '{{#if}}', label: '条件判断', icon: 'fa-solid fa-code-branch', isHandlebars: true },
  { name: '{{#each}}', label: '循环', icon: 'fa-solid fa-repeat', isHandlebars: true },
  { name: '{{#with}}', label: '上下文', icon: 'fa-solid fa-brackets-curly', isHandlebars: true },
  { name: '{{lookup}}', label: '查找', icon: 'fa-solid fa-magnifying-glass', isHandlebars: true },
  { name: '{{else}}', label: '否则', icon: 'fa-solid fa-arrow-right', isHandlebars: true },
]

const handleDragStart = (e, component) => {
  e.dataTransfer.setData('component', JSON.stringify(component))
  e.dataTransfer.effectAllowed = 'copy'
  props.onDragStart?.(component)
}
</script>

<template>
  <div class="component-panel">
    <div class="panel-title">组件面板</div>

    <el-collapse>
      <el-collapse-item title="基础组件" name="basic">
        <div class="component-grid">
          <div
            v-for="comp in basicComponents"
            :key="comp.name"
            class="component-item"
            draggable="true"
            @dragstart="handleDragStart($event, comp)"
          >
            <i :class="comp.icon"></i>
            <span>{{ comp.label }}</span>
          </div>
        </div>
      </el-collapse-item>

      <el-collapse-item title="业务组件" name="business">
        <div class="component-grid">
          <div
            v-for="comp in businessComponents"
            :key="comp.name"
            class="component-item"
            draggable="true"
            @dragstart="handleDragStart($event, comp)"
          >
            <i :class="comp.icon"></i>
            <span>{{ comp.label }}</span>
          </div>
        </div>
      </el-collapse-item>

      <el-collapse-item title="布局组件" name="layout">
        <div class="component-grid">
          <div
            v-for="comp in layoutComponents"
            :key="comp.name"
            class="component-item"
            draggable="true"
            @dragstart="handleDragStart($event, comp)"
          >
            <i :class="comp.icon"></i>
            <span>{{ comp.label }}</span>
          </div>
        </div>
      </el-collapse-item>

      <el-collapse-item title="Handlebars 表达式" name="handlebars">
        <div class="component-grid">
          <div
            v-for="comp in handlebarsComponents"
            :key="comp.name"
            class="component-item handlebars"
            draggable="true"
            @dragstart="handleDragStart($event, comp)"
          >
            <i :class="comp.icon"></i>
            <span>{{ comp.label }}</span>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<style scoped>
.component-panel {
  width: 200px;
  height: 100%;
  background: #f5f7fa;
  border-right: 1px solid #e6e8eb;
  overflow-y: auto;
}

.panel-title {
  padding: 12px 16px;
  font-weight: 600;
  font-size: 14px;
  color: #303133;
  border-bottom: 1px solid #e6e8eb;
}

.component-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding: 8px;
}

.component-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 4px;
  background: white;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: move;
  font-size: 11px;
  color: #606266;
  transition: all 0.2s;
}

.component-item:hover {
  border-color: #409eff;
  color: #409eff;
  background: #ecf5ff;
}

.component-item i {
  font-size: 16px;
  margin-bottom: 4px;
}

.component-item.handlebars {
  background: #fdf6ec;
  border-color: #f5dab1;
  color: #e6a23c;
}

.component-item.handlebars:hover {
  background: #fef0e6;
  border-color: #e6a23c;
}
</style>
