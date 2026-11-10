import { definePlugin } from 'plugin-api'
import HomePage from './HomePage.vue'

export default definePlugin({
  name: 'home',
  inject: ['navigation'],
  apply(ctx) {
    ctx.navigation.register({
      id: 'home',
      label: '工作台',
      icon: 'HomeFilled',
      order: 0,
      component: HomePage,
    })
  },
})
