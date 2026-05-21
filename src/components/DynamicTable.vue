<script setup>
import { inject, defineProps, defineEmits, ref, nextTick, onUpdated } from 'vue'
import { ElMessage } from 'element-plus'
import ComponentSelector from '@/components/ComponentSelector.vue'

const props = defineProps({
  sectionType: String,
  title: String,
  icon: String,
  columns: Array,
  items: Array,
  hasExpandColumn: {
    type: Boolean,
    default: false
  }
})

onUpdated(() => {
  props.columns.forEach(col => {
    if (!props.items[0][col.prop] && col.defaultValue) {
      try {
        props.items[0][col.prop] = eval(col.defaultValue)
      } catch (e) {
        props.items[0][col.prop] = col.defaultValue
      }
    }
  })
})

const emit = defineEmits(['auto-save'])

const $modal = inject('$modal')

const expands = ref([])

// 添加新项
const addItem = () => {
  const newItem = {
    id: new Date().getTime() + Math.random().toString(36).substr(2, 9)
  }

  // 添加动态列
  props.columns.forEach(col => {
    if (!newItem[col.prop] && col.defaultValue) {
      try {
        newItem[col.prop] = eval(col.defaultValue)
      } catch (e) {
        newItem[col.prop] = col.defaultValue
      }
    }
  })

  const newItems = [...props.items, newItem]
  emit('update:items', newItems)
  emit('auto-save')
}

// 删除项
const removeItem = (index) => {
  const newItems = [...props.items]
  newItems.splice(index, 1)
  emit('update:items', newItems)
  emit('auto-save')
}

// 添加列
const addColumn = () => {
  const columnName = `column${new Date().getTime() + Math.random().toString(36).substr(2, 9)}`
  const columnLabel = `新列${props.columns.length + 1}`

  const newColumns = [...props.columns, {
    prop: columnName,
    label: columnLabel,
    fixed: false
  }]

  // 更新所有项
  const newItems = props.items.map(item => {
    if (!item[columnName]) {
      return {...item, [columnName]: ''}
    }
    return item
  })

  emit('update:columns', newColumns)
  emit('update:items', newItems)
  emit('auto-save')
}

// 编辑列标签
const editColumnLabel = async (index) => {
  const newColumns = [...props.columns]
  newColumns[index].editing = true
  await nextTick()

  // 获取输入框引用并设置焦点
  const inputId = `input-${props.sectionType}-${props.columns[index].prop}-${index}`
  const inputEl = document.getElementById(inputId)
  if (inputEl) {
    inputEl.focus()
  }
}

// 完成列标签编辑
const finishEditColumn = (index) => {
  const newColumns = [...props.columns]
  newColumns[index].editing = false
  emit('auto-save')
}

// 移除列
const removeColumn = (index) => {
  if (props.columns[index].fixed) {
    ElMessage.warning('初始列不能删除')
    return
  }

  const newColumns = [...props.columns]
  newColumns.splice(index, 1)

  emit('update:columns', newColumns)
  emit('auto-save')
}

// 更新展开的行状态
const handleExpandChange = (row) => {
  if (expands.value.length > 0 && expands.value.includes(row.id)) {
    expands.value = []
  } else {
    expands.value = [row.id]
  }
}

// 更换列组件
const changeColumnComponent = (colIndex) => {
  const column = props.columns[colIndex]

  $modal.open(ComponentSelector, {
    attrs: {
      'column': column
    },
    listeners: {
      select: (data) => {
        const newColumns = [...props.columns]
        newColumns[colIndex] = data
        column.component = data.component
        emit('update:columns', newColumns)
        emit('auto-save')
      }
    }
  })
}
</script>

<template>
  <div class="section-container">
    <div class="section-header">
      <div class="section-title">
        <i :class="icon"></i><span>{{ title }}</span>
      </div>
      <div class="section-actions">
        <el-button type="primary" @click="addColumn" size="small">
          <i class="fas fa-columns"></i><span>添加列</span>
        </el-button>
        <el-button type="primary" @click="addItem" size="small">
          <i class="fas fa-plus"></i><span>添加记录</span>
        </el-button>
      </div>
    </div>
    <div class="table-container">
      <div class="table-header">
        <div class="column-manager">
          <el-tag
              v-for="(col, index) in columns"
              :key="index"
              :closable="!col.fixed"
              @close="removeColumn(index)"
          >
            <span
                @dblclick="tag => editColumnLabel(index)"
                v-if="!col.editing"
            >{{ col.label }}</span>
            <el-input
                v-else
                :id="'input-' + sectionType + '-' + col.prop + '-' + index"
                v-model="col.label"
                size="small"
                @blur="finishEditColumn(index)"
                @keyup.enter="finishEditColumn(index)"
            />
          </el-tag>
        </div>
      </div>

      <el-table
          ref="dynamicTable"
          row-key="id"
          :data="items"
          border
          :expand-row-keys="expands"
          style="width: 100%"
          @expand-change="handleExpandChange"
      >
        <!-- 展开列 -->
        <el-table-column v-if="hasExpandColumn" type="expand" width="60">
          <template #default="props">
            <markdown-editor
                :id="'vditor-container-'+props.row.id"
                v-model="props.row"
                @update:modelValue="$emit('auto-save')"
            />
          </template>
        </el-table-column>

        <!-- 序号列 -->
        <el-table-column v-if="!hasExpandColumn" type="index" width="60" label="序号" align="center"/>

        <!-- 动态列 -->
        <el-table-column
            v-for="(col, colIndex) in columns"
            :key="colIndex"
            :prop="col.prop"
            :label="col.label"
            :width="col.width"
        >
          <template #header="scope">
            <div
                v-contextmenu:column
                @contextmenu-column-change-component="changeColumnComponent(colIndex)"
            >{{ scope.column.label }}</div>
          </template>
          <template #default="scope">
            <div class="component-wrapper">
              <component
                  v-if="col.component"
                  :is="col.component"
                  v-model="scope.row[col.prop]"
                  v-bind="col.attrs"
                  @update:modelValue="$emit('auto-save')"
              />
              <el-input
                  v-else
                  v-model="scope.row[col.prop]"
                  placeholder="请输入内容"
                  size="small"
                  @input="$emit('auto-save')"
              />
            </div>
          </template>
        </el-table-column>

        <!-- 操作列 -->
        <el-table-column label="操作" width="80" align="center">
          <template #default="scope">
            <el-button
                type="danger"
                size="small"
                class="action-text-button"
                circle
                @click="removeItem(scope.$index)"
            ><i class="fas fa-trash"></i></el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped>

</style>