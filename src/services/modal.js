import { createVNode, render } from 'vue'

let instanceCounter = 0
const instances = new Map()

export default {
  install(app) {
    app.provide('$modal', {
      open(
          component,
          options = {
            attrs: {},
            listeners: {}
          },
          config = {
            closeDestroyed: true
          }
      ) {
        const instanceId = `dynamic-component-${++instanceCounter}`
        const container = document.createElement('div')
        container.id = instanceId
        document.body.appendChild(container)

        // 关闭时销毁组件
        if (config.closeDestroyed) {
          options.listeners = options.listeners || {}
          const close = options.listeners.close
          options.listeners.close = () => {
            close?.()
            this.close(instanceId)
          }
        }

        // 将监听器转换为onXXX形式
        const normalizedListeners = {}
        if (options.listeners) {
          Object.keys(options.listeners).forEach(event => {
            const normalizedEvent = 'on' + event.charAt(0).toUpperCase() + event.slice(1)
            normalizedListeners[normalizedEvent] = options.listeners[event]
          })
        }

        const vnode = createVNode(component, {
          ...options.attrs,
          ...normalizedListeners
        })

        vnode.appContext = app._context

        render(vnode, container)

        const instance = {
          id: instanceId,
          vnode,
          container,
          ...vnode.component.exposed,
          close: () => {
            render(null, container)
            document.body.removeChild(container)
            instances.delete(instanceId)
          }
        }

        instances.set(instanceId, instance)
        return instance
      },
      close(instanceId) {
        const instance = instances.get(instanceId)
        if (instance) {
          instance.close()
        }
      },
      closeAll() {
        instances.forEach(instance => instance.close())
        instances.clear()
      }
    })
  }
}