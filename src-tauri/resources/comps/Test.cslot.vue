<template>
  <div class="glass-card-container">
    <div class="glass-card" :style="cardStyle">
      <div class="glass-card-content">
        <h2 v-if="modelValue.attrs.title" class="card-title">{{ modelValue.attrs.title }}</h2>
        <p v-if="modelValue.attrs.description" class="card-description">{{ modelValue.attrs.description }}</p>
        <div v-if="modelValue.attrs.stats" class="card-stats">
          <div v-for="(stat, index) in modelValue.attrs.stats" :key="index" class="stat-item">
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </div>
        <button v-if="modelValue.attrs.buttonText" class="glass-button">{{ modelValue.attrs.buttonText }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const modelValue = defineModel()

modelValue.value.attrs = {
  title: '液态玻璃卡片',
  description: '这是一个具有液态玻璃效果的卡片组件',
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  blurAmount: '10px',
  borderColor: 'rgba(255, 255, 255, 0.2)',
  stats: [
    { value: '42', label: '项目' },
    { value: '128', label: '关注' },
    { value: '86', label: '粉丝' }
  ],
  buttonText: '了解更多',
  ...modelValue.value.attrs
}

const cardStyle = computed(() => ({
  '--bg-color': modelValue.value.backgroundColor || 'rgba(255, 255, 255, 0.1)',
  '--blur-amount': modelValue.value.blurAmount || '10px',
  '--border-color': modelValue.value.borderColor || 'rgba(255, 255, 255, 0.2)'
}))
</script>

<style scoped>
.glass-card-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  padding: 20px;
  background: linear-gradient(135deg, #43cbff 0%, #9708cc 100%);
}

.glass-card {
  background: var(--bg-color);
  backdrop-filter: blur(var(--blur-amount));
  border-radius: 16px;
  border: 1px solid var(--border-color);
  padding: 24px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
  width: 100%;
  max-width: 400px;
  color: white;
  overflow: hidden;
  position: relative;
}

.glass-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
  z-index: -1;
}

.glass-card-content {
  position: relative;
  z-index: 1;
}

.card-title {
  font-size: 1.8rem;
  margin-bottom: 16px;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.card-description {
  font-size: 1rem;
  margin-bottom: 24px;
  line-height: 1.5;
  opacity: 0.9;
}

.card-stats {
  display: flex;
  justify-content: space-between;
  margin-bottom: 24px;
  padding: 16px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 0.85rem;
  opacity: 0.8;
}

.glass-button {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 10px 20px;
  border-radius: 50px;
  backdrop-filter: blur(5px);
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
  width: 100%;
}

.glass-button:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style>
