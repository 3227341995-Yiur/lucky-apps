---
layout: home

hero:
  name: 周报开发文档
  text: 插件、外部组件与二次开发
  tagline: 不重新构建客户端，直接扩展周报系统。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/quickstart
    - theme: alt
      text: API 参考
      link: /guide/api

features:
  - title: 外部组件
    details: 每个组件是独立 Cordis 包，自己构建，由 Node 服务的 profile bundles / patch 运行时挂载。
  - title: 插件脚本
    details: 在 resources/js 放普通脚本，通过 window.weekReport 访问周报、事件、命令和 UI。
  - title: 列扩展
    details: 注册自定义列组件和列属性编辑插槽，列设置中即可选择。
---
