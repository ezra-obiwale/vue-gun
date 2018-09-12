<template>
  <div>
    <slot :data="data" :current-item="currentItem" />
  </div>
</template>

<script>
import Gun from 'gun/gun'

export default {
  name: 'GunPage',
  props: {
    collectionName: {
      type: String,
      required: true
    },
    collectionRefs: {
      type: Array,
      default: function () {
        return []
      }
    },
    createdAt: {
      type: Boolean,
      default: true
    },
    currentItemKey: {
      type: String
    },
    public: {
      type: Boolean,
      default: false
    },
    searchQuery: {
      type: String,
      default: ''
    },
    softDelete: {
      type: Boolean,
      default: false
    },
    updatedAt: {
      type: Boolean,
      default: true
    },
    withTrashed: {
      type: Boolean,
      default: false
    }
  },
  data () {
    return {
      currentItem: null,
      data: [],
      publicScope: false,
      ready: false
    }
  },
  created () {
    this.$user.alive()
      .then(() => {
        this.gunRoot = this.$user
        this.init()
      })
      .catch(() => {
        this.gunRoot = this.$gun.get(this.rootKey)
        this.init()
      })
  },
  methods: {
    delete (key) {
      if (!key) {
        if (!this.currentItemKey) {
          return Promise.reject(new Error('No key specified'))
        }
        key = this.currentItemKey
      }
      if (!this.softDelete) {
        return new Promise(resolve => {
          this.collection.get(key)
            .put(null).once(_ => {
              resolve()
            })
        })
      }
      return this.save({
        deletedAt: Gun.time.is()
      }, key)
    },
    getItem (key, withRefs = [], $rootRef) {
      return new Promise((resolve, reject) => {
        if (!key) {
          return reject(new Error(`No key specified`))
        }
        if (!$rootRef) {
          $rootRef = this.collection
        }
        let ref = $rootRef.get(key)
        ref.not((a,b,c) => {
          resolve(null)
        })
          .on((data, key) => {
            if (!data || typeof data != 'object') {
              return resolve(data)
            }
            data.$key = key
            data.$ref = ref
            delete data._
            if (withRefs.length) {
              this.loadRefs(withRefs, data)
                .then(data => {
                  resolve(data.deletedAt && !this.withTrashed ? null : data)
                })
              return
            }
            resolve(data.deletedAt && !this.withTrashed ? null : data)
          }, true)
        })
    },
    init () {
      this.$set(this, 'data', [])
      this.$set(this, 'currentItem', null)
      if (this.collectionName) {
        if (this.currentItemKey) {
          this.getItem(this.currentItemKey, this.collectionRefs)
            .then(data => this.$set(this, 'currentItem', data))
        } else {
          const finish = (data, key) => {
            let index = this.data.findIndex(obj => obj.$key == key)
            // value exists already
            if (index > -1) {
              // value has been deleted
              if (!data || (data.deletedAt && !this.withTrashed)) {
                // remove from data
                this.data.splice(index, 1)
              } else {
                // replace old with new
                this.data.splice(index, 1, data)
              }
            } else if (!data.deletedAt || this.withTrashed) {
              // append to data
              this.data.push(data)
            }
          }
          this.collection.map()
            .on((val, key) => {
              if (val && typeof val == 'object') {
                val.$key = key
                val.$ref = this.collection.get(key)
                delete val._
                if (this.collectionRefs.length) {
                  this.loadRefs(this.collectionRefs, val)
                    .then(data => finish(data, key))
                } else {
                  finish(val, key)
                }
              }
            })
        }
      }
      return this
    },
    loadRefs(refs, data) {
      if (!Array.isArray(refs) || !refs.length) {
        return Promise.reject(new Error('No refs given'))
      } else if (!data) {
        return Promise.reject(new Error('No data given'))
      } else if (!data.$ref) {
        return Promise.reject(new Error('Invalid data given'))
      }
      return new Promise(resolve => {
        let resolved = 0
        refs.forEach(ref => {
          let parts = ref.split('.'),
            firstKey = parts.shift()
          return this.getItem(firstKey, parts.length ? [parts.join('.')] : [], data.$ref)
            .then(res => {
              data[`$${ref}`] = res
              resolved++
              if (resolved == refs.length) {
                resolve(data)
              }
            })
        })
      })
    },
    publicly () {
      this.publicScope = true
      return this
    },
    save (data, key, $rootRef) {
      if (!key) {
        key = this.currentItemKey
      }
      return new Promise((resolve, reject) => {
        if (typeof data !== 'object') {
          return reject(new Error('Data to be saved must be an object'))
        } else if (data === null) {
          return reject(new Error('Data cannot be null. Please use the delete method'))
        }
        if (!$rootRef) {
          $rootRef = this.collection
        }
        if (this.updatedAt) {
          data.updatedAt = Gun.time.is()
        }
        data = { ...data }
        delete data.$key

        let ref
        if (key) {
          ref = $rootRef.get(key).put(data)
        } else if (data) {
          if (this.createdAt) {
            data.createdAt = Gun.time.is()
          }
          ref = this.collection.set(data)
        } else {
          reject(new Error('No data provided'))
        }
        ref.once((data, key) => {
          data.$key = key
          data.$ref = ref
          resolve(data)
        })
      })
    }
  },
  computed: {
    collection () {
      let collection = this.publicScope || this.public
        ? this.$gun.get(this.rootKey)
        : this.gunRoot.get(this.collectionName)
      this.publicScope = false
      return collection
    },
    rootKey () {
      return window.location.hostname.replace(/\./g, '-')
    }
  },
  watch: {
    collectionName () {
      this.init()
    },
    currentItem (item) {
      this.$emit('currentItemUpdated', item)
    },
    currentItemKey () {
      this.init()
    },
    data (data) {
      this.$emit('dataUpdated', data)
    }
  }
}
</script>
