<template>
  <div>
    <slot :data="data" :current-item="currentItem" />
  </div>
</template>

<script>
export default {
  name: 'GunPage',
  props: {
    collectionName: {
      type: String,
      required: true
    },
    createdAt: {
      type: Boolean,
      default: true
    },
    currentItemKey: {
      type: String
    },
    filter: {
      type: Function,
      default: function () {
        return collection => collection
      }
    },
    pagination: {
      type: [Object, Boolean],
      default: function () {
        return {
          append: true,
          page: 1,
          rowsPerPage: 15
        }
      }
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
  computed: {
    collection () {
      return this.publicScope
        ? this.$gun.get(this.rootKey)
        : this.gunRoot.get(this.collectionName)
    },
    rootKey () {
      return window.location.hostname.replace(/\./g, '-')
    }
  },
  watch: {
    collectionName () {
      this.$emit('resetPagination', {
        append: true,
        page: 1,
        rowsPerPage: 15
      })
      this.init()
    },
    currentItemKey () {
      this.init()
    }
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
        return new Promise((resolve, reject) => {
          this.collection.get(key).put(null).once(() => {
            this.publicScope = false
            resolve(null)
          })
        })
      }
      return this.save({
        deletedAt: Date.now()
      }, key)
    },
    getItem (key) {
      return new Promise((resolve, reject) => {
        if (!key) {
          this.publicScope = false
          reject(new Error(`No key specified`))
        }
        this.collection.get(key).on(data => {
          if (!data || typeof data != 'object') {
            this.publicScope = false
            return resolve(data)
          }
          delete data._
          this.publicScope = false
          resolve(data.deletedAt && !this.withTrashed ? null : data)
        })
      })
    },
    init () {
      this.$set(this, 'data', [])
      this.$set(this, 'currentItem', null)
      if (this.collectionName) {
        if (this.currentItemKey) {
          this.getItem(this.currentItemKey)
            .then(data => this.$set(this, 'currentItem', data))
        } else {
          this.collection.map()
            .on((val, key) => {
              let index = this.data.findIndex(data => data.$key == key)
              if (val && typeof val == 'object') {
                delete val._
                val.$key = key
              }
              if (index > -1) {
                if (!val || (val.deletedAt && !this.withTrashed)) {
                  this.data.splice(index, 1)
                } else {
                  this.data.splice(index, 1, val)
                }
              } else if (val && typeof val == 'object' && (!val.deletedAt || this.withTrashed)) {
                this.data.push(val)
              }
            })
        }
      }
      return this
    },
    publicly () {
      this.publicScope = true
      return this
    },
    save (data, key) {
      if (!key) {
        key = this.currentItemKey
      }
      return new Promise((resolve, reject) => {
        if (typeof data !== 'object') {
          this.publicScope = false
          return reject(new Error('Data to be saved must be an object'))
        } else if (data === null) {
          this.publicScope = false
          return reject(new Error('Data cannot be null. Please use the delete method'))
        }
        if (this.updatedAt) {
          data.updatedAt = Date.now()
        }
        // data = { ...data }
        delete data.$key

        let res
        if (key) {
          res = this.$gun.get(key).put(data)
        } else if (data) {
          if (this.createdAt) {
            data.createdAt = Date.now()
          }
          res = this.collection.set(data)
        } else {
          this.publicScope = false
          reject(new Error('No data provided'))
        }
        res.once((data, key) => {
          data.$key = key
          this.publicScope = false
          resolve(data)
        })
      })
    }
  }
}
</script>
