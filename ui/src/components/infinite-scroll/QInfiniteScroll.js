import { h, defineComponent, ref, computed, watch, onMounted, onBeforeUnmount, nextTick, getCurrentInstance } from 'vue'

import debounce from '../../utils/debounce.js'
import { height } from '../../utils/dom.js'
import { getScrollTarget, getScrollHeight, getScrollPosition, setScrollPosition } from '../../utils/scroll.js'
import { listenOpts } from '../../utils/event.js'
import { hSlot, hUniqueSlot } from '../../utils/composition-render.js'

export default defineComponent({
  name: 'QInfiniteScroll',

  props: {
    offset: {
      type: Number,
      default: 500
    },

    debounce: {
      type: [ String, Number ],
      default: 100
    },

    scrollTarget: {
      default: void 0
    },

    initialIndex: Number,

    disable: Boolean,
    reverse: Boolean
  },

  emits: ['load'],

  setup (props, { slots, emit }) {
    const fetching = ref(false)
    const rootRef = ref(null)

    let index = props.initialIndex || 0
    let isWorking = true
    let localScrollTarget, immediatePoll

    const classes = computed(() =>
      'q-infinite-scroll__loading' +
      (fetching.value === true ? '' : ' invisible')
    )

    function poll () {
      if (props.disable === true || fetching.value === true || isWorking === false) {
        return
      }

      const
        scrollHeight = getScrollHeight(localScrollTarget),
        scrollPosition = getScrollPosition(localScrollTarget),
        containerHeight = height(localScrollTarget)

      if (props.reverse === false) {
        if (scrollPosition + containerHeight + props.offset >= scrollHeight) {
          trigger()
        }
      }
      else {
        if (scrollPosition < props.offset) {
          trigger()
        }
      }
    }

    function trigger () {
      if (props.disable === true || fetching.value === true || isWorking === false) {
        return
      }

      index++
      fetching.value = true

      const heightBefore = getScrollHeight(localScrollTarget)

      emit('load', index, stop => {
        if (isWorking === true) {
          fetching.value = false
          nextTick(() => {
            if (props.reverse === true) {
              const
                heightAfter = getScrollHeight(localScrollTarget),
                scrollPosition = getScrollPosition(localScrollTarget),
                heightDifference = heightAfter - heightBefore

              setScrollPosition(localScrollTarget, scrollPosition + heightDifference)
            }

            if (stop === true) {
              stop()
            }
            else if (rootRef.value !== null) {
              rootRef.value.closest('body') && poll()
            }
          })
        }
      })
    }

    function reset () {
      index = 0
    }

    function resume () {
      if (isWorking === false) {
        isWorking = true
        localScrollTarget.addEventListener('scroll', poll, listenOpts.passive)
      }

      immediatePoll()
    }

    function stop () {
      if (isWorking === true) {
        isWorking = false
        fetching.value = false
        localScrollTarget.removeEventListener('scroll', poll, listenOpts.passive)
      }
    }

    function updateScrollTarget () {
      if (localScrollTarget && isWorking === true) {
        localScrollTarget.removeEventListener('scroll', poll, listenOpts.passive)
      }

      localScrollTarget = getScrollTarget(rootRef.value, props.scrollTarget)

      if (isWorking === true) {
        localScrollTarget.addEventListener('scroll', poll, listenOpts.passive)
      }
    }

    function setIndex (newIndex) {
      index = newIndex
    }

    // expose public methods
    const vm = getCurrentInstance()
    Object.assign(vm.proxy, {
      poll, trigger, stop, reset, resume, setIndex
    })

    function setDebounce (val) {
      val = parseInt(val, 10)
      if (val <= 0) {
        poll = immediatePoll
      }
      else {
        poll = debounce(immediatePoll, isNaN(val) === true ? 100 : val)
      }
    }

    watch(() => props.disable, val => {
      if (val === true) {
        stop()
      }
      else {
        resume()
      }
    })

    watch(() => props.scrollTarget, updateScrollTarget)
    watch(() => props.debounce, setDebounce)

    onBeforeUnmount(() => {
      if (isWorking === true) {
        localScrollTarget.removeEventListener('scroll', poll, listenOpts.passive)
      }
    })

    onMounted(() => {
      immediatePoll = poll
      setDebounce(props.debounce)

      updateScrollTarget()

      if (props.reverse === true) {
        const
          scrollHeight = getScrollHeight(localScrollTarget),
          containerHeight = height(localScrollTarget)

        setScrollPosition(localScrollTarget, scrollHeight - containerHeight)
      }

      immediatePoll()
    })

    return () => {
      const child = hUniqueSlot(slots.default, [])

      if (props.disable !== true && isWorking === true) {
        child[ props.reverse === false ? 'push' : 'unshift' ](
          h('div', { class: classes.value }, hSlot(slots.loading))
        )
      }

      return h('div', {
        class: 'q-infinite-scroll',
        ref: rootRef
      }, child)
    }
  }
})
