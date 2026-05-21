<script setup lang="ts">
import { defineProps, defineModel } from 'vue'

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
  test()
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

<style lang="scss" scoped>
.text {
  width: 100%;
  color: red;
  display: flex;
  align-items: center;
  justify-items: center;

  .label {
    font-weight: bold;
  }

  .text-label {
    margin: 0 10px;
  }
}
</style>