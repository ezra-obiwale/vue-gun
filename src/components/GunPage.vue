<template>
  <div>
    <slot :data="data" :current-item="currentItem" />
  </div>
</template>

<script>
const uuidv4 = require('uuid/v4')
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
    currentItemId: {
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
        this.gunRoot = this.publicRoot
        this.init()
      })
  },
  computed: {
    collection () {
      let collection = this.publicScope || this.public
        ? this.publicRoot.get(this.collectionName)
        : this.gunRoot.get(this.collectionName)
      this.publicScope = false
      return collection
    },
    publicRoot () {
      return this.$gun.get(this.rootKey)
    },
    rootKey () {
      return window.location.hostname.replace(/\./g, '-')
    }
  },
  watch: {
    collectionName () {
      this.init()
    },
    collectionRefs () {
      this.init()
    },
    currentItem (item) {
      this.$emit('currentItemUpdated', item)
    },
    currentItemId () {
      this.init()
    },
    data (data) {
      this.$emit('dataUpdated', data)
    },
    public () {
      this.init()
    }
  },
  methods: {
    delete (id) {
      if (!id) {
        if (!this.currentItemId) {
          return Promise.reject(new Error('No id specified'))
        }
        id = this.currentItemId
      }
      if (!this.softDelete) {
        return new Promise(resolve => {
          this.collection.get(id)
            .put(null).once(_ => {
              resolve(null)
            })
          this.publicly().collection.get(id).put(null)
        })
      }
      return this.save({
        deletedAt: Date.now()
      }, id)
    },
    getItem (id, withRefs = [], $rootRef) {
      return new Promise((resolve, reject) => {
        if (!id) {
          return reject(new Error(`No id specified`))
        }
        if (!$rootRef) {
          // $rootRef = this.collection
          $rootRef = this.$gun
        }
        let ref = $rootRef.get(id)
        ref.not((a,b,c) => {
          resolve(null)
        })
          .on(data => {
            if (!data || typeof data != 'object') {
              return resolve(data)
            }
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
        if (this.currentItemId) {
          this.getItem(this.currentItemId, this.collectionRefs)
            .then(data => this.$set(this, 'currentItem', data))
        } else {
          const finish = (data, id) => {
            let index = this.data.findIndex(obj => obj.$id == id)
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
            } else if (data && !data.deletedAt || this.withTrashed) {
              // append to data
              this.data.push(data)
            }
          }
          this.collection.map()
            .on((val, id) => {
              if (val && typeof val == 'object') {
                val.$ref = this.collection.get(id)
                val.isforCurrentUser = () => this.deepValue(this.$user, 'is.pub') == val.$owner
                delete val._
                if (this.collectionRefs.length) {
                  this.loadRefs(this.collectionRefs, val)
                    .then(data => finish(data, id))
                } else {
                  finish(val, id)
                }
              } else if (val === null) {
                finish(val, id)
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
    save (data, id, $rootRef) {
      return new Promise((resolve, reject) => {
        if (!this.currentItem) {
          if (typeof data !== 'object') {
            return reject(new Error('Data to be saved must be an object'))
          } else if (data === null) {
            return reject(new Error('Data cannot be null. Please use the delete method'))
          }
        }
        let ref
        if (!id) {
          id = this.currentItemId
        }
        if (!$rootRef) {
          $rootRef = this.collection
        }
        if (data) {
          if (this.updatedAt) {
            data.updatedAt = Date.now()
          }
          data = { ...data }

          delete data.$ref
          delete data.isforCurrentUser

          if (id) {
            ref = $rootRef.get(id).put(data)
          } else {
            if (this.createdAt) {
              data.createdAt = Date.now()
            }
            data.$id = uuidv4()
            if (this.$user.is) {
              data.$owner = this.deepValue(this.$user, 'is.pub')
            }
            ref = this.$gun.get(data.$id).put(data)
            $rootRef.get(data.$id).put(ref)
          }
        } else if (id && id == this.currentItemId) {
          ref = this.currentItem.$ref
          $rootRef.get(id).put(ref)
        } else {
          reject(new Error('No data provided'))
        }
        ref.once(data => {
          data.$ref = ref
          data.isforCurrentUser = () => this.deepValue(this.$user, 'is.pub') == data.$owner
          resolve(data)
        })
      })
    }
  }
}
</script>
