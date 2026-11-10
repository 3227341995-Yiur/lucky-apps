<script setup lang="ts">
import { computed, ref } from 'vue'

defineOptions({ name: 'TemplateListPane' })

const props = defineProps({
  templates: {
    type: Array,
    default: () => [],
  },
  currentId: {
    type: [Number, String],
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select', 'copy', 'remove', 'set-default'])

const keyword = ref('')

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return props.templates
  return props.templates.filter(item => (item.name || '').toLowerCase().includes(kw))
})

const typeOptions = computed(() => {
  const map = new Map()
  map.set('html', 'HTML')
  map.set('markdown', 'Markdown')
  for (const template of props.templates) {
    if (template.type && !map.has(template.type)) map.set(template.type, template.type)
  }
  return [...map.entries()].map(([value, label]) => ({ value, label }))
})

const groups = computed(() => typeOptions.value
  .map(item => ({
    type: item.value,
    label: `${item.label} 模板`,
    items: filtered.value.filter(template => template.type === item.value),
  }))
  .filter(group => group.items.length))
</script>

<template>
  <aside class="td-tpl-pane">
    <header class="td-tpl-head">
      <div class="td-tpl-head-row">
        <span class="td-tpl-title">模板资源</span>
        <span class="td-tpl-count">{{ templates.length }}</span>
      </div>
      <el-input
        v-model="keyword"
        size="small"
        placeholder="搜索模板"
        clearable
        spellcheck="false"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </header>

    <el-scrollbar class="td-tpl-list">
      <div class="td-tpl-list-inner">
      <div v-if="loading && !templates.length" class="td-pane-hint">正在加载模板…</div>
      <div v-else-if="!filtered.length" class="td-pane-hint">
        {{ templates.length ? '没有匹配的模板' : '暂无模板，点击上方新建' }}
      </div>

      <section v-for="group in groups" :key="group.type" class="td-tpl-group">
        <div class="td-group-head">
          <span class="td-group-dot" :class="group.type"></span>
          <span>{{ group.label }}</span>
          <span class="td-group-count">{{ group.items.length }}</span>
        </div>

        <div
          v-for="item in group.items"
          :key="item.id"
          class="td-tpl-item"
          :class="{ active: item.id === currentId }"
          @click="emit('select', item)"
        >
          <div
            class="td-tpl-info"
            role="button"
            tabindex="0"
            @keydown.enter="emit('select', item)"
            @keydown.space.prevent="emit('select', item)"
          >
            <span class="td-tpl-name" :title="item.name">{{ item.name }}</span>
            <span class="td-tpl-badges">
              <span v-if="item.isDefault" class="td-badge is-default">默认</span>
              <span v-if="item.isSystem" class="td-badge is-system">系统</span>
            </span>
          </div>

          <div class="td-tpl-actions" @click.stop>
            <el-tooltip :content="item.isDefault ? '已是默认模板' : '设为默认'" placement="top" :show-after="300">
              <span class="td-mini-wrap">
                <button
                  type="button"
                  class="td-mini-btn"
                  :disabled="item.isDefault"
                  aria-label="设为默认"
                  @click="emit('set-default', item)"
                >
                  <el-icon><Star /></el-icon>
                </button>
              </span>
            </el-tooltip>

            <el-tooltip content="复制模板" placement="top" :show-after="300">
              <span class="td-mini-wrap">
                <button
                  type="button"
                  class="td-mini-btn"
                  aria-label="复制模板"
                  @click="emit('copy', item)"
                >
                  <el-icon><CopyDocument /></el-icon>
                </button>
              </span>
            </el-tooltip>

            <el-tooltip :content="item.isSystem ? '系统模板不可删除' : '删除模板'" placement="top" :show-after="300">
              <span class="td-mini-wrap">
                <button
                  type="button"
                  class="td-mini-btn is-danger"
                  :disabled="item.isSystem"
                  aria-label="删除模板"
                  @click="emit('remove', item)"
                >
                  <el-icon><Delete /></el-icon>
                </button>
              </span>
            </el-tooltip>
          </div>
        </div>
      </section>
      </div>
    </el-scrollbar>
  </aside>
</template>

<style scoped>
.td-tpl-pane {
  flex: 0 0 260px;
  width: 260px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}

.td-tpl-head {
  flex: none;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.td-tpl-head-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.td-tpl-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.td-tpl-count {
  min-width: 20px;
  padding: 0 6px;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  border-radius: 999px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}

.td-tpl-list {
  flex: 1;
  min-height: 0;
}

.td-tpl-list-inner {
  padding: 8px;
}

.td-pane-hint {
  padding: 24px 12px;
  text-align: center;
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
}

.td-tpl-group + .td-tpl-group {
  margin-top: 8px;
}

.td-group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--el-text-color-secondary);
}

.td-group-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--el-color-warning);
}

.td-group-dot.markdown {
  background: var(--el-color-success);
}

.td-group-count {
  margin-left: auto;
  font-weight: 400;
}

.td-tpl-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 8px 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  outline: none;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.td-tpl-item:hover,
.td-tpl-item:focus-visible {
  background: var(--el-fill-color);
}

.td-tpl-item.active {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-7);
}

.td-tpl-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--el-color-primary);
}

.td-tpl-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  border-radius: 4px;
  outline: none;
}

.td-tpl-info:focus-visible {
  box-shadow: 0 0 0 2px var(--el-color-primary);
}

.td-tpl-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.td-tpl-badges {
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px;
}

.td-badge {
  padding: 0 5px;
  border-radius: 999px;
  font-size: 10px;
  line-height: 16px;
}

.td-badge.is-default {
  color: var(--el-color-success);
  background: color-mix(in srgb, var(--el-color-success) 14%, transparent);
}

.td-badge.is-system {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-dark);
}

.td-tpl-actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 1px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.td-tpl-item:hover .td-tpl-actions,
.td-tpl-item:focus-within .td-tpl-actions,
.td-tpl-item.active .td-tpl-actions {
  opacity: 1;
}

.td-mini-wrap {
  display: inline-flex;
}

.td-mini-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  font-size: 13px;
}

.td-mini-btn:hover:not(:disabled) {
  color: var(--el-color-primary);
  background: var(--el-fill-color);
}

.td-mini-btn.is-danger:hover:not(:disabled) {
  color: var(--el-color-danger);
  background: color-mix(in srgb, var(--el-color-danger) 12%, transparent);
}

.td-mini-btn:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}
</style>
