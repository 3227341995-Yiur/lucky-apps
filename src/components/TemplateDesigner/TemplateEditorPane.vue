<script setup>
import { computed } from 'vue'
import CodeEditor from '@/components/CodeEditor.vue'

defineOptions({ name: 'TemplateEditorPane' })

defineProps({
  hasDraft: {
    type: Boolean,
    default: false
  },
  templateId: {
    type: [Number, String],
    default: null
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isSystem: {
    type: Boolean,
    default: false
  },
  dirty: {
    type: Boolean,
    default: false
  },
  saving: {
    type: Boolean,
    default: false
  },
  showPreview: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['save', 'toggle-preview', 'create'])

const name = defineModel('name', { type: String, default: '' })
const type = defineModel('type', { type: String, default: 'html' })
const content = defineModel('content', { type: String, default: '' })

const typeLabel = computed(() => (type.value === 'markdown' ? 'Markdown' : 'HTML'))
const lineCount = computed(() => (content.value ? content.value.split('\n').length : 0))
</script>

<template>
  <section class="td-editor">
    <template v-if="hasDraft">
      <header class="td-editor-head">
        <div class="td-file">
          <el-icon class="td-file-icon"><Document /></el-icon>
          <input
            v-model="name"
            class="td-name-input"
            placeholder="模板名称"
            spellcheck="false"
            aria-label="模板名称"
          />
          <span v-if="dirty" class="td-dirty-dot" title="有未保存的修改"></span>
          <span v-if="isSystem" class="td-chip">系统</span>
          <span v-if="isDefault" class="td-chip is-default">默认</span>
        </div>

        <div class="td-editor-actions">
          <el-radio-group v-model="type" size="small">
            <el-radio-button value="html">HTML</el-radio-button>
            <el-radio-button value="markdown">Markdown</el-radio-button>
          </el-radio-group>

          <span class="td-shortcut" title="保存模板">
            <span class="wr-kbd">Ctrl</span>
            <span class="td-shortcut-plus">+</span>
            <span class="wr-kbd">S</span>
          </span>

          <el-button type="primary" size="small" :loading="saving" @click="emit('save')">
            <el-icon v-if="!saving"><Check /></el-icon>
            <span>保存</span>
          </el-button>

          <el-tooltip :content="showPreview ? '隐藏预览' : '显示预览'" placement="bottom">
            <el-button size="small" :plain="showPreview" @click="emit('toggle-preview')">
              <el-icon><View /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </header>

      <div class="td-breadcrumb">
        <span>模板</span>
        <span class="td-breadcrumb-sep">/</span>
        <span>{{ typeLabel }}</span>
        <span class="td-breadcrumb-sep">/</span>
        <span class="td-breadcrumb-current">{{ name || '未命名' }}</span>
        <span v-if="dirty" class="td-breadcrumb-dirty">未保存</span>
      </div>

      <div class="td-editor-surface">
        <CodeEditor v-model="content" :language="type" />
      </div>

      <footer class="td-statusbar">
        <span class="td-status-item">ID {{ templateId ?? '—' }}</span>
        <span class="td-status-item">{{ content.length }} 字符</span>
        <span class="td-status-item">{{ lineCount }} 行</span>
        <span class="td-status-item">{{ typeLabel }}</span>
        <span class="td-status-item td-status-state" :class="{ dirty }">
          {{ dirty ? '未保存' : '已保存' }}
        </span>
      </footer>
    </template>

    <div v-else class="td-editor-empty">
      <el-icon :size="40"><DocumentAdd /></el-icon>
      <h3>还没有可编辑的模板</h3>
      <p>从左侧新建一个 HTML 或 Markdown 模板开始设计。</p>
      <el-button type="primary" @click="emit('create', 'html')">新建 HTML 模板</el-button>
    </div>
  </section>
</template>

<style scoped>
.td-editor {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.td-editor-head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  flex-wrap: wrap;
  min-height: 42px;
  padding: 6px 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.td-file {
  flex: 1;
  min-width: 200px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.td-file-icon {
  flex: none;
  color: var(--el-text-color-secondary);
}

.td-name-input {
  flex: 0 1 300px;
  min-width: 120px;
  padding: 4px 6px;
  border: none;
  border-radius: 6px;
  outline: none;
  background: transparent;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
}

.td-name-input:hover {
  background: var(--el-fill-color);
}

.td-name-input:focus {
  background: var(--el-bg-color);
  box-shadow: inset 0 0 0 1px var(--el-color-primary);
}

.td-dirty-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el-color-warning);
}

.td-chip {
  flex: none;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 18px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);
}

.td-chip.is-default {
  color: var(--el-color-success);
  background: color-mix(in srgb, var(--el-color-success) 14%, transparent);
}

.td-editor-actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
}

.td-shortcut {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.td-shortcut-plus {
  opacity: 0.6;
}

.td-breadcrumb {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 16px;
  font-size: 11.5px;
  color: var(--el-text-color-placeholder);
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.td-breadcrumb-sep {
  opacity: 0.5;
}

.td-breadcrumb-current {
  color: var(--el-text-color-secondary);
}

.td-breadcrumb-dirty {
  margin-left: 2px;
  color: var(--el-color-warning);
}

.td-editor-surface {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--el-bg-color);
  font-family: var(--wr-mono);
}

.td-editor-surface :deep(.cm-editor) {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.td-editor-surface :deep(.cm-scroller) {
  min-height: 0;
  overflow: auto;
  font-family: var(--wr-mono);
}

.td-statusbar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 18px;
  height: 24px;
  padding: 0 16px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
  border-top: 1px solid var(--el-border-color-lighter);
}

.td-status-state {
  margin-left: auto;
}

.td-status-state.dirty {
  color: var(--el-color-warning);
}

.td-editor-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  text-align: center;
  color: var(--el-text-color-secondary);
}

.td-editor-empty h3 {
  margin: 0;
  font-size: 17px;
  color: var(--el-text-color-primary);
}

.td-editor-empty p {
  margin: 0;
  font-size: 13px;
}

@media (max-width: 1200px) {
  .td-shortcut {
    display: none;
  }
}
</style>
