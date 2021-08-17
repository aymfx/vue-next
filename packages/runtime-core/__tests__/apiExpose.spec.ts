import { nodeOps, render } from '@vue/runtime-test'
import { defineComponent, h, ref } from '../src'

describe('api: expose', () => {
  test('via setup context', () => {
    //表示对外暴露属性值，添加了之后 将不会暴露data的属性
    const Child = defineComponent({
      render() {},
      setup(_, { expose }) {
        expose({
          foo: 1,
          bar: ref(2)
        })
        return {
          bar: ref(3),
          baz: ref(4)
        }
      }
    })

    const childRef = ref()
    const Parent = {
      setup() {
        return () => h(Child, { ref: childRef })
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect(childRef.value).toBeTruthy()
    expect(childRef.value.foo).toBe(1)
    expect(childRef.value.bar).toBe(2)
    expect(childRef.value.baz).toBeUndefined()
  })

  test('via options', () => {
    //也可以直接暴露可选项的几个属性值
    const Child = defineComponent({
      render() {},
      data() {
        return {
          foo: 1
        }
      },
      setup() {
        return {
          bar: ref(2),
          baz: ref(3)
        }
      },
      expose: ['foo', 'bar']
    })

    const childRef = ref()
    const Parent = {
      setup() {
        return () => h(Child, { ref: childRef })
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect(childRef.value).toBeTruthy()
    expect(childRef.value.foo).toBe(1)
    expect(childRef.value.bar).toBe(2)
    expect(childRef.value.baz).toBeUndefined()
  })

  test('options + context', () => {
    //两者一起用 将会把他们并在一块
    const Child = defineComponent({
      render() {},
      expose: ['foo'],
      data() {
        return {
          foo: 1
        }
      },
      setup(_, { expose }) {
        expose({
          bar: ref(2)
        })
        return {
          bar: ref(3),
          baz: ref(4)
        }
      }
    })

    const childRef = ref()
    const Parent = {
      setup() {
        return () => h(Child, { ref: childRef })
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect(childRef.value).toBeTruthy()
    expect(childRef.value.foo).toBe(1)
    expect(childRef.value.bar).toBe(2)
    expect(childRef.value.baz).toBeUndefined()
  })

  test('options: empty', () => {
    // expose: [] 不能访问任何子元素的属性
    const Child = defineComponent({
      render() {},
      expose: [],
      data() {
        return {
          foo: 1
        }
      }
    })

    const childRef = ref()
    const Parent = {
      setup() {
        return () => h(Child, { ref: childRef })
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect(childRef.value).toBeTruthy()
    expect('foo' in childRef.value).toBe(false)
  })

  test('options: empty + setup context', () => {
    // 合并操作
    const Child = defineComponent({
      render() {},
      expose: [],
      setup(_, { expose }) {
        expose({
          foo: 1
        })
      }
    })

    const childRef = ref()
    const Parent = {
      setup() {
        return () => h(Child, { ref: childRef })
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect(childRef.value).toBeTruthy()
    expect(childRef.value.foo).toBe(1)
  })

  test('with $parent/$root', () => {
    //父级和自己都不能放
    const Child = defineComponent({
      render() {
        expect((this.$parent! as any).foo).toBe(1)
        expect((this.$parent! as any).bar).toBe(undefined)
        expect((this.$root! as any).foo).toBe(1)
        expect((this.$root! as any).bar).toBe(undefined)
      }
    })

    const Parent = defineComponent({
      expose: [],
      setup(_, { expose }) {
        expose({
          foo: 1
        })
        return {
          bar: 2
        }
      },
      render() {
        return h(Child)
      }
    })
    const root = nodeOps.createElement('div')
    render(h(Parent), root)
  })

  test('expose should allow access to built-in instance properties', () => {
    //判断暴露的实例是不是相等
    const GrandChild = defineComponent({
      render() {
        return h('div')
      }
    })

    const grandChildRef = ref()
    const Child = defineComponent({
      render() {
        return h('div')
      },
      setup(_, { expose }) {
        expose()
        return () => h(GrandChild, { ref: grandChildRef })
      }
    })

    const childRef = ref()
    const Parent = {
      setup() {
        return () => h(Child, { ref: childRef })
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect(childRef.value.$el.tag).toBe('div')
    expect(grandChildRef.value.$parent).toBe(childRef.value)
    expect(grandChildRef.value.$parent.$parent).toBe(grandChildRef.value.$root)
  })
})
