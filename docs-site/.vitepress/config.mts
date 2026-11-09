import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: '周报开发文档',
  description: '插件、外部组件与二次开发 API',
  base: '/docs/',
  outDir: '../public/docs',
  cleanUrls: false,
  appearance: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/overview' },
      { text: 'API', link: '/guide/api' },
      { text: '常见问题', link: '/guide/faq' }
    ],
    sidebar: [
      {
        text: '开始',
        items: [
          { text: '概览', link: '/guide/overview' },
          { text: '快速开始', link: '/guide/quickstart' }
        ]
      },
      {
        text: '扩展',
        items: [
          { text: '外部组件', link: '/guide/components' },
          { text: '插件脚本', link: '/guide/plugins' },
          { text: '列扩展', link: '/guide/columns' },
          { text: '模板设计器', link: '/guide/template-designer' },
          { text: '启动加载动画', link: '/guide/loading' },
          { text: '画布设计器', link: '/guide/report-designer' }
        ]
      },
      {
        text: '参考',
        items: [
          { text: 'API 参考', link: '/guide/api' },
          { text: '常见问题', link: '/guide/faq' }
        ]
      }
    ],
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
          modal: {
            noResultsText: '没有找到结果',
            resetButtonTitle: '清除查询',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭'
            }
          }
        }
      }
    },
    outline: {
      level: [2, 3],
      label: '本页目录'
    },
    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },
    darkModeSwitchLabel: '主题',
    sidebarMenuLabel: '目录',
    returnToTopLabel: '回到顶部',
    lastUpdated: {
      text: '最后更新'
    }
  },
  vite: {
    configFile: false
  }
})
