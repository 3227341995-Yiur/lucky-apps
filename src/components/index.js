import { ref, onMounted, onUnmounted, nextTick, defineAsyncComponent } from 'vue'
import { compileTemplate, compileScript, compileStyle, parse, rewriteDefault } from '@vue/compiler-sfc'
import { readDir, readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'
import { join, resourceDir, appDataDir } from '@tauri-apps/api/path'
import { convertFileSrc } from '@tauri-apps/api/core'
import { transform } from '@babel/standalone'
import BaseDialog from '@/components/BaseDialog.vue'
import CodeEditor from '@/components/CodeEditor.vue'
import ColumnCard from '@/components/ColumnCard.vue'
import Vditor from 'vditor'

const TEMP_VUE_DIR = 'vue-sfc'

// 简单的 hash 函数
function hashCode(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

// 工具函数：清理 Windows 长路径前缀
function cleanPath(path) {
  return path.replace(/^\\\\\?\\.*?_root_/, '').replace(/_root_/g, '').replace(/\\/g, '/')
}

// 工具函数：构建 asset URL
function buildAssetUrl(basePath, subPath) {
  const fullPath = cleanPath(basePath + '/' + subPath)
  return convertFileSrc(fullPath)
}

// 工具函数：获取临时 Vue 文件目录
async function getTempVueDir() {
  const vueTempPath = await join(await appDataDir(), TEMP_VUE_DIR)
  try {
    // 确保目录存在
    await mkdir(TEMP_VUE_DIR, { recursive: true, baseDir: BaseDirectory.AppData })
  } catch (e) {
    // 目录已存在，忽略错误
  }
  return vueTempPath
}

// ============================================================
// Import Map 配置 - 所有外部模块的映射关系
// ============================================================
const IMPORT_MAP_CONFIG = {
  'vue': { var: 'window.Vue', type: 'default' },
  'element-plus': { var: 'window.ElementPlus', type: 'default' },
  '@tauri-apps/api': { var: 'window.TauriApi', type: 'default' },
  '@tauri-apps/plugin-fs': { var: 'window.TauriFs', type: 'default' },
  'handlebars': { var: 'window.Handlebars', type: 'default' }
}

// 资源路径映射（预解析）
const RESOURCE_PATHS = new Map()

// ============================================================
// 初始化全局模块
// ============================================================
async function initGlobalModules() {
  window.Vue = await import('vue')
  window.ElementPlus = await import('element-plus')
  window.TauriApi = await import('@tauri-apps/api')
  window.TauriFs = await import('@tauri-apps/plugin-fs')
  window.Handlebars = await import('handlebars')
}

// ============================================================
// 预处理：收集 @resources 路径映射
// ============================================================
async function preprocessResourcePaths(code) {
  const resourceImports = []
  const importRegex = /import\s+.*?\s+from\s+['"](@resources\/[^'"]+)['"]/g
  let match

  while ((match = importRegex.exec(code)) !== null) {
    resourceImports.push(match[1])
  }

  for (const resourcePath of resourceImports) {
    if (!RESOURCE_PATHS.has(resourcePath)) {
      const resDir = await resourceDir()
      const fullPath = resourcePath.replace('@resources', join(resDir, 'resources')).replace(/\\/g, '/')
      const assetUrl = convertFileSrc(fullPath.replace(/^\\\\\?\\.*?_root_/, '').replace(/_root_/g, ''))
      RESOURCE_PATHS.set(resourcePath, assetUrl)
    }
  }
}

// ============================================================
// Babel 插件：转换 import 语句
// ============================================================
function createImportMapPlugin() {
  return ({ types: t }) => {
    return {
      visitor: {
        Program(path) {
          // 收集所有 import 声明
          const imports = []

          path.traverse({
            ImportDeclaration(innerPath) {
              const source = innerPath.node.source.value

              // 处理 @resources 路径 - 替换为实际路径
              if (source.startsWith('@resources')) {
                const resolvedPath = RESOURCE_PATHS.get(source)
                if (resolvedPath) {
                  innerPath.node.source.value = resolvedPath
                }
                return
              }

              // 处理 import map 映射
              const mapConfig = IMPORT_MAP_CONFIG[source]
              if (!mapConfig) return

              const specifiers = innerPath.node.specifiers
              const replacements = buildReplacements(t, specifiers, mapConfig)

              if (replacements.length > 0) {
                imports.push({
                  path: innerPath,
                  replacements
                })
              }
            }
          })

          // 替换所有收集到的 import
          for (const { path: importPath, replacements } of imports) {
            importPath.replaceWithMultiple(replacements)
          }
        }
      }
    }
  }
}

// 构建替换语句
function buildReplacements(t, specifiers, config) {
  const defaultImport = specifiers.find(s => t.isImportDefaultSpecifier(s))
  const namedImports = specifiers.filter(s => t.isImportSpecifier(s))
  const namespaceImport = specifiers.find(s => t.isImportNamespaceSpecifier(s))
  const replacements = []
  const sourceVar = t.identifier(config.var)

  if (namespaceImport) {
    // import * as name from 'module'
    replacements.push(
      t.variableDeclaration('const', [
        t.variableDeclarator(
          t.identifier(namespaceImport.local.name),
          sourceVar
        )
      ])
    )
  } else if (defaultImport && namedImports.length === 0) {
    // import name from 'module'
    replacements.push(
      t.variableDeclaration('const', [
        t.variableDeclarator(
          t.identifier(defaultImport.local.name),
          sourceVar
        )
      ])
    )
  } else if (!defaultImport && namedImports.length > 0) {
    // import { name1, name2 } from 'module'
    const properties = namedImports.map(spec =>
      t.objectProperty(
        t.identifier(spec.imported.name),
        t.identifier(spec.local.name),
        false,
        spec.imported.name === spec.local.name
      )
    )
    replacements.push(
      t.variableDeclaration('const', [
        t.variableDeclarator(
          t.objectPattern(properties),
          sourceVar
        )
      ])
    )
  } else if (defaultImport && namedImports.length > 0) {
    // import defaultName, { name1, name2 } from 'module'
    replacements.push(
      t.variableDeclaration('const', [
        t.variableDeclarator(
          t.identifier(defaultImport.local.name),
          sourceVar
        )
      ])
    )
    const properties = namedImports.map(spec =>
      t.objectProperty(
        t.identifier(spec.imported.name),
        t.identifier(spec.local.name),
        false,
        spec.imported.name === spec.local.name
      )
    )
    replacements.push(
      t.variableDeclaration('const', [
        t.variableDeclarator(
          t.objectPattern(properties),
          sourceVar
        )
      ])
    )
  }

  return replacements
}

async function loadVueFile(file, content) {
  const scopeId = `data-v-${hashCode(file.name)}`

  const { descriptor } = parse(content)

  const codeList = []

  // 处理 script 部分
  if (descriptor.script || descriptor.scriptSetup) {
    const script = compileScript(descriptor, {
      id: scopeId
    })

    let scriptCode = rewriteDefault(script.content, '__sfc_main__', ['typescript', 'jsx'])

    // 移除 defineModel 导入（Vue 3.5+ 是编译器宏，无需导入）
    scriptCode = scriptCode
      .replace(/import\s+defineModel\s+from\s+['"][^'"]+['"][;\n]*/g, '')
      .replace(/import\s+\{[^}]*?\bdefineModel[^}]*?\}\s+from\s+['"][^'"]+['"][;\n]*/g, (match) => {
        if (/^\s*import\s+\{[^}]*?\bdefineModel[^}]*?\}\s*from/.test(match.trim())) {
          return ''
        }
        return match.replace(/\bdefineModel,\s*/g, '').replace(/,\s*defineModel\b/g, '')
      })
      .replace(/import\s+\{[^}]*?\bdefineModel[^}]*?\}\s*from\s+['"][^'"]+['"]/g, (match) => {
        const names = match.match(/\{([^}]*)\}/)[1].split(',').map(n => n.trim()).filter(n => n && n !== 'defineModel')
        return names.length ? match.replace(/\{[^}]*\}/, `{${names.join(', ')}}`) : ''
      })

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

  // 预处理资源路径
  await preprocessResourcePaths(codeList.join('\n'))

  const { code } = transform(codeList.join('\n'), {
      presets: ['typescript'],
      plugins: [
        'transform-typescript',
        createImportMapPlugin()
      ],
      filename: file.name
    })

  // 写入临时目录，用原文件名
  const vueTempDir = await getTempVueDir()
  const jsFileName = `${file.name}.js`
  const jsFilePath = await join(vueTempDir, jsFileName)
  await writeTextFile(jsFilePath, code, { baseDir: BaseDirectory.AppData })

  // 返回 convertFileSrc URL（不是 blob URL）
  const cleanPath = jsFilePath.replace(/^\\\\\?\\.*?_root_/, '').replace(/_root_/g, '').replace(/\\/g, '/')
  return convertFileSrc(cleanPath)
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
        const assetUrl = buildAssetUrl(resDir, 'resources/js/' + file.name)
        const compName = file.name.replace('.js', '')

        components[compName] = defineAsyncComponent(() => import(assetUrl))
      }
      if (file.name.endsWith('.cslot.vue')) {
        const compName = file.name.replace('.cslot.vue', '')
        const content = await readTextFile(filePath, { baseDir: BaseDirectory.Resource })
        const url = await loadVueFile(file, content)
        const module = await import(url)

        columnSlots[compName] = defineAsyncComponent(() => Promise.resolve(module))
      } else if (file.name.endsWith('.vue')) {
        const compName = file.name.replace('.vue', '')
        const content = await readTextFile(filePath, { baseDir: BaseDirectory.Resource })
        const url = await loadVueFile(file, content)
        const module = await import(url)

        components[compName] = defineAsyncComponent(() => Promise.resolve(module))
      }
    }
  } catch (error) {
    console.error('加载Vue组件失败:', error)
  }
}

export default {
  async install(app) {
    await initGlobalModules()
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
