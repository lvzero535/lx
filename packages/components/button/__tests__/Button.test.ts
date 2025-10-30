import { mount } from '@vue/test-utils'
import Button from '../src/Button.vue'

describe('Button Component', () => {
  test('should render correctly', () => {
    const wrapper = mount(Button, {
      slots: {
        default: 'Button Text'
      }
    })
    expect(wrapper.text()).toBe('Button Text')
    expect(wrapper.classes()).toContain('lx-button')
  })

  test('should handle disabled state', () => {
    const wrapper = mount(Button, {
      props: {
        disabled: true
      }
    })
    expect(wrapper.attributes('disabled')).toBe('')
  })
})