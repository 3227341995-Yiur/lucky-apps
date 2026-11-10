import { definePlugin, navigation } from 'plugin-api'
import HomePage from './HomePage.vue'

export default definePlugin({
  name: 'home',
  apply() {
    navigation.register({
      id: 'home',
      label: '工作台',
      icon: 'HomeFilled',
      order: 0,
      component: HomePage,
    })
  },
})
