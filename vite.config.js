import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    vue(),
    vueDevTools()
  ],
  resolve: {
    alias: {
      '@resources': fileURLToPath(new URL('./src-tauri/resources', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // @vue/repl 官方 SFC 编译实现使用浏览器版 compiler-sfc
      'vue/compiler-sfc': fileURLToPath(new URL('./node_modules/@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js', import.meta.url)),
      // 运行时模板编译器（外部 JS 组件可用 template 字符串）
      'vue': 'vue/dist/vue.esm-bundler.js'
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    assetsInclude: ['**/*.woff2', '**/*.ttf'],
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    }
  }
})
