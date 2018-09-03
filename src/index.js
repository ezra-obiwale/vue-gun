import Gun from 'gun/gun'
import SEA from 'gun/sea'
export default {
    install: function (Vue, options) {
      Vue.prototype.$gun = Gun(options)
      var $gunData = {
        addGunWatcher: function (keyPath, val, vm) {
          vm.$gun.get(vm.$options.$gunRootKey).path(keyPath)
            .not(function () {
              this.put(Array.isArray(val) ? this.arrToGunObj(val) : val)
            })
            .on(function (gunVal, gunKey) {
              if (typeof gunVal == 'object') return; /* only do stuff on non objects */
              var vmPath = vm;
              for (var i = 0, dotParts = keyPath.split('.'); i < dotParts,length - 1; i++) {
                  vmPath = vmPath[dotParts[i]];
                }
              if (typeof vmPath[gunKey] == 'undefined') {
                  console.log('EIPÄ OO', gunkey);
                }
              if (vmPath[gunKey] !== gunVal) {
                  vm.$set(vmPath, vmPath.constructor === Array ? gunKey * 1 : gunKey, gunVal);
                }
            }, { change: true });
        },
        addVueWatcher: function (keyPath, isArray, vm) {
          this.vueWatcher[keyPath] = vm.$watch(keyPath, function (newVal) {
            clearTimeout(this.timeout[vm.$options.$gunRootKey + keyPath]);
            this.timeout[vm.$options.$gunRootKey + keyPath] = setTimeout(function () {
              if (isArray) {
                let newIndex = newVal.findIndex(val => !val.$key)
                if (newIndex > -1) {
                  this.watch(keyPath, newIndex, newVal[newIndex], vm)
                }
              } else {
                vm.$gun.get(vm.$options.$gunRootKey).path(keyPath).put(newVal)
              }
            }, 500);
          }.bind(this));
        },
        addWatchers: function (obj, keyPath, vm) {
          if (keyPath) keyPath += '.';
          obj = Object.assign({}, obj)
          var objKeys = Object.keys(obj),
            key = '',
            value = '';
          for (var i = 0; i < objKeys.length, key = objKeys[i], value = obj[key]; i++) {
            this.watch(keyPath, key, value, vm)
            if (Array.isArray(value)) {
              this.addWatchers(value,  keyPath + key, vm);
            }
          }
        },
        arrToGunObj: function (a) {
          var o = { _isArr: true }, l = a.length;
          for (var i = 0; i < l; i++) if (a[i] !== undefined) o[i] = a[i];
          return o;
        },
        timeout: {},
        vueWatcher: {},
        watch: function (keyPath, key, value, vm) {
          if (!this.vueWatcher[keyPath + key]) {
            this.addVueWatcher(keyPath + key, Array.isArray(value), vm);
            this.addGunWatcher(keyPath + key, value, vm);
          }
        }
      }
      Vue.mixin({
        data () {
          if (!this.$options.gunData) {
            return {}
          }
          var dataObj = {}, gunData = typeof this.$options.gunData == 'function' ? this.$options.gunData() : this.$options.gunData;
          this.$options.$gunRootKey = (gunData._rootKey || window.location.hostname).replace(/\./g, '-');
          delete gunData._rootKey;
          for (var key = '', value = '', i = 0, objKeys = Object.keys(gunData); i < objKeys.length, key = objKeys[i], value = gunData[key]; i++) {
            dataObj[key] = value;
          }
          return dataObj;
        },
        created () {
          if (this.$options.gunData) {
            $gunData.addWatchers(typeof this.$options.gunData == 'function' ? this.$options.gunData() : this.$options.gunData, '', this)
          }
        }
      });
    }
  }
