import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getSandboxMessageTargetOrigin } from '@/utils/sandboxMessaging'

type SandboxMessageLocation = Pick<Location, 'origin' | 'protocol'>

interface PublicSandboxMessaging {
  getMessageTargetOrigin: (location: SandboxMessageLocation) => string
  isTrustedParentMessage: (
    event: Pick<MessageEvent, 'origin' | 'source'>,
    location: SandboxMessageLocation,
    parentWindow: Window
  ) => boolean
}

const createLocation = (protocol: string, origin: string): SandboxMessageLocation => ({
  protocol,
  origin,
})

const loadPublicSandboxMessaging = async (): Promise<PublicSandboxMessaging> => {
  const moduleUrl = pathToFileURL(path.resolve('public/sandbox-messaging.js')).href
  return (await import(moduleUrl)) as PublicSandboxMessaging
}

describe('sandbox messaging origins', () => {
  it('uses a wildcard target origin for file URLs', () => {
    expect(getSandboxMessageTargetOrigin(createLocation('file:', 'file://'))).toBe('*')
  })

  it('uses a wildcard target origin for opaque sandbox iframes', () => {
    expect(getSandboxMessageTargetOrigin(createLocation('https:', 'https://aksel.nav.no'))).toBe(
      '*'
    )
  })

  it('keeps exact parent target origins for sandbox responses', async () => {
    const { getMessageTargetOrigin } = await loadPublicSandboxMessaging()

    expect(getMessageTargetOrigin(createLocation('https:', 'https://aksel.nav.no'))).toBe(
      'https://aksel.nav.no'
    )
  })

  it('allows Electron file-origin parent messages reported as null origin', async () => {
    const { getMessageTargetOrigin, isTrustedParentMessage } = await loadPublicSandboxMessaging()
    const parentWindow = {} as Window
    const fileLocation = createLocation('file:', 'file://')

    expect(getMessageTargetOrigin(fileLocation)).toBe('*')
    expect(
      isTrustedParentMessage({ origin: 'null', source: parentWindow }, fileLocation, parentWindow)
    ).toBe(true)
  })

  it('rejects null-origin messages when the source is not the parent', async () => {
    const { isTrustedParentMessage } = await loadPublicSandboxMessaging()
    const fileLocation = createLocation('file:', 'file://')

    expect(
      isTrustedParentMessage(
        { origin: 'null', source: {} as Window },
        fileLocation,
        {} as Window
      )
    ).toBe(false)
  })

  it('rejects null-origin messages outside file URLs', async () => {
    const { isTrustedParentMessage } = await loadPublicSandboxMessaging()
    const parentWindow = {} as Window
    const webLocation = createLocation('https:', 'https://aksel.nav.no')

    expect(
      isTrustedParentMessage({ origin: 'null', source: parentWindow }, webLocation, parentWindow)
    ).toBe(false)
  })
})
