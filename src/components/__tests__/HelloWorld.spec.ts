import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HelloWorld from '../HelloWorld.vue'

describe('HelloWorld', () => {
  it('renders the msg prop', () => {
    const wrapper = mount(HelloWorld, { props: { msg: 'Hello Vitest' } })
    expect(wrapper.text()).toContain('Hello Vitest')
  })

  it('increments count on click', async () => {
    const wrapper = mount(HelloWorld, { props: { msg: 'x' } })
    const button = wrapper.get('button')
    expect(button.text()).toContain('count is 0')
    await button.trigger('click')
    expect(button.text()).toContain('count is 1')
  })
})
