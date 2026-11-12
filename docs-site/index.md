---
layout: home

hero:
  name: Lucky Apps 开发文档
  text: 插件、外部组件与二次开发
  tagline: 不重新构建客户端，直接扩展桌面应用。
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
    details: 插件用标准 Cordis 插件形态，在 apply(ctx) 里通过服务注册导航、组件、事件和命令。
  - title: 列扩展
    details: 注册自定义列组件和列属性编辑插槽，列设置中即可选择。
---
