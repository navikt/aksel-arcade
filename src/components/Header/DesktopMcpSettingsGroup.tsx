import { useEffect, useState } from 'react'
import { FilesIcon } from '@navikt/aksel-icons'
import { ActionMenu, Box, Detail, VStack } from '@navikt/ds-react'
import {
  DESKTOP_MCP_LAST_ACTIVITY_PLACEHOLDER,
  formatDesktopMcpAvailability,
  type DesktopMcpServerState,
} from '@/services/desktopMcp'

interface DesktopMcpSettingsGroupProps {
  mcpState?: DesktopMcpServerState | null
}

interface CopyFeedback {
  kind: 'success' | 'error'
  text: string
}

export const DesktopMcpSettingsGroup = ({
  mcpState = null,
}: DesktopMcpSettingsGroupProps) => {
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null)

  useEffect(() => {
    if (!copyFeedback) {
      return
    }

    const timer = setTimeout(() => setCopyFeedback(null), 2500)
    return () => clearTimeout(timer)
  }, [copyFeedback])

  const statusText = mcpState
    ? formatDesktopMcpAvailability(mcpState.availability)
    : 'Status: Unavailable: Desktop Arcade MCP configuration is unavailable.'
  const isAvailable = mcpState?.availability.status === 'available'

  const copyValue = async (value: string, label: string) => {
    if (!navigator.clipboard?.writeText) {
      setCopyFeedback({
        kind: 'error',
        text: `Could not copy ${label}. Try again.`,
      })
      return
    }

    try {
      await navigator.clipboard.writeText(value)
      setCopyFeedback({
        kind: 'success',
        text: `${label} copied.`,
      })
    } catch {
      setCopyFeedback({
        kind: 'error',
        text: `Could not copy ${label}. Try again.`,
      })
    }
  }

  return (
    <ActionMenu.Group label="Desktop Arcade MCP">
      <Box paddingInline="space-12" paddingBlock="space-8" role="none">
        <VStack gap="space-4">
          <Detail role="status" aria-live="polite">
            {statusText}
          </Detail>
          {isAvailable && mcpState && (
            <>
              <Detail>Server name: {mcpState.serverName}</Detail>
              <Detail>Type: {mcpState.transportLabel}</Detail>
              <Detail>URL: {mcpState.url}</Detail>
              <Detail>{mcpState.authDescription}</Detail>
            </>
          )}
          {mcpState && !isAvailable && (
            <Detail>Connection details are available once Desktop Arcade owns the MCP endpoint.</Detail>
          )}
          <Detail>{DESKTOP_MCP_LAST_ACTIVITY_PLACEHOLDER}</Detail>
          {copyFeedback && (
            <Detail
              aria-live="polite"
              role={copyFeedback.kind === 'error' ? 'alert' : 'status'}
            >
              {copyFeedback.text}
            </Detail>
          )}
        </VStack>
      </Box>
      {isAvailable && mcpState && (
        <>
          <ActionMenu.Item
            icon={<FilesIcon aria-hidden />}
            onSelect={(event) => {
              event.preventDefault()
              void copyValue(mcpState.serverName, 'server name')
            }}
          >
            Copy server name
          </ActionMenu.Item>
          <ActionMenu.Item
            icon={<FilesIcon aria-hidden />}
            onSelect={(event) => {
              event.preventDefault()
              void copyValue(mcpState.transportLabel, 'type')
            }}
          >
            Copy type
          </ActionMenu.Item>
          <ActionMenu.Item
            icon={<FilesIcon aria-hidden />}
            onSelect={(event) => {
              event.preventDefault()
              void copyValue(mcpState.url, 'MCP URL')
            }}
          >
            Copy MCP URL
          </ActionMenu.Item>
        </>
      )}
    </ActionMenu.Group>
  )
}
