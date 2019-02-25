import Gun from 'gun/gun'
import SEA from 'gun/sea'
import GunNot from 'gun/lib/not.js'
import GunBye from 'gun/lib/bye.js'
import GunUnset from 'gun/lib/unset.js'
export default {
    install: function (Vue, options) {
      const $gun = Gun(options)
      Vue.prototype.$gun = $gun
      Vue.prototype.$user = $gun.user()
      Vue.prototype.$SEA = SEA
      Vue.component('gun-page', () => import('./components/GunPage.vue'))
    }
  }
