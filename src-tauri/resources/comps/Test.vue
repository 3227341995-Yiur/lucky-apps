<script setup lang="ts">
// 官方 SFC 写法：defineProps / defineModel 是编译器宏，无需从 vue 导入
const { title, description } = defineProps({
  title: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  }
})

const modelValue = defineModel()

const showQuestion = () => {
  Swal.fire({
      title: '确认操作?',
      text: '您确定要执行此操作吗？',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      confirmButtonColor: '#3498db'
  })
}
</script>

<template>
  <div class="text">
    <div class="label">{{ title }} | {{ modelValue }}</div>
    <div class="text-label">{{ description }}</div>
    <el-tooltip content="这是删除">
      <el-button type="danger" size="small" @click="showQuestion">删除</el-button>
    </el-tooltip>
  </div>
</template>

<style scoped>
.text {
  width: 100%;
  color: var(--el-color-primary);
  display: flex;
  align-items: center;
  justify-items: center;
}

.text .label {
  font-weight: bold;
}

.text .text-label {
  margin: 0 10px;
}
</style>