import {
  h,
  provide,
  inject,
  InjectionKey,
  ref,
  nextTick,
  Ref,
  readonly,
  reactive,
  defineComponent
} from '../src/index'
import { render, nodeOps, serialize } from '@vue/runtime-test'

// reference: https://vue-composition-api-rfc.netlify.com/api.html#provide-inject
describe('api: provide/inject', () => {
  //像孙子元素传递信息
  it('string keys', () => {
    const Provider = {
      setup() {
        provide('foo', 1)
        return () => h(Middle)
      }
    }

    const Middle = {
      render: () => h(Consumer)
    }

    const Consumer = {
      setup() {
        const foo = inject('foo')
        return () => foo
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Provider), root)
    expect(serialize(root)).toBe(`<div>1</div>`)
  })

  it('symbol keys', () => {
    // also verifies InjectionKey type sync
    // symbol也可以进行传递
    const key: InjectionKey<number> = Symbol()

    const Provider = {
      setup() {
        provide(key, 1)
        return () => h(Middle)
      }
    }

    const Middle = {
      render: () => h(Consumer)
    }

    const Consumer = {
      setup() {
        const foo = inject(key) || 1
        return () => foo + 1
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Provider), root)
    expect(serialize(root)).toBe(`<div>2</div>`)
  })

  it('default values', () => {
    //  inject 的第二个参数可以设置默认值
    const Provider = {
      setup() {
        provide('foo', 'foo')
        return () => h(Middle)
      }
    }

    const Middle = {
      render: () => h(Consumer)
    }

    const Consumer = {
      setup() {
        // default value should be ignored if value is provided
        const foo = inject('foo', 'fooDefault')
        // default value should be used if value is not provided
        const bar = inject('bar', 'bar')
        return () => foo + bar
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Provider), root)
    expect(serialize(root)).toBe(`<div>foobar</div>`)
  })

  it('bound to instance', () => {
    // inject 也可以是一个对象的形式 {from:xx,default(){return xxx}}
    const Provider = {
      setup() {
        return () => h(Consumer)
      }
    }

    const Consumer = defineComponent({
      name: 'Consumer',
      inject: {
        foo: {
          from: 'foo',
          default() {
            return this!.$options.name
          }
        }
      },
      render() {
        // @ts-ignore
        return this.foo
      }
    })

    const root = nodeOps.createElement('div')
    render(h(Provider), root)
    expect(serialize(root)).toBe(`<div>Consumer</div>`)
  })

  it('nested providers', () => {
    // 就近原则 最近的可以覆盖上面的一切
    const ProviderOne = {
      setup() {
        provide('foo', 'foo')
        provide('bar', 'bar')
        return () => h(ProviderTwo)
      }
    }

    const ProviderTwo = {
      setup() {
        // override parent value
        provide('foo', 'fooOverride')
        provide('baz', 'baz')
        return () => h(Consumer)
      }
    }

    const Consumer = {
      setup() {
        const foo = inject('foo')
        const bar = inject('bar')
        const baz = inject('baz')
        return () => [foo, bar, baz].join(',')
      }
    }

    const root = nodeOps.createElement('div')
    render(h(ProviderOne), root)
    expect(serialize(root)).toBe(`<div>fooOverride,bar,baz</div>`)
  })

  it('reactivity with refs', async () => {
    // 可以传递父级参数 响应性的参数
    const count = ref(1)

    const Provider = {
      setup() {
        provide('count', count)
        return () => h(Middle)
      }
    }

    const Middle = {
      render: () => h(Consumer)
    }

    const Consumer = {
      setup() {
        const count = inject<Ref<number>>('count')!
        return () => count.value
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Provider), root)
    expect(serialize(root)).toBe(`<div>1</div>`)

    count.value++
    await nextTick()
    expect(serialize(root)).toBe(`<div>2</div>`)
  })

  it('reactivity with readonly refs', async () => {
    // 对于被冻结的元素，子组件不能改变
    const count = ref(1)

    const Provider = {
      setup() {
        provide('count', readonly(count))
        return () => h(Middle)
      }
    }

    const Middle = {
      render: () => h(Consumer)
    }

    const Consumer = {
      setup() {
        const count = inject<Ref<number>>('count')!
        // should not work
        count.value++
        return () => count.value
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Provider), root)
    expect(serialize(root)).toBe(`<div>1</div>`)

    expect(
      `Set operation on key "value" failed: target is readonly`
    ).toHaveBeenWarned()

    // source mutation should still work
    count.value++
    await nextTick()
    expect(serialize(root)).toBe(`<div>2</div>`)
  })

  it('reactivity with objects', async () => {
    // 响应对象也可以传递
    const rootState = reactive({ count: 1 })

    const Provider = {
      setup() {
        provide('state', rootState)
        return () => h(Middle)
      }
    }

    const Middle = {
      render: () => h(Consumer)
    }

    const Consumer = {
      setup() {
        const state = inject<typeof rootState>('state')!
        return () => state.count
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Provider), root)
    expect(serialize(root)).toBe(`<div>1</div>`)

    rootState.count++
    await nextTick()
    expect(serialize(root)).toBe(`<div>2</div>`)
  })

  it('reactivity with readonly objects', async () => {
    // 只读对象不能改变里面的值
    const rootState = reactive({ count: 1 })

    const Provider = {
      setup() {
        provide('state', readonly(rootState))
        return () => h(Middle)
      }
    }

    const Middle = {
      render: () => h(Consumer)
    }

    const Consumer = {
      setup() {
        const state = inject<typeof rootState>('state')!
        // should not work
        state.count++
        return () => state.count
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Provider), root)
    expect(serialize(root)).toBe(`<div>1</div>`)

    expect(
      `Set operation on key "count" failed: target is readonly`
    ).toHaveBeenWarned()

    rootState.count++
    await nextTick()
    expect(serialize(root)).toBe(`<div>2</div>`)
  })

  it('should warn unfound', () => {
    //父级没传递provider 孙子节点使用时 也没有默认值  将会报警告
    const Provider = {
      setup() {
        return () => h(Middle)
      }
    }

    const Middle = {
      render: () => h(Consumer)
    }

    const Consumer = {
      setup() {
        const foo = inject('foo')
        expect(foo).toBeUndefined()
        return () => foo
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Provider), root)
    expect(serialize(root)).toBe(`<div><!----></div>`)
    expect(`injection "foo" not found.`).toHaveBeenWarned()
  })

  it('should not warn when default value is undefined', () => {
    //如果默认值是undefined 依旧包warn
    const Provider = {
      setup() {
        return () => h(Middle)
      }
    }

    const Middle = {
      render: () => h(Consumer)
    }

    const Consumer = {
      setup() {
        const foo = inject('foo', undefined)
        return () => foo
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Provider), root)
    expect(`injection "foo" not found.`).not.toHaveBeenWarned()
  })

  // #2400
  it('should not self-inject', () => {
    //为null 不会报错
    const Comp = {
      setup() {
        provide('foo', 'foo')
        const injection = inject('foo', null)
        return () => injection
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serialize(root)).toBe(`<div><!----></div>`)
  })
})
