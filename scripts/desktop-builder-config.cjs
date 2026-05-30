const DEFAULT_DESKTOP_VERSION = '0.1.0'
const DESKTOP_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/

const resolveDesktopVersion = (desktopVersion = process.env.AKSEL_ARCADE_DESKTOP_VERSION) => {
  const version = typeof desktopVersion === 'string' ? desktopVersion.trim() : ''

  if (!version) {
    return DEFAULT_DESKTOP_VERSION
  }

  if (!DESKTOP_VERSION_PATTERN.test(version)) {
    throw new Error(
      `AKSEL_ARCADE_DESKTOP_VERSION must be a SemVer version, received "${desktopVersion}".`
    )
  }

  return version
}

const createDesktopBuilderConfig = (options = {}) => ({
  appId: 'no.nav.aksel.arcade',
  productName: 'Aksel Arcade',
  asar: true,
  forceCodeSigning: false,
  npmRebuild: false,
  publish: null,
  directories: {
    output: 'release/desktop',
    buildResources: 'build/desktop',
  },
  files: ['dist-desktop/**/*', 'desktop/**/*', 'package.json'],
  extraMetadata: {
    main: 'desktop/main.cjs',
    productName: 'Aksel Arcade',
    version: resolveDesktopVersion(options.desktopVersion),
  },
  mac: {
    category: 'public.app-category.developer-tools',
    icon: 'build/desktop/icon.icns',
    identity: null,
    target: [
      {
        target: 'dmg',
        arch: ['arm64', 'x64'],
      },
    ],
    artifactName: 'Aksel-Arcade-${version}-mac-${arch}.${ext}',
  },
  win: {
    icon: 'build/desktop/icon.ico',
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    artifactName: 'Aksel-Arcade-${version}-windows-${arch}.${ext}',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
  },
})

module.exports = {
  DEFAULT_DESKTOP_VERSION,
  createDesktopBuilderConfig,
  resolveDesktopVersion,
}
