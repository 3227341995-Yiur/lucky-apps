<script setup lang="ts">
// ponytail: 纯文本 textarea 代替宿主 CodeMirror 编辑器，插件包不引入 codemirror 依赖
defineOptions({ name: 'CodeEditor' })

defineProps({
  modelValue: { type: String, default: '' },
  language: { type: String, default: 'javascript' },
  readonly: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <textarea
    class="plugin-code-editor"
    :value="modelValue"
    :readonly="readonly"
    spellcheck="false"
    @input="emit('update:modelValue', $event.target.value)"
  />
</template>

<style scoped>
.plugin-code-editor {
  display: block;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  border: 0;
  outline: none;
  resize: none;
  background: transparent;
  color: var(--el-text-color-primary);
  font-family: var(--wr-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-size: 11px;
  line-height: 1.6;
  tab-size: 2;
}
</style>
