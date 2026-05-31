#!/usr/bin/env node
'use strict'

const { spawnSync } = require('node:child_process')
const { randomUUID } = require('node:crypto')
const { appendFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { basename, join } = require('node:path')

const {
  DESKTOP_SIGNING_MODE_RELEASE,
  resolveDesktopVersion,
} = require('./desktop-builder-config.cjs')

const DESKTOP_RELEASE_OUTPUT_DIR = 'release/desktop'
const MACOS_RELEASE_ARCHES = Object.freeze(['arm64', 'x64'])
const REQUIRED_MACOS_RELEASE_CREDENTIAL_NAMES = Object.freeze([
  'MAC_CERTIFICATE_P12_BASE64',
  'MAC_CERTIFICATE_PASSWORD',
  'APPLE_API_KEY_BASE64',
  'APPLE_API_KEY_ID',
  'APPLE_API_ISSUER_ID',
  'APPLE_TEAM_ID',
])
const BASE64_MACOS_RELEASE_CREDENTIAL_NAMES = Object.freeze([
  'MAC_CERTIFICATE_P12_BASE64',
  'APPLE_API_KEY_BASE64',
])
const SETUP_ERROR_PREFIX = 'Desktop macOS release signing setup error:'
const SIGNING_STATE_ENV = 'AKSEL_ARCADE_MACOS_SIGNING_STATE'

function createSafeSetupError(messageOrError) {
  const message = messageOrError instanceof Error ? messageOrError.message : messageOrError

  return new Error(`${SETUP_ERROR_PREFIX} ${message}`)
}

function isSafeSetupError(error) {
  return error instanceof Error && error.message.startsWith(SETUP_ERROR_PREFIX)
}

function readRequiredCredential(env, name, options = {}) {
  const { trim = true } = options
  const value = env[name]

  if (typeof value !== 'string' || value.trim() === '') {
    throw createSafeSetupError(`Missing required credential ${name}.`)
  }

  return trim ? value.trim() : value
}

function decodeBase64Credential(env, name) {
  const value = readRequiredCredential(env, name).replace(/\s+/g, '')

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 === 1) {
    throw createSafeSetupError(`${name} must be valid base64.`)
  }

  const decoded = Buffer.from(value, 'base64')

  if (decoded.length === 0) {
    throw createSafeSetupError(`${name} must decode to a non-empty value.`)
  }

  return decoded
}

function readNonSecretIdentifier(env, name) {
  const value = readRequiredCredential(env, name)

  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    throw createSafeSetupError(
      `${name} contains unsupported characters for a Desktop release credential.`
    )
  }

  return value
}

function validateMacosReleaseCredentials(env = process.env) {
  return {
    certificateP12: decodeBase64Credential(env, 'MAC_CERTIFICATE_P12_BASE64'),
    certificatePassword: readRequiredCredential(env, 'MAC_CERTIFICATE_PASSWORD', {
      trim: false,
    }),
    appleApiKey: decodeBase64Credential(env, 'APPLE_API_KEY_BASE64'),
    appleApiKeyId: readNonSecretIdentifier(env, 'APPLE_API_KEY_ID'),
    appleApiIssuerId: readNonSecretIdentifier(env, 'APPLE_API_ISSUER_ID'),
    appleTeamId: readNonSecretIdentifier(env, 'APPLE_TEAM_ID'),
  }
}

function runRequiredCommand(command, args, options = {}) {
  const {
    env = process.env,
    includeOutput = true,
    cwd = process.cwd(),
    label = command,
    runCommand = spawnSync,
  } = options
  const result = runCommand(command, args, {
    cwd,
    encoding: 'utf8',
    env,
    stdio: 'pipe',
  })

  if (result.error) {
    throw new Error(`${label} failed to start: ${result.error.message}`)
  }

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr]
      .filter((value) => typeof value === 'string' && value.trim() !== '')
      .map((value) => value.trim())
      .join('\n')
    const outputSuffix = includeOutput && output ? `\n\n${output}` : ''

    throw new Error(`${label} failed with exit code ${result.status ?? 1}.${outputSuffix}`)
  }

  return result
}

function runSetupCommand(command, args, options = {}) {
  try {
    return runRequiredCommand(command, args, { includeOutput: false, ...options })
  } catch (error) {
    throw createSafeSetupError(error)
  }
}

function parseSecurityKeychainList(output = '') {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^"|"$/g, ''))
    .filter(Boolean)
}

function readUserKeychainSearchList(options = {}) {
  const result = runSetupCommand('security', ['list-keychains', '-d', 'user'], {
    label: 'Read user keychain search list',
    ...options,
  })

  return parseSecurityKeychainList(result.stdout)
}

function setUserKeychainSearchList(keychains, options = {}) {
  runSetupCommand('security', ['list-keychains', '-d', 'user', '-s', ...keychains], {
    label: 'Update user keychain search list',
    ...options,
  })
}

function appendGitHubEnvValues(values, githubEnvPath = process.env.GITHUB_ENV) {
  if (!githubEnvPath) {
    return
  }

  const lines = Object.entries(values).map(([name, value]) => `${name}=${value}`)
  appendFileSync(githubEnvPath, `${lines.join('\n')}\n`, 'utf8')
}

function createMacosReleaseSigningState(credentials, tempDir) {
  const keychainPath = join(tempDir, 'aksel-arcade-release-signing.keychain-db')
  const certificatePath = join(tempDir, 'developer-id-application.p12')
  const appleApiKeyPath = join(tempDir, 'app-store-connect-api-key.p8')
  const statePath = join(tempDir, 'state.json')

  return {
    appleApiKeyPath,
    certificatePath,
    keychainPassword: randomUUID(),
    keychainPath,
    previousUserKeychains: [],
    statePath,
    tempDir,
    exportedEnv: {
      AKSEL_ARCADE_DESKTOP_SIGNING_MODE: DESKTOP_SIGNING_MODE_RELEASE,
      APPLE_API_ISSUER: credentials.appleApiIssuerId,
      APPLE_API_KEY: appleApiKeyPath,
      APPLE_API_KEY_ID: credentials.appleApiKeyId,
      APPLE_TEAM_ID: credentials.appleTeamId,
      CSC_IDENTITY_AUTO_DISCOVERY: 'true',
      CSC_KEYCHAIN: keychainPath,
      [SIGNING_STATE_ENV]: statePath,
    },
  }
}

function prepareMacosReleaseSigning(options = {}) {
  const {
    env = process.env,
    makeTempDir = (prefix) => mkdtempSync(prefix),
    runCommand = spawnSync,
    writeFile = writeFileSync,
    appendEnv = appendGitHubEnvValues,
  } = options
  const credentials = validateMacosReleaseCredentials(env)
  const tempDir = makeTempDir(join(tmpdir(), 'aksel-arcade-macos-signing-'))
  const state = createMacosReleaseSigningState(credentials, tempDir)
  let keychainCreated = false

  try {
    state.previousUserKeychains = readUserKeychainSearchList({ runCommand })
    writeFile(state.certificatePath, credentials.certificateP12, { mode: 0o600 })
    writeFile(state.appleApiKeyPath, credentials.appleApiKey, { mode: 0o600 })
    writeFile(
      state.statePath,
      JSON.stringify(
        {
          keychainPath: state.keychainPath,
          previousUserKeychains: state.previousUserKeychains,
          tempDir: state.tempDir,
        },
        null,
        2
      ),
      { mode: 0o600 }
    )

    runSetupCommand(
      'security',
      ['create-keychain', '-p', state.keychainPassword, state.keychainPath],
      {
        label: 'Create temporary Desktop release keychain',
        runCommand,
      }
    )
    keychainCreated = true
    runSetupCommand('security', ['set-keychain-settings', '-lut', '21600', state.keychainPath], {
      label: 'Configure temporary Desktop release keychain',
      runCommand,
    })
    runSetupCommand(
      'security',
      ['unlock-keychain', '-p', state.keychainPassword, state.keychainPath],
      {
        label: 'Unlock temporary Desktop release keychain',
        runCommand,
      }
    )
    setUserKeychainSearchList(
      [
        state.keychainPath,
        ...state.previousUserKeychains.filter((keychain) => keychain !== state.keychainPath),
      ],
      { runCommand }
    )
    runSetupCommand(
      'security',
      [
        'import',
        state.certificatePath,
        '-k',
        state.keychainPath,
        '-P',
        credentials.certificatePassword,
        '-T',
        '/usr/bin/codesign',
        '-T',
        '/usr/bin/security',
      ],
      {
        label: 'Import Developer ID Application certificate',
        runCommand,
      }
    )
    runSetupCommand(
      'security',
      [
        'set-key-partition-list',
        '-S',
        'apple-tool:,apple:,codesign:',
        '-s',
        '-k',
        state.keychainPassword,
        state.keychainPath,
      ],
      {
        label: 'Authorize Developer ID Application certificate for codesign',
        runCommand,
      }
    )

    Object.assign(env, state.exportedEnv)
    appendEnv(state.exportedEnv)
  } catch (error) {
    if (keychainCreated) {
      try {
        setUserKeychainSearchList(state.previousUserKeychains, { runCommand })
      } catch (cleanupError) {
        console.error(cleanupError.message)
      }

      try {
        runRequiredCommand('security', ['delete-keychain', state.keychainPath], {
          label: 'Delete temporary Desktop release keychain after setup failure',
          runCommand,
        })
      } catch (cleanupError) {
        console.error(cleanupError.message)
      }
    }

    rmSync(state.tempDir, { force: true, recursive: true })

    throw isSafeSetupError(error) ? error : createSafeSetupError(error)
  }

  return state
}

function readSigningState(env = process.env, readFile = require('node:fs').readFileSync) {
  const statePath = readRequiredCredential(env, SIGNING_STATE_ENV)
  const state = JSON.parse(readFile(statePath, 'utf8'))

  return {
    keychainPath: state.keychainPath,
    previousUserKeychains: Array.isArray(state.previousUserKeychains)
      ? state.previousUserKeychains
      : [],
    tempDir: state.tempDir,
  }
}

function cleanupMacosReleaseSigning(options = {}) {
  const {
    env = process.env,
    remove = rmSync,
    runCommand = spawnSync,
    state = readSigningState(env),
  } = options

  if (state.keychainPath) {
    if (Array.isArray(state.previousUserKeychains)) {
      setUserKeychainSearchList(state.previousUserKeychains, { runCommand })
    }

    runRequiredCommand('security', ['delete-keychain', state.keychainPath], {
      label: 'Delete temporary Desktop release keychain',
      runCommand,
    })
  }

  if (state.tempDir) {
    remove(state.tempDir, { force: true, recursive: true })
  }
}

function getExpectedMacosDmgArtifacts(options = {}) {
  const {
    desktopVersion = process.env.AKSEL_ARCADE_DESKTOP_VERSION,
    outputDir = DESKTOP_RELEASE_OUTPUT_DIR,
  } = options
  const version = resolveDesktopVersion(desktopVersion)

  return MACOS_RELEASE_ARCHES.map((arch) =>
    join(outputDir, `Aksel-Arcade-${version}-mac-${arch}.dmg`)
  )
}

function getPreparedNotarizationCredentials(env = process.env) {
  return {
    appleApiIssuer: readRequiredCredential(env, 'APPLE_API_ISSUER'),
    appleApiKey: readRequiredCredential(env, 'APPLE_API_KEY'),
    appleApiKeyId: readRequiredCredential(env, 'APPLE_API_KEY_ID'),
  }
}

function notarizeAndStapleMacosDesktopArtifacts(options = {}) {
  const {
    artifacts = getExpectedMacosDmgArtifacts(options),
    env = process.env,
    runCommand = spawnSync,
  } = options
  const { appleApiIssuer, appleApiKey, appleApiKeyId } = getPreparedNotarizationCredentials(env)

  for (const artifact of artifacts) {
    runRequiredCommand(
      'xcrun',
      [
        'notarytool',
        'submit',
        artifact,
        '--key',
        appleApiKey,
        '--key-id',
        appleApiKeyId,
        '--issuer',
        appleApiIssuer,
        '--wait',
      ],
      {
        env,
        label: `Notarize ${basename(artifact)} with App Store Connect API key`,
        runCommand,
      }
    )
    runRequiredCommand('xcrun', ['stapler', 'staple', artifact], {
      env,
      label: `Staple notarization ticket to ${basename(artifact)}`,
      runCommand,
    })
  }
}

function validateMacosDesktopArtifacts(options = {}) {
  const {
    artifacts = getExpectedMacosDmgArtifacts(options),
    exists = existsSync,
    env = process.env,
    runCommand = spawnSync,
  } = options

  for (const artifact of artifacts) {
    if (!exists(artifact)) {
      throw new Error(`Expected macOS Desktop release artifact is missing: ${artifact}`)
    }

    runRequiredCommand('codesign', ['--verify', '--verbose=2', artifact], {
      env,
      label: `Verify Developer ID signature for ${basename(artifact)}`,
      runCommand,
    })
    runRequiredCommand(
      'spctl',
      [
        '--assess',
        '--type',
        'open',
        '--context',
        'context:primary-signature',
        '--verbose',
        artifact,
      ],
      {
        env,
        label: `Run Gatekeeper assessment for ${basename(artifact)}`,
        runCommand,
      }
    )
    runRequiredCommand('xcrun', ['stapler', 'validate', artifact], {
      env,
      label: `Validate notarization staple for ${basename(artifact)}`,
      runCommand,
    })
  }
}

function packageMacosRelease(options = {}) {
  const {
    env = process.env,
    runCommand = spawnSync,
    stateFactory = prepareMacosReleaseSigning,
    cleanup = cleanupMacosReleaseSigning,
  } = options
  let state = null
  let packageError = null

  try {
    state = stateFactory({ env, runCommand })
    runRequiredCommand('npm', ['run', 'desktop:build'], {
      env,
      label: 'Build Desktop renderer for macOS release',
      runCommand,
    })
    runRequiredCommand(
      'electron-builder',
      ['--config', 'electron-builder.config.cjs', '--mac', '--publish', 'never'],
      {
        env,
        label: 'Build signed macOS Desktop DMGs',
        runCommand,
      }
    )
    notarizeAndStapleMacosDesktopArtifacts({ env, runCommand })
    validateMacosDesktopArtifacts({ env, runCommand })
  } catch (error) {
    packageError = error
  } finally {
    if (state) {
      try {
        cleanup({ env, runCommand, state })
      } catch (cleanupError) {
        if (!packageError) {
          packageError = cleanupError
        } else {
          console.error(cleanupError.message)
        }
      }
    }
  }

  if (packageError) {
    throw packageError
  }
}

function printUsageAndExit() {
  console.error(
    [
      'Usage: node scripts/desktop-macos-release-signing.cjs <command>',
      '',
      'Commands:',
      '  validate-credentials  Validate required macOS Desktop release credentials.',
      '  prepare               Import Developer ID cert and export signing env.',
      '  cleanup               Delete the temporary signing keychain and files.',
      '  notarize-and-validate Notarize, staple, and validate expected macOS DMGs.',
      '  validate              Validate expected signed and stapled macOS DMGs.',
      '  package               Build, sign, notarize, staple, validate, and cleanup.',
    ].join('\n')
  )
  process.exit(1)
}

if (require.main === module) {
  const command = process.argv[2]

  try {
    if (command === 'validate-credentials') {
      validateMacosReleaseCredentials()
    } else if (command === 'prepare') {
      prepareMacosReleaseSigning()
    } else if (command === 'cleanup') {
      cleanupMacosReleaseSigning()
    } else if (command === 'notarize-and-validate') {
      notarizeAndStapleMacosDesktopArtifacts()
      validateMacosDesktopArtifacts()
    } else if (command === 'validate') {
      validateMacosDesktopArtifacts()
    } else if (command === 'package') {
      packageMacosRelease()
    } else {
      printUsageAndExit()
    }
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}

module.exports = {
  BASE64_MACOS_RELEASE_CREDENTIAL_NAMES,
  DESKTOP_RELEASE_OUTPUT_DIR,
  MACOS_RELEASE_ARCHES,
  REQUIRED_MACOS_RELEASE_CREDENTIAL_NAMES,
  SETUP_ERROR_PREFIX,
  SIGNING_STATE_ENV,
  cleanupMacosReleaseSigning,
  createMacosReleaseSigningState,
  createSafeSetupError,
  getExpectedMacosDmgArtifacts,
  notarizeAndStapleMacosDesktopArtifacts,
  parseSecurityKeychainList,
  packageMacosRelease,
  prepareMacosReleaseSigning,
  readUserKeychainSearchList,
  setUserKeychainSearchList,
  validateMacosDesktopArtifacts,
  validateMacosReleaseCredentials,
}
