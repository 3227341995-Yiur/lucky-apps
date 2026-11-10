import { definePlugin, navigation } from '@week-report/plugin-api'
import TrashNavIcon from './TrashNavIcon.vue'
import TrashPage from './TrashPage.vue'

export default definePlugin({
  name: 'trash-bin',
  apply() {
    navigation.register({
      id: 'trash-bin',
      label: '回收站',
      iconComponent: TrashNavIcon,
      order: 20,
      component: TrashPage
    })
  }
})
