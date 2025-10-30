import Button from './src/Button.vue'
import type { App } from 'vue'

// 导出单个组件
export { Button }

// 导出所有组件作为插件
export default {
  install: (app: App) => {
    app.component('LxButton', Button)
  }
}