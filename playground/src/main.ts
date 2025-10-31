import { createApp } from 'vue'
import { deepClone } from '@lx/utils'
import './style.css'
console.log(deepClone({ a: 1 }))
import App from './App.vue'
createApp(App).mount('#app')
