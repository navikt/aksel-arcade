import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

type SpawnResult = {
  error?: Error
  status: number | null
}

type RunCommand = (
  command: string,
  args: string[],
  options: { env: Record<string, string | undefined> }
) => SpawnResult

type SigningState = {
  keychainPath: string
  tempDir: string
}

type MacosReleaseSigningModule = {
  REQUIRED_MACOS_RELEASE_CREDENTIAL_NAMES: readonly string[]
  SETUP_ERROR_PREFIX: string
  getExpectedMacosDmgArtifacts: (options?: {
    desktopVersion?: string
    outputDir?: string
  }) => string[]
  notarizeAndStapleMacosDesktopArtifacts: (options: {
    artifacts?: string[]
    env: Record<string, string | undefined>
    runCommand: RunCommand
  }) => void
  packageMacosRelease: (options: {
    cleanup: (options: { state: SigningState }) => void
    env: Record<string, string | undefined>
    runCommand: RunCommand
    stateFactory: () => SigningState
  }) => void
  validateMacosDesktopArtifacts: (options: {
    artifacts?: string[]
    desktopVersion?: string
    exists?: (path: string) => boolean
    outputDir?: string
    runCommand: RunCommand
  }) => void
  validateMacosReleaseCredentials: (env: Record<string, string | undefined>) => {
    appleApiKeyId: string
    appleApiIssuerId: string
    appleTeamId: string
    certificateP12: Buffer
    appleApiKey: Buffer
  }
}

const require = createRequire(import.meta.url)
const signing =
  require('../../scripts/desktop-macos-release-signing.cjs') as MacosReleaseSigningModule

const validCredentials = {
  MAC_CERTIFICATE_P12_BASE64: Buffer.from('developer-id-cert').toString('base64'),
  MAC_CERTIFICATE_PASSWORD: 'certificate-password',
  APPLE_API_KEY_BASE64: Buffer.from('app-store-connect-key').toString('base64'),
  APPLE_API_KEY_ID: 'KEYID12345',
  APPLE_API_ISSUER_ID: '00000000-1111-2222-3333-444444444444',
  APPLE_TEAM_ID: 'TEAMID1234',
}

const preparedNotarizationEnv = {
  APPLE_API_KEY: '/tmp/AuthKey_KEYID12345.p8',
  APPLE_API_KEY_ID: validCredentials.APPLE_API_KEY_ID,
  APPLE_API_ISSUER: validCredentials.APPLE_API_ISSUER_ID,
}

describe('Desktop macOS release signing', () => {
  it('validates required release credentials without exposing secret values in setup errors', () => {
    const secretValue = 'super-sensitive-certificate-password'
    const env = {
      ...validCredentials,
      MAC_CERTIFICATE_PASSWORD: secretValue,
      APPLE_API_KEY_BASE64: undefined,
    }

    expect(() => signing.validateMacosReleaseCredentials(env)).toThrow(
      /Desktop macOS release signing setup error: Missing required credential APPLE_API_KEY_BASE64/
    )

    try {
      signing.validateMacosReleaseCredentials(env)
    } catch (error) {
      expect((error as Error).message).toContain(signing.SETUP_ERROR_PREFIX)
      expect((error as Error).message).not.toContain(secretValue)
    }
  })

  it('rejects invalid base64 credentials with secret-safe setup errors', () => {
    const env = {
      ...validCredentials,
      MAC_CERTIFICATE_P12_BASE64: 'not valid base64!',
    }

    expect(() => signing.validateMacosReleaseCredentials(env)).toThrow(
      /MAC_CERTIFICATE_P12_BASE64 must be valid base64/
    )
  })

  it('returns decoded credential material and normalized App Store Connect identifiers', () => {
    const credentials = signing.validateMacosReleaseCredentials(validCredentials)

    expect(credentials.certificateP12.toString('utf8')).toBe('developer-id-cert')
    expect(credentials.appleApiKey.toString('utf8')).toBe('app-store-connect-key')
    expect(credentials.appleApiKeyId).toBe('KEYID12345')
    expect(credentials.appleApiIssuerId).toBe('00000000-1111-2222-3333-444444444444')
    expect(credentials.appleTeamId).toBe('TEAMID1234')
  })

  it('targets both Apple Silicon and Intel DMGs with the documented release names', () => {
    expect(
      signing.getExpectedMacosDmgArtifacts({
        desktopVersion: '1.2.3',
        outputDir: 'release/desktop',
      })
    ).toEqual([
      join('release/desktop', 'Aksel-Arcade-1.2.3-mac-arm64.dmg'),
      join('release/desktop', 'Aksel-Arcade-1.2.3-mac-x64.dmg'),
    ])
  })

  it('uses App Store Connect API-key notarization instead of Apple ID password auth', () => {
    const artifact = join('release/desktop', 'Aksel-Arcade-1.2.3-mac-arm64.dmg')
    const commands: Array<{ command: string; args: string[] }> = []

    signing.notarizeAndStapleMacosDesktopArtifacts({
      artifacts: [artifact],
      env: preparedNotarizationEnv,
      runCommand: (command, args) => {
        commands.push({ command, args })
        return { status: 0 }
      },
    })

    expect(commands[0]).toEqual({
      command: 'xcrun',
      args: [
        'notarytool',
        'submit',
        artifact,
        '--key',
        preparedNotarizationEnv.APPLE_API_KEY,
        '--key-id',
        preparedNotarizationEnv.APPLE_API_KEY_ID,
        '--issuer',
        preparedNotarizationEnv.APPLE_API_ISSUER,
        '--wait',
      ],
    })
    expect(commands[1]).toEqual({
      command: 'xcrun',
      args: ['stapler', 'staple', artifact],
    })
    expect(commands.flatMap(({ args }) => args)).not.toContain('--apple-id')
    expect(commands.flatMap(({ args }) => args)).not.toContain('--password')
  })

  it('fails when signed macOS DMG validation does not pass', () => {
    const artifact = join('release/desktop', 'Aksel-Arcade-1.2.3-mac-arm64.dmg')
    const commands: Array<{ command: string; args: string[] }> = []

    expect(() =>
      signing.validateMacosDesktopArtifacts({
        artifacts: [artifact],
        exists: () => true,
        runCommand: (command, args) => {
          commands.push({ command, args })
          return command === 'spctl' ? { status: 1 } : { status: 0 }
        },
      })
    ).toThrow(/Run Gatekeeper assessment for Aksel-Arcade-1.2.3-mac-arm64.dmg/)

    expect(commands).toEqual([
      {
        command: 'codesign',
        args: ['--verify', '--verbose=2', artifact],
      },
      {
        command: 'spctl',
        args: [
          '--assess',
          '--type',
          'open',
          '--context',
          'context:primary-signature',
          '--verbose',
          artifact,
        ],
      },
    ])
  })

  it('fails before validation when an expected macOS release artifact is missing', () => {
    expect(() =>
      signing.validateMacosDesktopArtifacts({
        desktopVersion: '1.2.3',
        outputDir: 'release/desktop',
        exists: () => false,
        runCommand: () => ({ status: 0 }),
      })
    ).toThrow(/Expected macOS Desktop release artifact is missing/)
  })

  it('cleans up the temporary keychain when signed macOS packaging fails', () => {
    const commands: Array<{ command: string; args: string[] }> = []
    const signingState = {
      keychainPath: '/tmp/aksel-arcade-release-signing.keychain-db',
      tempDir: '/tmp/aksel-arcade-macos-signing',
    }
    let cleanedState: SigningState | null = null

    expect(() =>
      signing.packageMacosRelease({
        cleanup: ({ state }) => {
          cleanedState = state
        },
        env: { ...preparedNotarizationEnv },
        runCommand: (command, args) => {
          commands.push({ command, args })

          return command === 'electron-builder' ? { status: 1 } : { status: 0 }
        },
        stateFactory: () => signingState,
      })
    ).toThrow(/Build signed macOS Desktop DMGs failed/)

    expect(commands).toEqual([
      {
        command: 'npm',
        args: ['run', 'desktop:build'],
      },
      {
        command: 'electron-builder',
        args: ['--config', 'electron-builder.config.cjs', '--mac', '--publish', 'never'],
      },
    ])
    expect(cleanedState).toBe(signingState)
  })
})
