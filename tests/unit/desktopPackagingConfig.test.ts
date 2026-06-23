import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

type DesktopBuilderTarget = {
  target: string
  arch: string[]
}

type DesktopBuilderConfig = {
  appId: string
  productName: string
  forceCodeSigning: boolean
  publish: null
  directories: {
    output: string
    buildResources: string
  }
  files: string[]
  extraMetadata: {
    main: string
    productName: string
    version: string
  }
  mac: {
    icon: string
    identity?: null
    hardenedRuntime?: boolean
    gatekeeperAssess?: boolean
    entitlements?: string
    entitlementsInherit?: string
    notarize?: false
    target: DesktopBuilderTarget[]
    artifactName: string
  }
  dmg?: {
    sign: boolean
  }
  win: {
    icon: string
    target: DesktopBuilderTarget[]
    artifactName: string
  }
}

const require = createRequire(import.meta.url)
const {
  DEFAULT_DESKTOP_VERSION,
  MACOS_RELEASE_ENTITLEMENTS,
  createDesktopBuilderConfig,
  resolveDesktopSigningMode,
  resolveDesktopVersion,
} = require('../../scripts/desktop-builder-config.cjs') as {
  DEFAULT_DESKTOP_VERSION: string
  MACOS_RELEASE_ENTITLEMENTS: string
  createDesktopBuilderConfig: (options?: {
    desktopVersion?: string
    signingMode?: string
  }) => DesktopBuilderConfig
  resolveDesktopSigningMode: (signingMode?: string) => string
  resolveDesktopVersion: (desktopVersion?: string) => string
}

const readText = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8')

const readPackageJson = () =>
  JSON.parse(readText('package.json')) as {
    main: string
    scripts: Record<string, string>
  }

describe('Desktop Arcade packaging contract', () => {
  it('defines Desktop app metadata, local unsigned defaults, and package contents', () => {
    const config = createDesktopBuilderConfig()

    expect(config.appId).toBe('no.nav.aksel.arcade')
    expect(config.productName).toBe('Aksel Arcade')
    expect(config.extraMetadata).toMatchObject({
      main: 'desktop/main.cjs',
      productName: 'Aksel Arcade',
      version: DEFAULT_DESKTOP_VERSION,
    })
    expect(config.forceCodeSigning).toBe(false)
    expect(config.publish).toBeNull()
    expect(config.mac.identity).toBeNull()
    expect(config.mac.hardenedRuntime).toBeUndefined()
    expect(config.dmg).toBeUndefined()
    expect(config.directories).toEqual({
      output: 'release/desktop',
      buildResources: 'build/desktop',
    })
    expect(config.files).toEqual(['dist-desktop/**/*', 'desktop/**/*', 'package.json'])
  })

  it('keeps the documented macOS artifact names and explicit-only Windows packaging metadata', () => {
    const config = createDesktopBuilderConfig()

    expect(config.mac.target).toEqual([{ target: 'dmg', arch: ['arm64', 'x64'] }])
    expect(config.win.target).toEqual([{ target: 'nsis', arch: ['x64'] }])
    expect(config.mac.artifactName).toBe('Aksel-Arcade-${version}-mac-${arch}.${ext}')
    expect(config.win.artifactName).toBe('Aksel-Arcade-${version}-windows-${arch}.${ext}')
  })

  it('enables hardened runtime and minimal entitlements for signed macOS release packaging', () => {
    const config = createDesktopBuilderConfig({ signingMode: 'release' })
    const entitlements = readText(MACOS_RELEASE_ENTITLEMENTS)

    expect(config.forceCodeSigning).toBe(true)
    expect(config.mac.identity).toBeUndefined()
    expect(config.mac.hardenedRuntime).toBe(true)
    expect(config.mac.gatekeeperAssess).toBe(false)
    expect(config.mac.entitlements).toBe(MACOS_RELEASE_ENTITLEMENTS)
    expect(config.mac.entitlementsInherit).toBe(MACOS_RELEASE_ENTITLEMENTS)
    expect(config.mac.notarize).toBe(false)
    expect(config.dmg).toEqual({ sign: true })
    expect(entitlements).toContain('com.apple.security.cs.allow-jit')
    expect(entitlements).toContain('com.apple.security.cs.allow-unsigned-executable-memory')
    expect(entitlements).not.toContain('com.apple.security.cs.disable-library-validation')
  })

  it('keeps Desktop Arcade version injection in workspace state', () => {
    expect(resolveDesktopVersion()).toBe('0.1.0')
    expect(resolveDesktopVersion('2.3.4')).toBe('2.3.4')
    expect(() => resolveDesktopVersion('desktop-v2.3.4')).toThrow(/AKSEL_ARCADE_DESKTOP_VERSION/)
    expect(resolveDesktopSigningMode()).toBe('unsigned')
    expect(resolveDesktopSigningMode('release')).toBe('release')
    expect(() => resolveDesktopSigningMode('signed')).toThrow(/AKSEL_ARCADE_DESKTOP_SIGNING_MODE/)
  })

  it('documents npm commands for Desktop build and local unsigned packaging', () => {
    const packageJson = readPackageJson()

    expect(packageJson.main).toBe('desktop/main.cjs')
    expect(packageJson.scripts['desktop:build']).toContain(
      'vite build --config vite.desktop.config.ts'
    )
    expect(packageJson.scripts['desktop:package']).toBe('npm run desktop:package:mac')
    expect(packageJson.scripts['desktop:package:mac']).toContain('--mac')
    expect(packageJson.scripts['desktop:package:mac:release']).toBe(
      'node scripts/desktop-macos-release-signing.cjs package'
    )
    expect(packageJson.scripts['desktop:package:win']).toContain('--win')
  })

  it('builds the Desktop renderer separately from the Web Arcade GitHub Pages output', () => {
    const desktopViteConfig = readText('vite.desktop.config.ts')
    const webViteConfig = readText('vite.config.ts')
    const desktopMain = readText('desktop/main.cjs')
    const indexHtml = readText('index.html')

    expect(webViteConfig).toContain("base: '/aksel-arcade/'")
    expect(desktopViteConfig).toContain("base: './'")
    expect(desktopViteConfig).toContain("outDir: 'dist-desktop'")
    expect(desktopMain).toContain("'dist-desktop'")
    expect(desktopMain).toContain("DESKTOP_RENDERER_PROTOCOL = 'aksel-arcade'")
    expect(desktopMain).toContain('registerSchemesAsPrivileged')
    expect(desktopMain).toContain('protocol.handle(DESKTOP_RENDERER_PROTOCOL')
    expect(indexHtml).toContain('%BASE_URL%aksel-favicon.svg')
  })

  it('generates desktop icons from the existing Aksel Arcade visual mark', () => {
    const iconScript = readText('scripts/generate-desktop-icons.mjs')
    const config = createDesktopBuilderConfig()

    expect(iconScript).toContain("'public', 'aksel-favicon.svg'")
    expect(iconScript).toContain("'icon.ico'")
    expect(iconScript).toContain("'icon.icns'")
    expect(config.win.icon).toBe('build/desktop/icon.ico')
    expect(config.mac.icon).toBe('build/desktop/icon.icns')
  })
})
