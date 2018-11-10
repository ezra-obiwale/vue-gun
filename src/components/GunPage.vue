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
    rootKey: {
      type: String,
      default() {
        return window.location.hostname.replace(/\./g, '-')
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
      collection: null,
      currentItem: null,
      data: [],
      lastScope: true,
      publicScope: false,
      ready: false
    }
  },
  created () {
    this.$user.alive()
      .then(_ => {
        this.gunRoot = this.$user
        this.init()
      })
      .catch(_ => {
        this.gunRoot = this.publicRoot
        this.init()
      })
  },
  computed: {
    inPublic () {
      return this.publicScope || this.public
    },
    publicCollection () {
      return this.publicRoot.get(this.collectionName)
    },
    publicRoot () {
      return this.$gun.get(this.rootKey)
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
    _itemChanged (val, id, refs = []) {
      return new Promise((resolve, reject) => {
        if (val && typeof val == 'object') {
          val.$ref = this.scopedCollection().get(id)
          val.isforCurrentUser = () => this.deepValue(this.$user, 'is.pub') == val.$owner
          delete val._
          if (refs.length) {
            this.loadRefs(this.refs, val)
              .then(resolve)
              .catch(reject)
          } else {
            resolve(val)
          }
        } else if (val === null) {
          resolve(val)
        } else {
          reject()
        }
      })
    },
    delete (id, softly = false) {
      if (!id) {
        if (!this.currentItemId) {
          return Promise.reject(new Error('No id specified'))
        }
        id = this.currentItemId
      }
      if (!softly && !this.softDelete) {
        return new Promise(resolve => {
          this.scopedCollection().get(id)
            .put(null).once(_ => {
              resolve(null)
            })
          this.publicly().scopedCollection().get(id).put(null)
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
          $rootRef = this.scopedCollection()
        }
        let ref = $rootRef.get(id)
        ref.not(_ => {
          resolve(null)
        })
          .on(data => {
            this._itemChanged(data, id, withRefs)
              .then(data => {
                if (!data || typeof data != 'object') {
                  resolve(data)
                } else {
                  resolve(data.deletedAt && !this.withTrashed ? null : data)
                }
              })
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
          this.scopedCollection().map()
            .on((val, id) => {
              this._itemChanged(val, id, this.collectionRefs)
                .then(item => {
                  let index = this.data.findIndex(obj => obj.$id == id)
                  // item exists already
                  if (index > -1) {
                    // item has been deleted
                    if (!item || (item.deletedAt && !this.withTrashed)) {
                      // remove from item
                      this.data.splice(index, 1)
                    } else {
                      // replace old with new
                      this.data.splice(index, 1, item)
                    }
                  } else if (item && !item.deletedAt || this.withTrashed) {
                    // append to item
                    this.data.push(item)
                  }
                })
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
    privatize (id) {
      id = id || this.currentItemId
      if (!id) {
        return Promise.reject(new Error('ID not specified'))
      }
      return this.getItem(id)
        .then(item => {
          this.save({ ...item, $isPublic: false }, id)
          return this.publicly().delete(id)
        })
    },
    publicize (id) {
      id = id || this.currentItemId
      if (!id) {
        return Promise.reject(new Error('ID not specified'))
      }
      return this.getItem(id)
        .then(item => {
          return this.publicly().save(item, id)
        })
        .then(item => {
          this.publicScope = false
          return this.save({ ...item, $isPublic: true }, id)
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
          $rootRef = this.scopedCollection()
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
          if (data) {
            data.$ref = ref
            data.isforCurrentUser = () => this.deepValue(this.$user, 'is.pub') == data.$owner
          }
          resolve(data)
        })
      })
    },
    scopedCollection() {
      if (this.lastScope !== this.inPublic) {
        this.lastScope = this.inPublic
        this.$set(
          this, 'collection',
          this.inPublic
            ? this.publicRoot.get(this.collectionName)
            : this.gunRoot.get(this.collectionName)
        )
        this.publicScope = false
      }
      return this.collection
    },
    togglePublicity (id) {
      id = id || this.currentItemId
      if (!id) {
        return Promise.reject(new Error('ID not specified'))
      }
      this.publicly()
      return this.publicly().getItem(id)
        .then(item => {
          return item ? this.privatize(id) : this.publicize(id)
        })
    }
  }
}
</script>
