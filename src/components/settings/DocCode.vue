<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Check, CopyDocument } from '@element-plus/icons-vue'

defineOptions({ name: 'DocCode' })

const props = defineProps({
  title: { type: String, default: '代码' },
  code: { type: String, default: '' }
})

const copied = ref(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(props.code)
    copied.value = true
    ElMessage.success('已复制代码')
    setTimeout(() => { copied.value = false }, 1500)
  } catch {
    ElMessage.error('复制失败，请检查剪贴板权限')
  }
}
</script>

<template>
  <div class="doc-code">
    <header class="doc-code-head">
      <span class="doc-code-title">{{ title }}</span>
      <button type="button" class="doc-code-copy" @click="copy">
        <el-icon :size="11"><component :is="copied ? Check : CopyDocument" /></el-icon>
        <span>{{ copied ? '已复制' : '复制' }}</span>
      </button>
    </header>
    <pre class="doc-code-body"><code>{{ code }}</code></pre>
  </div>
</template>

<style scoped>
.doc-code {
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.doc-code-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}

.doc-code-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--wr-mono);
  font-size: 10px;
  color: var(--el-text-color-secondary);
}

.doc-code-copy {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  height: 22px;
  padding: 0 7px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-family: inherit;
  font-size: 10.5px;
  cursor: pointer;
}

.doc-code-copy:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.doc-code-body {
  margin: 0;
  padding: 12px 14px;
  overflow-x: auto;
  color: var(--el-text-color-primary);
  font-family: var(--wr-mono);
  font-size: 11.5px;
  line-height: 1.7;
  tab-size: 2;
}
</style>
