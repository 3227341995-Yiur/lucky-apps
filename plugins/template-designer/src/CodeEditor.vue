<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useWeekReport } from '@week-report/plugin-api'
import { Codemirror } from 'vue-codemirror'
import { basicSetup } from 'codemirror'
import { EditorView } from '@codemirror/view'
import { oneDark } from '@codemirror/theme-one-dark'
import { html } from '@codemirror/lang-html'
import { markdown } from '@codemirror/lang-markdown'

defineOptions({ name: 'CodeEditor' })

const props = defineProps({
  language: {
    type: String,
    default: 'markdown'
  },
  wrap: {
    type: Boolean,
    default: true
  }
})

const modelValue = defineModel({
  type: String,
  default: ''
})

const api = useWeekReport()
const resolvedTheme = ref(api.theme.get().resolved)
let offTheme = null

onMounted(() => {
  offTheme = api.theme.onChange(theme => {
    resolvedTheme.value = theme?.resolved || api.theme.get().resolved
  })
})

onBeforeUnmount(() => offTheme?.())

const wrTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    backgroundColor: 'var(--el-bg-color)',
    color: 'var(--el-text-color-primary)'
  },
  '.cm-scroller': {
    fontFamily: 'var(--wr-mono)',
    lineHeight: '1.72'
  },
  '.cm-content': {
    padding: '10px 0'
  },
  '.cm-gutters': {
    backgroundColor: 'var(--el-bg-color)',
    color: 'var(--el-text-color-placeholder)',
    border: 'none',
    borderRight: '1px solid var(--el-border-color-lighter)'
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 10px 0 12px'
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--el-fill-color-lighter)'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--el-fill-color-lighter)',
    color: 'var(--el-text-color-secondary)'
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--el-color-primary-light-7) !important'
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--el-color-primary)'
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--el-fill-color)',
    border: 'none',
    color: 'var(--el-text-color-secondary)'
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--el-bg-color-overlay)',
    border: '1px solid var(--el-border-color-light)',
    borderRadius: '8px'
  }
})

const cmExtensions = computed(() => {
  const extensions = [basicSetup, wrTheme]
  if (resolvedTheme.value === 'dark') extensions.push(oneDark)
  if (props.wrap) extensions.push(EditorView.lineWrapping)

  if (props.language === 'html') extensions.push(html())
  else if (props.language === 'markdown') extensions.push(markdown())
  return extensions
})
</script>

<template>
  <codemirror
    v-model="modelValue"
    :extensions="cmExtensions"
    class="wr-code-editor"
    v-bind="$attrs"
  />
</template>

<style scoped>
.wr-code-editor {
  height: 100%;
}
.wr-code-editor :deep(.cm-editor) {
  height: 100%;
  outline: none;
}
</style>
