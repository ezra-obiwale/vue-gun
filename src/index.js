import Gun from 'gun/gun'
import SEA from 'gun/sea'
export default {
    install: function (Vue, options) {
      const $gun = Gun(options)
      Vue.prototype.$gun = $gun
      Vue.prototype.$user = $gun.user()
      Vue.component('gun-page', () => import('./components/GunPage.vue'))
    }
  }
