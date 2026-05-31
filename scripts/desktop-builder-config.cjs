const DEFAULT_DESKTOP_VERSION = '0.1.0'
const DESKTOP_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/
const DESKTOP_SIGNING_MODE_UNSIGNED = 'unsigned'
const DESKTOP_SIGNING_MODE_RELEASE = 'release'
const MACOS_RELEASE_ENTITLEMENTS = 'desktop/entitlements.mac.plist'

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

const resolveDesktopSigningMode = (signingMode = process.env.AKSEL_ARCADE_DESKTOP_SIGNING_MODE) => {
  const mode = typeof signingMode === 'string' ? signingMode.trim() : ''

  if (!mode) {
    return DESKTOP_SIGNING_MODE_UNSIGNED
  }

  if (mode !== DESKTOP_SIGNING_MODE_UNSIGNED && mode !== DESKTOP_SIGNING_MODE_RELEASE) {
    throw new Error(
      `AKSEL_ARCADE_DESKTOP_SIGNING_MODE must be "unsigned" or "release", received "${signingMode}".`
    )
  }

  return mode
}

const createMacConfig = (releaseSigning) => {
  const macConfig = {
    category: 'public.app-category.developer-tools',
    icon: 'build/desktop/icon.icns',
    target: [
      {
        target: 'dmg',
        arch: ['arm64', 'x64'],
      },
    ],
    artifactName: 'Aksel-Arcade-${version}-mac-${arch}.${ext}',
  }

  if (!releaseSigning) {
    return {
      ...macConfig,
      identity: null,
    }
  }

  return {
    ...macConfig,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: MACOS_RELEASE_ENTITLEMENTS,
    entitlementsInherit: MACOS_RELEASE_ENTITLEMENTS,
  }
}

const createDesktopBuilderConfig = (options = {}) => {
  const signingMode = resolveDesktopSigningMode(options.signingMode)
  const releaseSigning = signingMode === DESKTOP_SIGNING_MODE_RELEASE

  return {
    appId: 'no.nav.aksel.arcade',
    productName: 'Aksel Arcade',
    asar: true,
    forceCodeSigning: releaseSigning,
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
    mac: createMacConfig(releaseSigning),
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
    ...(releaseSigning
      ? {
          dmg: {
            sign: true,
          },
        }
      : {}),
    nsis: {
      oneClick: false,
      perMachine: false,
      allowToChangeInstallationDirectory: true,
    },
  }
}

module.exports = {
  DEFAULT_DESKTOP_VERSION,
  DESKTOP_SIGNING_MODE_RELEASE,
  DESKTOP_SIGNING_MODE_UNSIGNED,
  MACOS_RELEASE_ENTITLEMENTS,
  createDesktopBuilderConfig,
  resolveDesktopSigningMode,
  resolveDesktopVersion,
}
