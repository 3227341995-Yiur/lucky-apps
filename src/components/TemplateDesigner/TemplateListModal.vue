<script setup>
import { ref, onMounted, inject } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'select', 'create', 'delete', 'setDefault'])

// 模板列表
const templates = ref([])
const loading = ref(false)
const selectedId = ref(null)

// 加载模板
const loadTemplates = async () => {
  // 从父组件获取
}

const handleSelect = (template) => {
  emit('select', template)
}

const handleCreate = () => {
  emit('create')
}

const handleDelete = async (template) => {
  if (template.isDefault) {
    ElMessage.warning('默认模板不能删除')
    return
  }

  try {
    await ElMessageBox.confirm(`确定要删除模板"${template.name}"吗？`, '删除确认', {
      type: 'warning'
    })
    emit('delete', template.id)
  } catch {
    // 用户取消
  }
}

const handleSetDefault = (template) => {
  emit('setDefault', template.id)
}

const handleClose = () => {
  emit('close')
}

// 接收父组件传来的数据
const setTemplates = (data) => {
  templates.value = data
}

defineExpose({ setTemplates })
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="template-list-overlay" @click.self="handleClose">
      <div class="template-list-modal">
        <div class="modal-header">
          <h2><i class="fas fa-file-alt"></i> 模板管理</h2>
          <div class="header-actions">
            <el-button type="primary" @click="handleCreate">
              <i class="fas fa-plus"></i> 新建模板
            </el-button>
            <el-button @click="handleClose">
              <i class="fas fa-times"></i> 关闭
            </el-button>
          </div>
        </div>

        <div class="modal-body">
          <div v-if="loading" class="loading">加载中...</div>

          <div v-else-if="templates.length === 0" class="empty-state">
            <i class="fas fa-folder-open"></i>
            <p>暂无模板</p>
            <el-button type="primary" @click="handleCreate">创建第一个模板</el-button>
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
                <span class="template-name">{{ template.name }}</span>
                <span v-if="template.isDefault" class="default-badge">默认</span>
              </div>

              <div class="card-meta">
                <span>区块: {{ template.data?.length || 0 }}</span>
              </div>

              <div class="card-actions">
                <el-button size="small" type="primary" @click.stop="handleSelect(template)">
                  <i class="fas fa-edit"></i> 编辑
                </el-button>
                <el-button
                  v-if="!template.isDefault"
                  size="small"
                  @click.stop="handleSetDefault(template)"
                >
                  <i class="fas fa-star"></i> 设为默认
                </el-button>
                <el-button
                  v-if="!template.isDefault"
                  size="small"
                  type="danger"
                  @click.stop="handleDelete(template)"
                >
                  <i class="fas fa-trash"></i>
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.template-list-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.template-list-modal {
  width: 80%;
  max-width: 800px;
  max-height: 80vh;
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color, #e6e8eb);
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--primary-color, #409EFF);
}

.modal-header h2 i {
  font-size: 20px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.modal-body {
  flex: 1;
  padding: 20px 24px;
  overflow-y: auto;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #909399;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #909399;
}

.empty-state i {
  font-size: 64px;
  margin-bottom: 16px;
  color: #dcdfe6;
}

.empty-state p {
  margin-bottom: 20px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.template-card {
  background: #f5f7fa;
  border: 2px solid transparent;
  border-radius: 10px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.template-card:hover {
  border-color: rgba(64, 158, 255, 0.3);
  background: #e6effe;
}

.template-card.selected {
  border-color: var(--primary-color, #409EFF);
  background: #d9ecff;
}

.template-card.is-default {
  border-color: #67c23a;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.template-name {
  font-weight: 600;
  font-size: 15px;
  color: #333;
}

.default-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: #67c23a;
  color: white;
  border-radius: 4px;
}

.card-meta {
  font-size: 12px;
  color: #909399;
  margin-bottom: 12px;
}

.card-actions {
  display: flex;
  gap: 6px;
}
</style>