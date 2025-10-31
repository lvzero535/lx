import { type InlineConfig, type UserConfig } from 'vite'
import { type Options as VueOptions } from '@vitejs/plugin-vue'

export interface BuildConfig {
  /**
   * 默认输出格式
   * @default ['es', 'cjs', 'umd']
   */
  formats: ('es' | 'cjs' | 'umd')[]
  
  /**
   * 默认输出根目录
   * @default 'dist'
   */
  outRoot: string
  
  /**
   * 入口文件查找顺序
   * @default ['index.ts', 'src/index.ts', 'src/index.tsx']
   */
  entryFiles: string[]
  
  /**
   * UMD 格式的全局变量映射
   * key 为包名，value 为全局变量名
   */
  globals: Record<string, string>
  
  /**
   * 是否外部化某些依赖
   * @param depName 依赖包名
   * @returns true 表示外部化（不打包），false 表示打包进产物
   */
  external?: (depName: string) => boolean
  
  /**
   * Vite 配置选项
   * 会与默认选项合并
   */
  vite?: UserConfig
  
  /**
   * Vue 插件选项
   */
  vue?: VueOptions
}

const config: BuildConfig = {
  formats: ['es', 'cjs', 'umd'],
  outRoot: 'dist',
  entryFiles: [
    'index.ts',
    'src/index.ts',
    'src/index.tsx',
  ],
  globals: {
    'vue': 'Vue',
    '@vueuse/core': 'VueUse',
  },
  // 默认外部化 vue 和非 @lx 作用域的依赖
  external: (depName: string) => {
    if (depName === 'vue') return true
    return !depName.startsWith('@lx/')
  },
  vite: {
    build: {
      minify: 'esbuild',
      sourcemap: true,
      reportCompressedSize: false,
    }
  },
  vue: {
    isProduction: true
  }
}

export default config