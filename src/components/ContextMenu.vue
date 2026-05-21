<script setup>
import { defineProps, defineEmits, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  menuItems: Array,
  position: Object
})

const emit = defineEmits(['select', 'close'])

const handleClick = (item) => {
  emit('select', item)
  emit('close')
}

// 添加点击外部关闭菜单的逻辑
const clickOutsideHandler = (e) => {
  if (!e.target.closest('.context-menu')) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('click', clickOutsideHandler)
})

onUnmounted(() => {
  document.removeEventListener('click', clickOutsideHandler)
})
</script>

<template>
  <div class="context-menu" :style="{ left: position.x + 'px', top: position.y + 'px' }">
    <div v-for="(item, index) in menuItems" :key="index" class="menu-item" @click="handleClick(item)">
      <i :class="item.icon"></i>
      <span>{{ item.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.context-menu {
  position: fixed;
  background: white;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  padding: 5px 0;
  z-index: 9999;
  min-width: 160px;
  border: 1px solid #ebeef5;
}

.menu-item {
  padding: 8px 20px;
  cursor: pointer;
  font-size: 14px;
  color: #606266;
  display: flex;
  align-items: center;
}

.menu-item i {
  margin-right: 8px;
  width: 16px;
  text-align: center;
}

.menu-item:hover {
  background: #f5f7fa;
  color: var(--primary-color);
}
</style>