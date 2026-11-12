import TrashNavIcon from './TrashNavIcon.vue'
import TrashPage from './TrashPage.vue'

export default {
  name: '@lucky-apps/extension-trash-bin',
  inject: ['navigation'],
  apply(ctx) {
    ctx.navigation.register({
      id: 'trash-bin',
      label: '回收站',
      iconComponent: TrashNavIcon,
      order: 20,
      component: TrashPage,
    })
  },
}
