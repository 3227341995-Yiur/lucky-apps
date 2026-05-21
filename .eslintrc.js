module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es6: true
  },
  extends: [
    'plugin:vue/vue3-recommended',
    'eslint:recommended',
    '@vue/typescript/recommended'
  ],
  parserOptions: {
    ecmaVersion: 2020,
    parser: '@typescript-eslint/parser',
    sourceType: 'module'
  },
  rules: {
    // 代码风格规则
    'semi': ['error', 'never'],             // 无分号
    'indent': ['error', 2],                 // 2空格缩进
    'quotes': ['error', 'single'],          // 单引号

    // Vue 相关规则
    'vue/html-indent': ['error', 2],        // Vue模板2空格缩进
    'vue/script-indent': ['error', 2, {     // Vue脚本2空格缩进
      'baseIndent': 1,
      'switchCase': 1
    }],
    'vue/multi-word-component-names': 'off',// 允许单文件组件名

    // TypeScript 规则
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',

    // 其他通用规则
    'comma-dangle': ['error', 'never'],     // 禁止尾随逗号
    'arrow-parens': ['error', 'as-needed'], // 箭头函数参数按需加括号
    'object-curly-spacing': ['error', 'always']
  },
  overrides: [
    {
      files: ['*.vue'],
      rules: {
        'indent': 'off' // 在 Vue 文件中禁用基础缩进规则
      }
    }
  ]
}