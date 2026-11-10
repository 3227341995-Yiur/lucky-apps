<script setup>
import { computed, ref, watch } from 'vue'

defineOptions({ name: 'ElementWidget' })

const props = defineProps({
  element: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:modelValue'])

const elementProps = computed(() => props.element.props || {})
const component = computed(() => props.element.component || 'el-button')
const text = computed(() => props.element.text || '')

const model = ref(elementProps.value.modelValue ?? '')
watch(() => elementProps.value.modelValue, value => { model.value = value })
watch(model, value => emit('update:modelValue', value))

const options = computed(() => {
  const list = elementProps.value.options
  return Array.isArray(list) && list.length ? list : ['选项一', '选项二', '选项三']
})

const tableColumns = computed(() => {
  const list = elementProps.value.columns
  return Array.isArray(list) && list.length ? list : ['名称', '状态']
})

const tableData = computed(() => {
  const list = elementProps.value.data
  if (Array.isArray(list) && list.length) {
    return list.map((row, index) => {
      if (Array.isArray(row)) {
        const record = { _id: index }
        tableColumns.value.forEach((column, i) => { record[`c${i}`] = row[i] })
        return record
      }
      return { ...row, _id: index }
    })
  }
  return [{ _id: 0, c0: '示例 A', c1: '完成' }, { _id: 1, c0: '示例 B', c1: '进行中' }]
})

function columnKey(column, index) {
  return Array.isArray(column) ? `c${index}` : column
}

function columnLabel(column) {
  if (Array.isArray(column)) return String(column[1] || column[0] || '')
  return String(column)
}

const passProps = computed(() => {
  const { modelValue, options: _options, columns: _columns, data: _data, ...rest } = elementProps.value
  return rest
})
</script>

<template>
  <div class="el-widget" :class="`is-${component}`">
    <el-button
      v-if="component === 'el-button'"
      :type="elementProps.type || 'primary'"
      :plain="elementProps.plain"
      :round="elementProps.round"
    >{{ text || '按钮' }}</el-button>

    <el-input
      v-else-if="component === 'el-input'"
      v-model="model"
      :placeholder="elementProps.placeholder || '请输入内容'"
      v-bind="passProps"
    />

    <el-select
      v-else-if="component === 'el-select'"
      v-model="model"
      :placeholder="elementProps.placeholder || '请选择'"
      v-bind="passProps"
    >
      <el-option v-for="option in options" :key="option" :label="option" :value="option" />
    </el-select>

    <el-date-picker
      v-else-if="component === 'el-date-picker'"
      v-model="model"
      type="date"
      :placeholder="elementProps.placeholder || '选择日期'"
      value-format="YYYY-MM-DD"
    />

    <el-input-number
      v-else-if="component === 'el-input-number'"
      v-model="model"
      :min="elementProps.min ?? 0"
      :max="elementProps.max ?? 100"
      controls-position="right"
    />

    <el-switch
      v-else-if="component === 'el-switch'"
      v-model="model"
    />

    <el-slider
      v-else-if="component === 'el-slider'"
      v-model="model"
      :min="elementProps.min ?? 0"
      :max="elementProps.max ?? 100"
    />

    <el-rate
      v-else-if="component === 'el-rate'"
      v-model="model"
    />

    <el-tag
      v-else-if="component === 'el-tag'"
      :type="elementProps.type || 'primary'"
    >{{ text || '标签' }}</el-tag>

    <el-progress
      v-else-if="component === 'el-progress'"
      :percentage="Number(elementProps.percentage) || 0"
      :stroke-width="8"
    />

    <el-alert
      v-else-if="component === 'el-alert'"
      :title="text || '提示信息'"
      :type="elementProps.type || 'info'"
      :closable="false"
    />

    <el-card
      v-else-if="component === 'el-card'"
      :header="elementProps.header || '卡片标题'"
      shadow="never"
    >
      <div class="el-widget-card-text">{{ text }}</div>
    </el-card>

    <el-divider v-else-if="component === 'el-divider'" />

    <el-table
      v-else-if="component === 'el-table'"
      :data="tableData"
      size="small"
      border
      class="el-widget-table"
    >
      <el-table-column
        v-for="(column, index) in tableColumns"
        :key="index"
        :prop="columnKey(column, index)"
        :label="columnLabel(column)"
      />
    </el-table>

    <el-avatar
      v-else-if="component === 'el-avatar'"
      :size="elementProps.size || undefined"
    >{{ text || 'W' }}</el-avatar>

    <el-badge
      v-else-if="component === 'el-badge'"
      :value="elementProps.value ?? 5"
    >
      <span class="el-widget-badge-text">{{ text || '消息' }}</span>
    </el-badge>

    <el-tabs v-else-if="component === 'el-tabs'" v-bind="passProps">
      <el-tab-pane label="标签一" name="1">内容一</el-tab-pane>
      <el-tab-pane label="标签二" name="2">内容二</el-tab-pane>
    </el-tabs>

    <el-menu v-else-if="component === 'el-menu'" mode="horizontal" :ellipsis="false" v-bind="passProps">
      <el-menu-item index="1">菜单一</el-menu-item>
      <el-menu-item index="2">菜单二</el-menu-item>
    </el-menu>

    <el-breadcrumb v-else-if="component === 'el-breadcrumb'" separator="/" v-bind="passProps">
      <el-breadcrumb-item>首页</el-breadcrumb-item>
      <el-breadcrumb-item>列表</el-breadcrumb-item>
      <el-breadcrumb-item>详情</el-breadcrumb-item>
    </el-breadcrumb>

    <el-steps v-else-if="component === 'el-steps'" :active="1" v-bind="passProps">
      <el-step title="步骤一" />
      <el-step title="步骤二" />
      <el-step title="步骤三" />
    </el-steps>

    <el-timeline v-else-if="component === 'el-timeline'" v-bind="passProps">
      <el-timeline-item timestamp="2026-11-05" placement="top">记录内容</el-timeline-item>
      <el-timeline-item timestamp="2026-11-04" placement="top">记录内容</el-timeline-item>
    </el-timeline>

    <el-collapse v-else-if="component === 'el-collapse'" v-bind="passProps">
      <el-collapse-item title="折叠面板一" name="1">内容一</el-collapse-item>
      <el-collapse-item title="折叠面板二" name="2">内容二</el-collapse-item>
    </el-collapse>

    <el-descriptions v-else-if="component === 'el-descriptions'" :column="2" border v-bind="passProps">
      <el-descriptions-item label="名称">示例</el-descriptions-item>
      <el-descriptions-item label="状态">进行中</el-descriptions-item>
    </el-descriptions>

    <el-row v-else-if="component === 'el-row'" v-bind="passProps">
      <el-col :span="8"><div class="el-widget-cell">列一</div></el-col>
      <el-col :span="8"><div class="el-widget-cell">列二</div></el-col>
      <el-col :span="8"><div class="el-widget-cell">列三</div></el-col>
    </el-row>

    <el-space v-else-if="component === 'el-space'" wrap v-bind="passProps">
      <el-tag>标签一</el-tag>
      <el-tag type="success">标签二</el-tag>
      <el-tag type="warning">标签三</el-tag>
    </el-space>

    <el-form v-else-if="component === 'el-form'" label-width="72px" v-bind="passProps">
      <el-form-item label="名称">
        <el-input placeholder="请输入" />
      </el-form-item>
      <el-form-item label="状态">
        <el-switch />
      </el-form-item>
    </el-form>

    <el-pagination
      v-else-if="component === 'el-pagination'"
      :total="40"
      :page-size="10"
      layout="prev, pager, next"
      v-bind="passProps"
    />

    <el-result v-else-if="component === 'el-result'" icon="success" title="操作成功" sub-title="示例结果" v-bind="passProps" />

    <el-empty v-else-if="component === 'el-empty'" description="暂无数据" v-bind="passProps" />

    <el-statistic v-else-if="component === 'el-statistic'" title="统计值" :value="1024" v-bind="passProps" />

    <el-skeleton v-else-if="component === 'el-skeleton'" :rows="2" animated v-bind="passProps" />

    <component
      :is="component"
      v-else
      v-bind="passProps"
    >{{ text }}</component>
  </div>
</template>

<style scoped>
.el-widget {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-start;
  overflow: hidden;
}

.el-widget > :deep(.el-input),
.el-widget > :deep(.el-select),
.el-widget > :deep(.el-date-editor),
.el-widget > :deep(.el-input-number),
.el-widget > :deep(.el-slider),
.el-widget > :deep(.el-progress),
.el-widget > :deep(.el-card),
.el-widget > :deep(.el-table) {
  width: 100%;
}

.el-widget > :deep(.el-tabs),
.el-widget > :deep(.el-menu),
.el-widget > :deep(.el-steps),
.el-widget > :deep(.el-timeline),
.el-widget > :deep(.el-collapse),
.el-widget > :deep(.el-descriptions),
.el-widget > :deep(.el-form),
.el-widget > :deep(.el-row) {
  width: 100%;
}

.el-widget.is-el-card,
.el-widget.is-el-table,
.el-widget.is-el-tabs,
.el-widget.is-el-menu,
.el-widget.is-el-steps,
.el-widget.is-el-timeline,
.el-widget.is-el-collapse,
.el-widget.is-el-descriptions,
.el-widget.is-el-form,
.el-widget.is-el-row {
  align-items: stretch;
}

.el-widget-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  border: 1px dashed var(--el-border-color-lighter);
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.el-widget-table {
  height: 100%;
}

.el-widget-card-text {
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.el-widget-badge-text {
  font-size: 12px;
}
</style>
