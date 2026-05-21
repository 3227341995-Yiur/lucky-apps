<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAllTemplates, deleteTemplate, setDefaultTemplate, createTemplate } from '@/services/templateService'
import BaseDialog from '@/components/BaseDialog.vue'

const emit = defineEmits(['edit', 'close', 'add'])

const templates = ref([])
const loading = ref(false)
const selectedId = ref(null)
const editingId = ref(null)
const editingName = ref('')

const loadTemplates = async () => {
  loading.value = true
  try {
    templates.value = await getAllTemplates()
  } catch (e) {
    ElMessage.error('加载模板失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadTemplates()
})

const handleEditName = (template) => {
  editingId.value = template.id
  editingName.value = template.name
}

const handleSaveName = async (template) => {
  if (!editingName.value.trim()) {
    editingId.value = null
    return
  }
  try {
    const { saveTemplate } = await import('@/services/templateService')
    template.name = editingName.value.trim()
    await saveTemplate(template)
    await loadTemplates()
  } catch (e) {
    ElMessage.error('保存失败')
  }
  editingId.value = null
}

const handleEdit = (template) => {
  emit('edit', template)
}

const handleDelete = async (template) => {
  if (template.isSystem) {
    ElMessage.warning('系统模板不能删除')
    return
  }
  try {
    await ElMessageBox.confirm(`确定要删除模板"${template.name}"吗？`, '删除确认', { type: 'warning' })
    await deleteTemplate(template.id)
    await loadTemplates()
    ElMessage.success('删除成功')
  } catch {}
}

const handleSetDefault = async (template) => {
  try {
    await setDefaultTemplate(template.id, template.type)
    await loadTemplates()
    ElMessage.success('已设为默认模板')
  } catch {
    ElMessage.error('设置失败')
  }
}

const handleCreate = async () => {
  try {
    const newTpl = createTemplate(`新模板${templates.value.length + 1}`, 'html')
    emit('add', newTpl)
  } catch (e) {
    ElMessage.error('创建模板失败')
  }
}

const handleCopy = async (template) => {
  try {
    const newTpl = createTemplate(`${template.name} (副本)`, template.type, template.template)
    emit('add', newTpl)
  } catch (e) {
    ElMessage.error('复制失败')
  }
}

defineExpose({ loadTemplates })
</script>

<template>
  <base-dialog
    title="导出模板"
    width="800px"
    align-center
    @close="$emit('close')"
  >
    <div class="template-body">
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="templates.length === 0" class="empty-state">
        <i class="fas fa-folder-open"></i>
        <p>暂无导出模板</p>
      </div>
      <div v-else class="template-grid">
        <div
          v-for="template in templates"
          :key="template.id"
          class="template-card"
          :class="{ selected: selectedId === template.id, 'is-default': template.isDefault }"
          @click="selectedId = template.id"
        >
          <div class="card-header">
            <input
              v-if="editingId === template.id"
              v-model="editingName"
              class="title-input"
              @blur="handleSaveName(template)"
              @keyup.enter="handleSaveName(template)"
              @click.stop
              autofocus
            />
            <span v-else class="template-name" @click.stop="handleEditName(template)">{{ template.name }}</span>
            <span v-if="template.isDefault" class="default-badge">默认</span>
          </div>
          <div class="card-meta">类型: {{ template.type === 'html' ? 'HTML' : 'Markdown' }}</div>
          <div class="card-actions">
            <el-link v-if="!template.isSystem" :underline="false" @click.stop="handleEdit(template)" title="编辑">
              <i class="fas fa-edit"></i>
            </el-link>
            <el-link :underline="false" @click.stop="handleCopy(template)" title="复制">
              <i class="fas fa-copy"></i>
            </el-link>
            <el-link :underline="false" @click.stop="handleSetDefault(template)" title="设为默认">
              <i class="fas fa-star"></i>
            </el-link>
            <el-link v-if="!template.isSystem" :underline="false" @click.stop="handleDelete(template)" title="删除">
              <i class="fas fa-trash"></i>
            </el-link>
          </div>
        </div>
      </div>
    </div>

    <template #actions>
      <el-button type="primary" @click="handleCreate">
        <i class="fas fa-plus"></i><span>新建模板</span>
      </el-button>
    </template>
  </base-dialog>
</template>

<style scoped>
.template-body {
  padding: 20px;
}
.loading { text-align: center; padding: 40px; color: #909399; }
.empty-state { text-align: center; padding: 60px 20px; color: #909399; }
.empty-state i { font-size: 64px; margin-bottom: 16px; color: #dcdfe6; }
.template-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.template-card {
  background: #f5f7fa;
  border: 2px solid transparent;
  border-radius: 10px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.template-card:hover { border-color: rgba(64, 158, 255, 0.3); background: #e6eff9; }
.template-card.selected { border-color: var(--primary-color, #409EFF); background: #d9ecff; }
.template-card.is-default { border-color: #67c23a; }
.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.template-name {
  font-weight: 600;
  font-size: 15px;
  color: #333;
  cursor: text;
  padding: 2px 4px;
  border-radius: 4px;
}
.template-name:hover {
  background: #e6eff9;
}
.title-input {
  font-weight: 600;
  font-size: 15px;
  color: #333;
  padding: 2px 4px;
  border: none;
  outline: none;
  background: transparent;
  width: 150px;
}
.default-badge { font-size: 10px; padding: 2px 6px; background: #67c23a; color: white; border-radius: 4px; }
.card-meta { font-size: 12px; color: #909399; margin-bottom: 12px; }
.card-actions { display: flex; gap: 8px; }
</style>