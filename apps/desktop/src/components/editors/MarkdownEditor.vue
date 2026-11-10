<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import Vditor from 'vditor'
import { useTheme } from '@/composables/useTheme'

defineOptions({ name: 'MarkdownEditor' })

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '在此输入支持详情，支持 Markdown 格式…',
  },
  height: {
    type: Number,
    default: 420,
  },
  /** 嵌在表格展开行等已有容器中：去掉外层留白与边框 */
  embedded: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'change'])
const { resolvedTheme } = useTheme()

const containerRef = ref(null)
let vditor = null
let destroyed = false

function themeName() {
  return resolvedTheme.value === 'dark' ? 'dark' : 'classic'
}

onMounted(async () => {
  await nextTick()
  if (!containerRef.value || destroyed) return
  vditor = new Vditor(containerRef.value, {
    mode: 'wysiwyg',
    height: props.height,
    placeholder: props.placeholder,
    theme: themeName(),
    cache: { enable: false },
    value: props.modelValue || '',
    input: (value) => {
      emit('update:modelValue', value)
      emit('change', value)
    },
    after: () => {
      if (props.modelValue && vditor && vditor.getValue() !== props.modelValue) {
        vditor.setValue(props.modelValue, true)
      }
    },
  })
})

watch(() => props.modelValue, (value) => {
  if (!vditor) return
  const current = vditor.getValue()
  if (value !== current) vditor.setValue(value || '', true)
})

watch(resolvedTheme, (theme) => {
  if (!vditor) return
  try {
    vditor.setTheme(theme === 'dark' ? 'dark' : 'classic')
  } catch (error) {
    console.warn('[MarkdownEditor] 切换主题失败:', error)
  }
})

onUnmounted(() => {
  destroyed = true
  try {
    vditor?.destroy()
  } catch {
    // ignore
  }
  vditor = null
})
</script>

<template>
  <div class="markdown-editor-wrap" :class="{ 'is-embedded': embedded }">
    <div ref="containerRef" class="markdown-editor" />
  </div>
</template>

<style scoped>
.markdown-editor-wrap {
  padding: 4px 16px 16px;
  background: var(--el-bg-color);
}
.markdown-editor {
  width: 100%;
}
.markdown-editor :deep(.vditor) {
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: var(--el-bg-color);
}
.markdown-editor :deep(.vditor-toolbar) {
  background: var(--el-fill-color-lighter);
  border-radius: 10px 10px 0 0;
}
.markdown-editor :deep(.vditor-reset) {
  max-height: none;
  overflow-y: auto;
  color: var(--el-text-color-primary);
}

/* 嵌在表格展开行里：外层容器已有背景，编辑器不再画第二层边框 */
.markdown-editor-wrap.is-embedded {
  padding: 0;
  background: transparent;
}

.markdown-editor-wrap.is-embedded .markdown-editor :deep(.vditor) {
  border: 0;
  border-radius: 6px;
  background: transparent;
}

.markdown-editor-wrap.is-embedded .markdown-editor :deep(.vditor-toolbar) {
  border-bottom: 1px solid var(--el-border-color-lighter);
  border-radius: 6px 6px 0 0;
  background: var(--el-bg-color);
}
</style>

<style>
/* Vditor 自带全屏层级只有 90，会被 Element Plus 弹窗（2000+）盖住 */
.vditor--fullscreen {
  z-index: 5000 !important;
  background: var(--el-bg-color);
}

/* 周报页用 CSS zoom 缩放画布，全屏编辑器要抵消父级缩放并铺满视口 */
.page-zoom .vditor--fullscreen {
  width: 100vw !important;
  height: 100vh !important;
  zoom: var(--page-zoom-inverse, 1);
}

.vditor--fullscreen .vditor-toolbar {
  background: var(--el-fill-color-lighter);
}
</style>
