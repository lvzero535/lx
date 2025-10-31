#!/usr/bin/env node
import * as fs from 'fs'
import * as path from 'path'
import { spawnSync } from 'child_process'
import { type BuildOptions } from 'vite'
import defaultConfig, { type BuildConfig } from '../build.config'

type Opts = {
  pkg?: string
  component?: string
  formats?: string[]
  outRoot?: string
  config?: string
}

function parseArgs(): Opts {
  const argv = process.argv.slice(2)
  const opts: Opts = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--pkg' || a === '-p') opts.pkg = argv[++i]
    else if (a === '--component' || a === '-c') opts.component = argv[++i]
    else if (a === '--formats' || a === '-f') opts.formats = argv[++i].split(',')
    else if (a === '--out' || a === '-o') opts.outRoot = argv[++i]
    else if (a === '--config') opts.config = argv[++i]
    else if (a === '--help' || a === '-h') {
      console.log('Usage: build-packages.ts [--pkg <name>] [--component <name>] [--formats es,cjs,umd] [--out <outRoot>] [--config <configPath>]')
      process.exit(0)
    }
  }
  return opts
}

function log(...s: any[]) { console.log('[build-packages-ts]', ...s) }

async function loadConfig(configPath?: string): Promise<BuildConfig> {
  if (!configPath) return defaultConfig
  
  const absPath = path.isAbsolute(configPath) 
    ? configPath 
    : path.resolve(process.cwd(), configPath)
  
  if (!fs.existsSync(absPath)) {
    throw new Error(`Config file not found: ${absPath}`)
  }

  try {
    const userConfig = await import(absPath)
    return { ...defaultConfig, ...userConfig.default }
  } catch (err) {
    console.error('Failed to load config:', err)
    return defaultConfig
  }
}

async function buildPackage(pkgDir: string, pkgJson: any, opts: Opts, config: BuildConfig) {
  const vite = await import('vite')
  const vue = await import('@vitejs/plugin-vue')
  const build = vite.build

  const pkgName = pkgJson.name || path.basename(pkgDir)
  const shortName = pkgName.includes('/') ? pkgName.split('/').pop()! : pkgName
  const formats = opts.formats || config.formats
  const outRoot = opts.outRoot || path.resolve(process.cwd(), config.outRoot)
  const outDir = path.join(outRoot, shortName.replace('@', '').replace('/', '-'))

  // try to find entry using configured candidates
  const tryEntryCandidates = [
    pkgJson.module,
    pkgJson.main,
    ...config.entryFiles
  ]
  
  let entry: string | undefined
  for (const cand of tryEntryCandidates) {
    if (!cand) continue
    const p = path.isAbsolute(cand) ? cand : path.join(pkgDir, cand)
    if (fs.existsSync(p)) { entry = p; break }
  }

  if (!entry) {
    // fallback: look for a single file that exports components
    const files = fs.readdirSync(pkgDir)
    const idx = files.find(f => /^index\.(ts|js|mjs|cjs|tsx)$/.test(f))
    if (idx) entry = path.join(pkgDir, idx)
  }

  if (!entry) {
    throw new Error(`Cannot find entry for package ${pkgName} in ${pkgDir}. Please set "main" or "module" in package.json or add one of: ${config.entryFiles.join(', ')}`)
  }

  log('Building', pkgName, 'entry=', entry, 'formats=', formats.join(','), 'outDir=', outDir)

  // collect externals
  const externals = new Set<string>()
  if (pkgJson.peerDependencies) Object.keys(pkgJson.peerDependencies).forEach(d => externals.add(d))
  if (pkgJson.dependencies) Object.keys(pkgJson.dependencies).forEach(d => {
    if (config.external?.(d)) externals.add(d)
  })

  // get config file if exists
  const configFilePath = fs.existsSync(path.join(pkgDir, 'vite.config.ts')) 
    ? path.join(pkgDir, 'vite.config.ts') 
    : undefined

  try {
    for (const format of formats) {
      // merge build options
      const buildOptions: BuildOptions = {
        ...config.vite?.build,
        lib: {
          entry,
          name: shortName,
          formats: [format as any],
          fileName: (f: string) => `${shortName}.${f}.js`
        },
        rollupOptions: {
          ...config.vite?.build?.rollupOptions,
          external: Array.from(externals),
          output: {
            globals: config.globals,
            ...config.vite?.build?.rollupOptions?.output,
          }
        },
        outDir
      }

      const plugins = [vue.default(config.vue)]

      const optsForVite = {
        configFile: configFilePath,
        root: pkgDir,
        plugins,
        build: buildOptions
      }

      log(`vite.build -> format=${format} (configFile=${configFilePath ? 'yes' : 'no'})`)
      await build(optsForVite)
    }
  } catch (err) {
    log('Build failed for', pkgName)
    throw err
  }
}

async function buildSingleComponent(componentsDir: string, componentName: string, opts: Opts, config: BuildConfig) {
  const compDir = path.join(componentsDir, componentName)
  if (!fs.existsSync(compDir)) throw new Error(`component ${componentName} not found in ${componentsDir}`)
  
  let entry = path.join(compDir, 'index.ts')
  if (!fs.existsSync(entry)) {
    // try src/<Name>.vue
    const files = fs.readdirSync(compDir)
    const vueFile = files.find(f => f.endsWith('.vue'))
    if (vueFile) entry = path.join(compDir, 'src', vueFile)
  }
  if (!fs.existsSync(entry)) {
    // try src/index.ts
    const alt = path.join(compDir, 'src', 'index.ts')
    if (fs.existsSync(alt)) entry = alt
  }
  if (!fs.existsSync(entry)) throw new Error(`Cannot find entry for component ${componentName} in ${compDir}`)

  // create a virtual package.json for the component build
  const tmpPkgJson = { name: `@lx/${componentName}`, version: '0.0.0' }
  const tmpPkgDir = compDir
  await buildPackage(tmpPkgDir, tmpPkgJson, opts, config)
}

async function main() {
  const opts = parseArgs()
  const config = await loadConfig(opts.config)
  
  const root = path.resolve(process.cwd())
  const packagesDir = path.join(root, 'packages')

  if (!fs.existsSync(packagesDir)) {
    console.error('packages directory not found:', packagesDir)
    process.exit(1)
  }

  if (opts.component) {
    // build single component from components package
    const componentsDir = path.join(packagesDir, 'components')
    if (!fs.existsSync(componentsDir)) throw new Error('components package not found')
    await buildSingleComponent(componentsDir, opts.component, opts, config)
    log('Single component build complete')
    return
  }

  const entries = fs.readdirSync(packagesDir, { withFileTypes: true })
  const pkgDirs = entries
    .filter(e => e.isDirectory())
    .map(d => path.join(packagesDir, d.name))
    .filter(dir => fs.existsSync(path.join(dir, 'package.json')))

  if (opts.pkg) {
    const target = pkgDirs.find(d => {
      const pj = JSON.parse(fs.readFileSync(path.join(d, 'package.json'), 'utf8'))
      return pj.name === opts.pkg || path.basename(d) === opts.pkg
    })
    if (!target) throw new Error(`package ${opts.pkg} not found`) 
    const pj = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'))
    await buildPackage(target, pj, opts, config)
    log('Package build complete for', opts.pkg)
    return
  }

  // build all packages
  for (const dir of pkgDirs) {
    const pj = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
    await buildPackage(dir, pj, opts, config)
  }

  log('All packages built')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})