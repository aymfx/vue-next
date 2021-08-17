import {
  defineAsyncComponent,
  h,
  Component,
  ref,
  nextTick,
  Suspense
} from '../src'
import { createApp, nodeOps, serializeInner } from '@vue/runtime-test'

const timeout = (n: number = 0) => new Promise(r => setTimeout(r, n))

describe('api: defineAsyncComponent', () => {
  test('simple usage', async () => {
    //异步组件 可以通过 resolve 完成触发
    let resolve: (comp: Component) => void
    const Foo = defineAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r as any
        })
    )

    const toggle = ref(true)
    const root = nodeOps.createElement('div')
    createApp({
      render: () => (toggle.value ? h(Foo) : null)
    }).mount(root)
    console.log(serializeInner(root))
    expect(serializeInner(root)).toBe('<!---->')

    resolve!(() => 'resolved')
    // first time resolve, wait for macro task since there are multiple
    // microtasks / .then() calls
    await timeout()
    expect(serializeInner(root)).toBe('resolved')

    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toBe('<!---->')

    // already resolved component should update on nextTick
    toggle.value = true
    await nextTick()
    expect(serializeInner(root)).toBe('resolved')
  })

  test('with loading component', async () => {
    //设置loadinng loadingComponent 设置在加载是显示的默认组件 delay表示什么时间显示默认组价 默认200
    let resolve: (comp: Component) => void
    const Foo = defineAsyncComponent({
      loader: () =>
        new Promise(r => {
          resolve = r as any
        }),
      loadingComponent: () => 'loading',
      delay: 1 // defaults to 200
    })

    const toggle = ref(true)
    const root = nodeOps.createElement('div')
    createApp({
      render: () => (toggle.value ? h(Foo) : null)
    }).mount(root)

    // due to the delay, initial mount should be empty
    expect(serializeInner(root)).toBe('<!---->')

    // loading show up after delay
    await timeout(1)
    expect(serializeInner(root)).toBe('loading')

    resolve!(() => 'resolved')
    await timeout()
    expect(serializeInner(root)).toBe('resolved')

    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toBe('<!---->')
    //异步加载完了 不会因为被删除而重新加载
    // already resolved component should update on nextTick without loading
    // state
    toggle.value = true
    await nextTick()
    expect(serializeInner(root)).toBe('resolved')
  })

  test('with loading component + explicit delay (0)', async () => {
    // 默认loading组件会立即显示出来
    let resolve: (comp: Component) => void
    const Foo = defineAsyncComponent({
      loader: () =>
        new Promise(r => {
          resolve = r as any
        }),
      loadingComponent: () => 'loading',
      delay: 0
    })

    const toggle = ref(true)
    const root = nodeOps.createElement('div')
    createApp({
      render: () => (toggle.value ? h(Foo) : null)
    }).mount(root)

    // with delay: 0, should show loading immediately
    expect(serializeInner(root)).toBe('loading')

    resolve!(() => 'resolved')
    await timeout()
    expect(serializeInner(root)).toBe('resolved')

    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toBe('<!---->')

    // already resolved component should update on nextTick without loading
    // state
    toggle.value = true
    await nextTick()
    expect(serializeInner(root)).toBe('resolved')
  })

  test('error without error component', async () => {
    //检测组件异步组件reject  捕获状态
    let resolve: (comp: Component) => void
    let reject: (e: Error) => void
    const Foo = defineAsyncComponent(
      () =>
        new Promise((_resolve, _reject) => {
          resolve = _resolve as any
          reject = _reject
        })
    )

    const toggle = ref(true)
    const root = nodeOps.createElement('div')
    const app = createApp({
      render: () => (toggle.value ? h(Foo) : null)
    })

    const handler = (app.config.errorHandler = jest.fn())

    app.mount(root)
    expect(serializeInner(root)).toBe('<!---->')

    const err = new Error('foo')
    reject!(err)
    await timeout()
    expect(handler).toHaveBeenCalled()
    expect(handler.mock.calls[0][0]).toBe(err)
    expect(serializeInner(root)).toBe('<!---->')

    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toBe('<!---->')

    // errored out on previous load, toggle and mock success this time
    toggle.value = true
    await nextTick()
    expect(serializeInner(root)).toBe('<!---->')

    // should render this time
    resolve!(() => 'resolved')
    await timeout()
    expect(serializeInner(root)).toBe('resolved')
  })

  test('error with error component', async () => {
    // 可以通过errorComponent去捕获一个错误
    let resolve: (comp: Component) => void
    let reject: (e: Error) => void
    const Foo = defineAsyncComponent({
      loader: () =>
        new Promise((_resolve, _reject) => {
          resolve = _resolve as any
          reject = _reject
        }),
      errorComponent: (props: { error: Error }) => props.error.message
    })

    const toggle = ref(true)
    const root = nodeOps.createElement('div')
    const app = createApp({
      render: () => (toggle.value ? h(Foo) : null)
    })

    const handler = (app.config.errorHandler = jest.fn())

    app.mount(root)
    expect(serializeInner(root)).toBe('<!---->')

    const err = new Error('errored out')
    reject!(err)
    await timeout()
    expect(handler).toHaveBeenCalled()
    expect(serializeInner(root)).toBe('errored out')

    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toBe('<!---->')

    // errored out on previous load, toggle and mock success this time
    toggle.value = true
    await nextTick()
    expect(serializeInner(root)).toBe('<!---->')

    // should render this time
    resolve!(() => 'resolved')
    await timeout()
    expect(serializeInner(root)).toBe('resolved')
  })

  // #2129
  test('error with error component, without global handler', async () => {
    //来回切换 根据reslove 和reject 进行判断 显示什么结果
    let resolve: (comp: Component) => void
    let reject: (e: Error) => void
    const Foo = defineAsyncComponent({
      loader: () =>
        new Promise((_resolve, _reject) => {
          resolve = _resolve as any
          reject = _reject
        }),
      errorComponent: (props: { error: Error }) => props.error.message
    })

    const toggle = ref(true)
    const root = nodeOps.createElement('div')
    const app = createApp({
      render: () => (toggle.value ? h(Foo) : null)
    })

    app.mount(root)
    expect(serializeInner(root)).toBe('<!---->')

    const err = new Error('errored out')
    reject!(err)
    await timeout()
    expect(serializeInner(root)).toBe('errored out')
    expect(
      'Unhandled error during execution of async component loader'
    ).toHaveBeenWarned()

    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toBe('<!---->')

    // errored out on previous load, toggle and mock success this time
    toggle.value = true
    await nextTick()
    expect(serializeInner(root)).toBe('<!---->')

    // should render this time
    resolve!(() => 'resolved')
    await timeout()
    expect(serializeInner(root)).toBe('resolved')
  })

  test('error with error + loading components', async () => {
    //对于默认的加载组价 碰到reject也需要抛出错误
    let resolve: (comp: Component) => void
    let reject: (e: Error) => void
    const Foo = defineAsyncComponent({
      loader: () =>
        new Promise((_resolve, _reject) => {
          resolve = _resolve as any
          reject = _reject
        }),
      errorComponent: (props: { error: Error }) => props.error.message,
      loadingComponent: () => 'loading',
      delay: 1
    })

    const toggle = ref(true)
    const root = nodeOps.createElement('div')
    const app = createApp({
      render: () => (toggle.value ? h(Foo) : null)
    })

    const handler = (app.config.errorHandler = jest.fn())

    app.mount(root)

    // due to the delay, initial mount should be empty
    expect(serializeInner(root)).toBe('<!---->')

    // loading show up after delay
    await timeout(1)
    expect(serializeInner(root)).toBe('loading')

    const err = new Error('errored out')
    reject!(err)
    await timeout()
    expect(handler).toHaveBeenCalled()
    expect(serializeInner(root)).toBe('errored out')

    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toBe('<!---->')

    // errored out on previous load, toggle and mock success this time
    toggle.value = true
    await nextTick()
    expect(serializeInner(root)).toBe('<!---->')

    // loading show up after delay
    await timeout(1)
    expect(serializeInner(root)).toBe('loading')

    // should render this time
    resolve!(() => 'resolved')
    await timeout()
    expect(serializeInner(root)).toBe('resolved')
  })

  test('timeout without error component', async () => {
    //测试超时时错误没设置超时组件
    let resolve: (comp: Component) => void
    const Foo = defineAsyncComponent({
      loader: () =>
        new Promise(_resolve => {
          resolve = _resolve as any
        }),
      timeout: 1
    })

    const root = nodeOps.createElement('div')
    const app = createApp({
      render: () => h(Foo)
    })

    const handler = (app.config.errorHandler = jest.fn())

    app.mount(root)
    expect(serializeInner(root)).toBe('<!---->')

    await timeout(1)
    expect(handler).toHaveBeenCalled()
    expect(handler.mock.calls[0][0].message).toMatch(
      `Async component timed out after 1ms.`
    )
    expect(serializeInner(root)).toBe('<!---->')

    // if it resolved after timeout, should still work
    resolve!(() => 'resolved')
    await timeout()
    expect(serializeInner(root)).toBe('resolved')
  })

  test('timeout with error component', async () => {
    //设置了错误组件 不报错 显示错误组件
    let resolve: (comp: Component) => void
    const Foo = defineAsyncComponent({
      loader: () =>
        new Promise(_resolve => {
          resolve = _resolve as any
        }),
      timeout: 1,
      errorComponent: () => 'timed out'
    })

    const root = nodeOps.createElement('div')
    const app = createApp({
      render: () => h(Foo)
    })

    const handler = (app.config.errorHandler = jest.fn())

    app.mount(root)
    expect(serializeInner(root)).toBe('<!---->')

    await timeout(1)
    expect(handler).toHaveBeenCalled()
    expect(serializeInner(root)).toBe('timed out')

    // if it resolved after timeout, should still work
    resolve!(() => 'resolved')
    await timeout()
    expect(serializeInner(root)).toBe('resolved')
  })

  test('timeout with error + loading components', async () => {
    // 超时后 加载组件隐藏 显示错误组件
    let resolve: (comp: Component) => void
    const Foo = defineAsyncComponent({
      loader: () =>
        new Promise(_resolve => {
          resolve = _resolve as any
        }),
      delay: 1,
      timeout: 16,
      errorComponent: () => 'timed out',
      loadingComponent: () => 'loading'
    })

    const root = nodeOps.createElement('div')
    const app = createApp({
      render: () => h(Foo)
    })
    const handler = (app.config.errorHandler = jest.fn())
    app.mount(root)
    expect(serializeInner(root)).toBe('<!---->')
    await timeout(1)
    expect(serializeInner(root)).toBe('loading')

    await timeout(16)
    expect(serializeInner(root)).toBe('timed out')
    expect(handler).toHaveBeenCalled()

    resolve!(() => 'resolved')
    await timeout()
    expect(serializeInner(root)).toBe('resolved')
  })

  test('timeout without error component, but with loading component', async () => {
    //在超时后，没有错误组件 直接报错 加载组件隐藏
    let resolve: (comp: Component) => void
    const Foo = defineAsyncComponent({
      loader: () =>
        new Promise(_resolve => {
          resolve = _resolve as any
        }),
      delay: 1,
      timeout: 16,
      loadingComponent: () => 'loading'
    })

    const root = nodeOps.createElement('div')
    const app = createApp({
      render: () => h(Foo)
    })
    const handler = (app.config.errorHandler = jest.fn())
    app.mount(root)
    expect(serializeInner(root)).toBe('<!---->')
    await timeout(1)
    expect(serializeInner(root)).toBe('loading')

    await timeout(16)
    expect(handler).toHaveBeenCalled()
    expect(handler.mock.calls[0][0].message).toMatch(
      `Async component timed out after 16ms.`
    )
    // should still display loading
    expect(serializeInner(root)).toBe('loading')

    resolve!(() => 'resolved')
    await timeout()
    expect(serializeInner(root)).toBe('resolved')
  })

  test('with suspense', async () => {
    //异步加载组件，异步的控制权 交给父组件 在这种情况下，加载状态将由 <Suspense> 控制，组件自身的加载、错误、延迟和超时选项都将被忽略。
    let resolve: (comp: Component) => void
    const Foo = defineAsyncComponent(
      () =>
        new Promise(_resolve => {
          resolve = _resolve as any
        })
    )

    const root = nodeOps.createElement('div')
    const app = createApp({
      render: () =>
        h(Suspense, null, {
          default: () => h('div', [h(Foo), ' & ', h(Foo)]),
          fallback: () => 'loading'
        })
    })

    app.mount(root)
    expect(serializeInner(root)).toBe('loading')

    resolve!(() => 'resolved')
    await timeout()
    expect(serializeInner(root)).toBe('<div>resolved & resolved</div>')
  })

  test('suspensible: false', async () => {
    //suspensible: false 异步组件可以选择退出 Suspense 控制，并可以在其选项中指定 suspensible:false，让组件始终控制自己的加载状态。
    let resolve: (comp: Component) => void
    const Foo = defineAsyncComponent({
      loader: () =>
        new Promise(_resolve => {
          resolve = _resolve as any
        }),
      suspensible: false
    })

    const root = nodeOps.createElement('div')
    const app = createApp({
      render: () =>
        h(Suspense, null, {
          default: () => h('div', [h(Foo), ' & ', h(Foo)]),
          fallback: () => 'loading'
        })
    })

    app.mount(root)
    // should not show suspense fallback
    expect(serializeInner(root)).toBe('<div><!----> & <!----></div>')

    resolve!(() => 'resolved')
    await timeout()
    expect(serializeInner(root)).toBe('<div>resolved & resolved</div>')
  })

  test('suspense with error handling', async () => {
    //抛出异常 将不加载
    let reject: (e: Error) => void
    const Foo = defineAsyncComponent(
      () =>
        new Promise((_resolve, _reject) => {
          reject = _reject
        })
    )

    const root = nodeOps.createElement('div')
    const app = createApp({
      render: () =>
        h(Suspense, null, {
          default: () => h('div', [h(Foo), ' & ', h(Foo)]),
          fallback: () => 'loading'
        })
    })

    const handler = (app.config.errorHandler = jest.fn())
    app.mount(root)
    expect(serializeInner(root)).toBe('loading')

    reject!(new Error('no'))
    await timeout()
    expect(handler).toHaveBeenCalled()
    expect(serializeInner(root)).toBe('<div><!----> & <!----></div>')
  })

  test('retry (success)', async () => {
    //retry 一个函数，用于指示当 promise 加载器 reject 时，加载器是否应该重试 ,fail  一个函数，指示加载程序结束退出
    let loaderCallCount = 0
    let resolve: (comp: Component) => void
    let reject: (e: Error) => void

    const Foo = defineAsyncComponent({
      loader: () => {
        loaderCallCount++
        return new Promise((_resolve, _reject) => {
          resolve = _resolve as any
          reject = _reject
        })
      },
      onError(error, retry, fail) {
        if (error.message.match(/foo/)) {
          retry()
        } else {
          fail()
        }
      }
    })

    const root = nodeOps.createElement('div')
    const app = createApp({
      render: () => h(Foo)
    })

    const handler = (app.config.errorHandler = jest.fn())
    app.mount(root)
    expect(serializeInner(root)).toBe('<!---->')
    expect(loaderCallCount).toBe(1)

    const err = new Error('foo')
    reject!(err)
    await timeout()
    expect(handler).not.toHaveBeenCalled()
    expect(loaderCallCount).toBe(2)
    expect(serializeInner(root)).toBe('<!---->')

    // should render this time
    resolve!(() => 'resolved')
    await timeout()
    expect(handler).not.toHaveBeenCalled()
    expect(serializeInner(root)).toBe('resolved')
  })

  test('retry (skipped)', async () => {
    //走fail时
    let loaderCallCount = 0
    let reject: (e: Error) => void

    const Foo = defineAsyncComponent({
      loader: () => {
        loaderCallCount++
        return new Promise((_resolve, _reject) => {
          reject = _reject
        })
      },
      onError(error, retry, fail) {
        if (error.message.match(/bar/)) {
          retry()
        } else {
          fail()
        }
      }
    })

    const root = nodeOps.createElement('div')
    const app = createApp({
      render: () => h(Foo)
    })

    const handler = (app.config.errorHandler = jest.fn())
    app.mount(root)
    expect(serializeInner(root)).toBe('<!---->')
    expect(loaderCallCount).toBe(1)

    const err = new Error('foo')
    reject!(err)
    await timeout()
    // should fail because retryWhen returns false
    expect(handler).toHaveBeenCalled()
    expect(handler.mock.calls[0][0]).toBe(err)
    expect(loaderCallCount).toBe(1)
    expect(serializeInner(root)).toBe('<!---->')
  })

  test('retry (fail w/ max retry attempts)', async () => {
    //attempts 允许的最大重试次数
    let loaderCallCount = 0
    let reject: (e: Error) => void

    const Foo = defineAsyncComponent({
      loader: () => {
        loaderCallCount++
        return new Promise((_resolve, _reject) => {
          reject = _reject
        })
      },
      onError(error, retry, fail, attempts) {
        if (error.message.match(/foo/) && attempts <= 1) {
          retry()
        } else {
          fail()
        }
      }
    })

    const root = nodeOps.createElement('div')
    const app = createApp({
      render: () => h(Foo)
    })

    const handler = (app.config.errorHandler = jest.fn())
    app.mount(root)
    expect(serializeInner(root)).toBe('<!---->')
    expect(loaderCallCount).toBe(1)

    // first retry
    const err = new Error('foo')
    reject!(err)
    await timeout()
    expect(handler).not.toHaveBeenCalled()
    expect(loaderCallCount).toBe(2)
    expect(serializeInner(root)).toBe('<!---->')

    // 2nd retry, should fail due to reaching maxRetries 超过一次后开始报错
    reject!(err)
    await timeout()
    expect(handler).toHaveBeenCalled()
    expect(handler.mock.calls[0][0]).toBe(err)
    expect(loaderCallCount).toBe(2)
    expect(serializeInner(root)).toBe('<!---->')
  })

  test('template ref forwarding', async () => {
    let resolve: (comp: Component) => void
    const Foo = defineAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r as any
        })
    )

    const fooRef = ref<any>(null)
    const toggle = ref(true)
    const root = nodeOps.createElement('div')
    createApp({
      render: () => (toggle.value ? h(Foo, { ref: fooRef }) : null)
    }).mount(root)

    expect(serializeInner(root)).toBe('<!---->')
    expect(fooRef.value).toBe(null)

    resolve!({
      data() {
        return {
          id: 'foo'
        }
      },
      render: () => 'resolved'
    })
    // first time resolve, wait for macro task since there are multiple
    // microtasks / .then() calls
    await timeout()
    expect(serializeInner(root)).toBe('resolved')
    expect(fooRef.value.id).toBe('foo')

    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toBe('<!---->')
    expect(fooRef.value).toBe(null)

    // already resolved component should update on nextTick
    toggle.value = true
    await nextTick()
    expect(serializeInner(root)).toBe('resolved')
    expect(fooRef.value.id).toBe('foo')
  })

  // #3188
  test('the forwarded template ref should always exist when doing multi patching', async () => {
    let resolve: (comp: Component) => void
    const Foo = defineAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r as any
        })
    )

    const fooRef = ref<any>(null)
    const toggle = ref(true)
    const updater = ref(0)

    const root = nodeOps.createElement('div')
    createApp({
      render: () =>
        toggle.value ? [h(Foo, { ref: fooRef }), updater.value] : null
    }).mount(root)

    expect(serializeInner(root)).toBe('<!---->0')
    expect(fooRef.value).toBe(null)

    resolve!({
      data() {
        return {
          id: 'foo'
        }
      },
      render: () => 'resolved'
    })

    await timeout()
    expect(serializeInner(root)).toBe('resolved0')
    expect(fooRef.value.id).toBe('foo')

    updater.value++
    await nextTick()
    expect(serializeInner(root)).toBe('resolved1')
    expect(fooRef.value.id).toBe('foo')

    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toBe('<!---->')
    expect(fooRef.value).toBe(null)
  })
})
