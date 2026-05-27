import { ref, onMounted, onUnmounted, nextTick, defineAsyncComponent } from 'vue'
import { compileTemplate, compileScript, compileStyle, parse, rewriteDefault } from '@vue/compiler-sfc'
import { readDir, readTextFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import { join, resourceDir } from '@tauri-apps/api/path'
import { convertFileSrc } from '@tauri-apps/api/core'
import { transform } from '@babel/standalone'
import BaseDialog from '@/components/BaseDialog.vue'
import CodeEditor from '@/components/CodeEditor.vue'
import ColumnCard from '@/components/ColumnCard.vue'
import Vditor from 'vditor'

// 工具函数：清理 Windows 长路径前缀
function cleanPath(path) {
  return path.replace(/^\\\\\?\\.*?_root_/, '').replace(/_root_/g, '').replace(/\\/g, '/')
}

// 工具函数：构建 asset URL
function buildAssetUrl(basePath, subPath) {
  const fullPath = cleanPath(basePath + '/' + subPath)
  return convertFileSrc(fullPath)
}

// 定义全局 import map
window.Vue = await import('vue')
window.ElementPlus = await import('element-plus')
window.TauriApi = await import('@tauri-apps/api')
window.TauriFs = await import('@tauri-apps/plugin-fs')
window.Handlebars = await import('handlebars')

const importMap = {
  'vue': 'window.Vue',
  'element-plus': 'window.ElementPlus',
  '@tauri-apps/api': 'window.TauriApi',
  '@tauri-apps/plugin-fs': 'window.TauriFs',
  'handlebars': 'window.Handlebars'
}

// Babel 插件：转换 import 语句
function importMapPlugin() {
  return ({ types: t }) => {
    return {
      visitor: {
        async ImportDeclaration(path) {
          const source = path.node.source.value
          if (source.startsWith('@resources')) {
            const resDir = await resourceDir()
            const resFile = source.replace('@resources', await join(resDir, 'resources')).replaceAll('/', '\\')
          } else if (importMap[source]) {
            // 获取导入说明符
            const specifiers = path.node.specifiers

            // 处理默认导入
            const defaultImport = specifiers.find(s => t.isImportDefaultSpecifier(s))
            // 处理命名导入
            const namedImports = specifiers.filter(s => t.isImportSpecifier(s))
            // 处理命名空间导入
            const namespaceImport = specifiers.find(s => t.isImportNamespaceSpecifier(s))

            const replacements = []

            if (namespaceImport) {
              // import * as name from 'module'
              replacements.push(
                  t.variableDeclaration('const', [
                    t.variableDeclarator(
                        t.identifier(namespaceImport.local.name),
                        t.identifier(importMap[source])
                    )
                  ])
              )
            } else if (defaultImport && namedImports.length === 0) {
              // import name from 'module'
              replacements.push(
                  t.variableDeclaration('const', [
                    t.variableDeclarator(
                        t.identifier(defaultImport.local.name),
                        t.identifier(importMap[source])
                    )
                  ])
              )
            } else if (!defaultImport && namedImports.length > 0) {
              // import { name1, name2 } from 'module'
              const properties = namedImports.map(specifier =>
                  t.objectProperty(
                      t.identifier(specifier.imported.name),
                      t.identifier(specifier.local.name),
                      false,
                      specifier.imported.name === specifier.local.name
                  )
              )

              replacements.push(
                  t.variableDeclaration('const', [
                    t.variableDeclarator(
                        t.objectPattern(properties),
                        t.identifier(importMap[source])
                    )
                  ])
              )
            } else if (defaultImport && namedImports.length > 0) {
              // import defaultName, { name1, name2 } from 'module'
              const defaultReplacement = t.variableDeclaration('const', [
                t.variableDeclarator(
                    t.identifier(defaultImport.local.name),
                    t.identifier(importMap[source])
                )
              ])

              const properties = namedImports.map(specifier =>
                  t.objectProperty(
                      t.identifier(specifier.imported.name),
                      t.identifier(specifier.local.name),
                      false,
                      specifier.imported.name === specifier.local.name
                  )
              )

              const namedReplacement = t.variableDeclaration('const', [
                t.variableDeclarator(
                    t.objectPattern(properties),
                    t.identifier(importMap[source])
                )
              ])

              replacements.push(defaultReplacement, namedReplacement)
            }

            if (replacements.length > 0) {
              path.replaceWithMultiple(replacements)
            }
          }
          // 如果不是映射表中的模块，保留原 import 语句
        }
      }
    }
  }
}

function loadVueBlobUrl(file, content) {
  const id = Date.now().toString()
  const scopeId = `data-v-${id}`

  const { descriptor } = parse(content)

  const codeList = []

  // 处理 script 部分
  if (descriptor.script || descriptor.scriptSetup) {
    const script = compileScript(descriptor, {
      id: scopeId
    })

    let scriptCode = rewriteDefault(script.content, '__sfc_main__', ['typescript', 'jsx'])

    // 特殊处理 setup 语法
    if (descriptor.scriptSetup) {
      // 对于 <script setup>，需要确保返回的变量能被模板访问
      scriptCode = scriptCode.replace(
          /return\s+__returned__/,
          `return Object.assign({}, __returned__)`
      )
    }

    codeList.push(scriptCode)
    codeList.push(`__sfc_main__.__scopeId='${scopeId}'`)
  }

  // 处理 template 部分
  if (descriptor.template) {
    const template = compileTemplate({
      source: descriptor.template.content,
      filename: file.name,
      id: scopeId,
      compilerOptions: {
        scopeId,
        mode: 'module'
      }
    })

    let templateCode = template.code

    codeList.push(templateCode)
    codeList.push(`__sfc_main__.render=render`)
  }

  codeList.push(`export default __sfc_main__`)

  // 处理样式
  for (const styleBlock of descriptor.styles) {
    const styleCode = compileStyle({
      source: styleBlock.content,
      id: scopeId,
      filename: file.name,
      scoped: styleBlock.scoped
    })
    const styleDOM = `const el = document.createElement('style')\r\nel.innerHTML = \`${styleCode.code}\`\r\ndocument.head.append(el)`
    codeList.push(styleDOM)
  }

  const { code } = transform(codeList.join('\n'), {
    presets: ['typescript'],
    plugins: [
      'transform-typescript',
      importMapPlugin()
    ],
    filename: file.name
  })
  const blob = new Blob([code], { type: 'application/javascript' })
  return URL.createObjectURL(blob)
}

async function loadExternalResources() {
  const resDir = await resourceDir()

  // 1. 加载CSS
  try {
    const cssFiles = await readDir('resources/css', { baseDir: BaseDirectory.Resource })

    for (const file of cssFiles) {
      if (file.name.endsWith('.css')) {
        const assetUrl = buildAssetUrl(resDir, 'resources/css/' + file.name)
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = assetUrl
        document.head.appendChild(link)
      }
    }
  } catch (error) {
    console.error('加载CSS资源失败:', error)
  }

  // 2. 加载JS
  try {
    const jsFiles = await readDir('resources/js', { baseDir: BaseDirectory.Resource })
    for (const file of jsFiles) {
      if (file.name.endsWith('.js')) {
        const assetUrl = buildAssetUrl(resDir, 'resources/js/' + file.name)

        const script = document.createElement('script')
        script.src = assetUrl
        if (file.name.includes('async')) {
          script.async = true
        }
        if (file.name.includes('module')) {
          script.type = 'module'
        }
        document.head.appendChild(script)
      }
    }
  } catch (error) {
    console.error('加载JS资源失败:', error)
  }

  // 3. 动态加载Vue组件
  try {
    const compsDir = await join('resources', 'comps')
    const compFiles = await readDir(compsDir, { baseDir: BaseDirectory.Resource })

    for (const file of compFiles) {
      const filePath = (await join(compsDir, file.name)).split('\\').join('/')
      if (file.name.endsWith('.js')) {
        const compName = file.name.replace('.js', '')
        const content = await readTextFile(filePath, { baseDir: BaseDirectory.Resource })

        const blob = new Blob([content], { type: 'application/javascript' })
        const url = URL.createObjectURL(blob)
        components[compName] = defineAsyncComponent(() => import(url))
      }
      if (file.name.endsWith('.cslot.vue')) {
        const compName = file.name.replace('.cslot.vue', '')
        const content = await readTextFile(filePath, { baseDir: BaseDirectory.Resource })
        const url = loadVueBlobUrl(file, content)
        const module = await import(url)
        URL.revokeObjectURL(url)

        columnSlots[compName] = defineAsyncComponent(() => Promise.resolve(module))
      } else if (file.name.endsWith('.vue')) {
        const compName = file.name.replace('.vue', '')
        const content = await readTextFile(filePath, { baseDir: BaseDirectory.Resource })
        const url = loadVueBlobUrl(file, content)
        const module = await import(url)
        URL.revokeObjectURL(url)

        components[compName] = defineAsyncComponent(() => Promise.resolve(module))
      }
    }
  } catch (error) {
    console.error('加载Vue组件失败:', error)
  }
}

export default {
  async install(app) {
    await loadExternalResources()
    // 列组件
    for (const key in components) {
      app.component(key, components[key])
    }
    // 列编辑插槽
    for (const key in columnSlots) {
      app.component(key + 'ColumnModifySlot', columnSlots[key])
    }

    // 注册组件
    app.component('MarkdownEditor', MarkdownEditor)
    app.component('BaseDialog', BaseDialog)
    app.component('CodeEditor', CodeEditor)
    app.component('ColumnCard', ColumnCard)
  }
}

// Markdown组件
const MarkdownEditor = {
  props: {
    id: [Number, String],
    modelValue: Object
  },
  template: `
    <div class="support-content">
      <div class="vditor-container" :id="id"/>
    </div>
  `,
  setup(props, { emit }) {
    const vditor = ref(null)

    onMounted(async () => {
      await nextTick()
      vditor.value = new Vditor(props.id, {
        mode: 'wysiwyg',
        height: 500,
        placeholder: '在此输入支持详情，支持Markdown格式...',
        value: props.modelValue.content || '',
        input: (value) => {
          props.modelValue.content = value
          emit('update:modelValue', props.modelValue)
        }
      })
    })

    onUnmounted(() => {
      vditor.value.destroy()
    })
  }
}

export const components = {
  // 状态选择器组件
  StatusSelector: {
    props: {
      modelValue: String,
      options: {
        type: Array,
        default: () => []
      }
    },
    template: `
      <el-select
          :modelValue="modelValue"
          placeholder="选择状态"
          size="small"
          v-bind="$attrs"
      >
        <el-option
            v-for="option in options"
            :key="option.key || option"
            :label="option.label || option"
            :value="option.value || option"
        />
      </el-select>
    `
  },
  // 日期选择器组件
  DateSelector: {
    props: {
      modelValue: String
    },
    template: `
      <el-date-picker
          :modelValue="modelValue"
          type="date"
          placeholder="选择日期"
          size="small"
          class="date-picker"
          value-format="YYYY-MM-DD"
          v-bind="$attrs"
      />
    `
  }
}

export const columnSlots = {
  StatusSelector: {
    props: {
      modelValue: {
        type: Object,
        default: () => ({})
      },
      disabled: {
        type: Boolean,
        default: false
      }
    },
    template: `
      <el-form-item label="选项">
        <el-tag
            v-for="(option, idx) in column.attrs.options || []"
            :key="idx"
            :closable="!disabled"
            :disable-transitions="false"
            @close="removeOption(idx)"
        >
          {{ option }}
        </el-tag>
        <el-input
            v-if="inputVisible"
            ref="InputRef"
            v-model="inputValue"
            size="small"
            @keyup.enter="addOption"
            @blur="addOption"
        />
        <el-button
            v-else-if="!disabled"
            size="small"
            @click="showInput"
        >
          <i class="fas fa-plus"></i><span>添加选项</span>
        </el-button>
      </el-form-item>
      `,
    setup(props, { emit }) {
      const column = ref(props.modelValue)

      const inputVisible = ref(false)
      const inputValue = ref('')
      const InputRef = ref()

      const showInput = () => {
        inputVisible.value = true
        nextTick(() => {
          InputRef.value.focus()
        })
      }

      const addOption = () => {
        if (inputValue.value) {
          if (!column.value.attrs.options) {
            column.value.attrs.options = []
          }
          column.value.attrs.options.push(inputValue.value)
        }
        inputVisible.value = false
        inputValue.value = ''
      }

      const removeOption = (index) => {
        column.value.attrs.options.splice(index, 1)
      }

      return {
        column,
        inputVisible,
        inputValue,
        InputRef,
        showInput,
        addOption,
        removeOption
      }
    }
  }
}
