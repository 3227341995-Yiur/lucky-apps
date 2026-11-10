import { definePlugin, navigation } from '@week-report/plugin-api'
import DesignerPage from './DesignerPage.vue'

export default definePlugin({
  name: 'structure-designer',
  apply() {
    navigation.register({
      id: 'structure-designer',
      label: '周报设计',
      icon: 'MagicStick',
      order: 30,
      component: DesignerPage
    })
  }
})
