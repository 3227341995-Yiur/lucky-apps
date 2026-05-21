<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { saveTemplate, getTemplateById } from '@/services/templateService'
import CodeEditor from '@/components/CodeEditor.vue'
import BaseDialog from '@/components/BaseDialog.vue'

const props = defineProps({
  templateId: String,
  template: Object
})

const emit = defineEmits(['close'])

const currentTemplate = ref({
  name: '',
  type: 'html',
  template: ''
})

onMounted(async () => {
  if (props.template) {
    currentTemplate.value = { ...props.template }
  } else if (props.templateId) {
    const tmpl = await getTemplateById(props.templateId)
    if (tmpl) {
      currentTemplate.value = { ...tmpl }
    }
  }
})

const handleSave = async () => {
  await saveTemplate(currentTemplate.value)
  ElMessage.success('保存成功')
  emit('close')
}
</script>

<template>
  <base-dialog
    :title="currentTemplate.name"
    width="900px"
    align-center
    @close="$emit('close')"
  >
    <template #title>
      <input
        v-model="currentTemplate.name"
        class="name-input"
        placeholder="模板名称"
      />
    </template>

    <div class="designer-body">
      <code-editor
        v-model="currentTemplate.template"
        :language="currentTemplate.type === 'html' ? 'html' : 'markdown'"
        height="100%"
      />
    </div>

    <div class="designer-type">
      <span class="label">类型：</span>
      <el-select v-model="currentTemplate.type" style="width: 120px;">
        <el-option label="HTML" value="html" />
        <el-option label="Markdown" value="markdown" />
      </el-select>
    </div>

    <div class="designer-hint">
      使用 Handlebars 语法：{{'{{'}}title}}, {{'{{'}}dateRange}}, {{'{{'}}#each sections}}...{{'{{'}}/each}}
    </div>

    <template #actions>
      <el-button type="primary" @click="handleSave">
        <i class="fas fa-save"></i><span>保存</span>
      </el-button>
    </template>
  </base-dialog>
</template>

<style scoped>
.name-input {
  font-weight: 600;
  font-size: 15px;
  color: #333;
  padding: 4px 8px;
  border: none;
  background: transparent;
  outline: none;
  min-width: 200px;
}
.name-input:focus {
  background: #f5f7fa;
  border-radius: 4px;
}
.designer-body {
  flex: 1;
  min-height: 400px;
  overflow: hidden;
  padding: 16px;
}
.designer-type {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #eee;
}
.label {
  font-size: 14px;
  color: #606266;
}
.designer-hint {
  font-size: 12px;
  color: #909399;
  padding: 12px 16px;
  border-top: 1px solid #eee;
}
</style>