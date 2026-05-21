<script setup>
import { defineProps, defineModel, computed } from 'vue'
import { Codemirror } from 'vue-codemirror'
import { basicSetup } from 'codemirror'
import { oneDark } from '@codemirror/theme-one-dark'
import { json } from '@codemirror/lang-json'
import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { markdown } from '@codemirror/lang-markdown'

const props = defineProps({
  language: {
    type: String,
    default: 'javascript'
  }
})

const modelValue = defineModel({
  type: String,
  default: ''
})

const cmExtensions = computed(() => {
  const extensions = [basicSetup]
  if (props.language === 'json') {
    extensions.push(json())
  } else if (props.language === 'javascript') {
    extensions.push(javascript())
  } else if (props.language === 'html') {
    extensions.push(html())
  } else if (props.language === 'markdown') {
    extensions.push(markdown())
  }
  return extensions
})

const cmTheme = oneDark
</script>

<template>
  <codemirror
      v-model="modelValue"
      :extensions="cmExtensions"
      :theme="cmTheme"
      v-bind="$attrs"
  />
</template>

<style scoped>
</style>