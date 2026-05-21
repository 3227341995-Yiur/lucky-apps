import { createVNode, render } from 'vue'
import ContextMenu from '@/components/ContextMenu.vue'

// 菜单配置定义
const menuConfigs = {
  config: [
    { id: 'modify', label: '修改默认配置', icon: 'fas fa-edit' },
    { id: 'show', label: '查看默认配置', icon: 'fas fa-eye' },
    { id: 'clear', label: '清空默认配置', icon: 'fas fa-trash' },
    { id: 'weekly-import', label: '导入周报', icon: 'fas fa-file-import' },
    { id: 'weekly-export', label: '导出周报', icon: 'fas fa-file-export' }
  ],
  column: [
    { id: 'change-component', label: '更换列组件配置', icon: 'fas fa-exchange-alt' }
  ]
}

let contextMenuInstance = null

export default {
  mounted(el, binding) {
    const context = binding.arg || 'default'
    const appContext = binding.instance.appContext

    el._contextmenuHandler = (e) => {
      e.preventDefault()
      e.stopPropagation()

      // 销毁现有菜单
      closeContextMenu()

      // 获取配置
      const config = menuConfigs[context] || []

      // 创建菜单容器
      const container = document.createElement('div')
      document.body.appendChild(container)

      // 创建菜单组件
      const vnode = createVNode(ContextMenu, {
        menuItems: config,
        position: { x: e.clientX, y: e.clientY },
        onSelect: (item) => {
          // 触发自定义事件
          const event = new CustomEvent(`contextmenu-${context}-${item.id}`, {
            detail: {
              originalEvent: e,
              target: el,
              data: binding.value
            }
          })
          el.dispatchEvent(event)
          closeContextMenu()
        },
        onClose: closeContextMenu
      })

      // 设置应用上下文
      vnode.appContext = appContext

      // 渲染组件
      render(vnode, container)

      contextMenuInstance = {
        vnode,
        container,
        close: () => {
          render(null, container)
          document.body.removeChild(container)
          contextMenuInstance = null
        }
      }

      // 点击其他地方关闭菜单
      const closeMenu = () => {
        closeContextMenu()
        document.removeEventListener('click', closeMenu)
      }

      document.addEventListener('click', closeMenu, { once: true })
    }

    el.addEventListener('contextmenu', el._contextmenuHandler)
  },
  unmounted(el) {
    if (el._contextmenuHandler) {
      el.removeEventListener('contextmenu', el._contextmenuHandler)
    }
    closeContextMenu()
  }
}

function closeContextMenu() {
  if (contextMenuInstance) {
    contextMenuInstance.close()
    contextMenuInstance = null
  }
}