import HomePage from './HomePage.vue'

export default {
  name: '@lucky-apps/extension-home',
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
}
