import { useCallback, useEffect, useState } from 'react'
import { ActionMenu, Box, Button, Detail, VStack } from '@navikt/ds-react'
import { FilesIcon, RobotIcon } from '@navikt/aksel-icons'
import { useAgentSession } from '@/hooks/useAgentSession'
import { requestPreviewEvidenceFromFrame } from '@/services/previewEvidence'
import { useSettings } from '@/contexts/SettingsContext'
import { useProject } from '@/hooks/useProject'
import { formatAgentErrorForLog } from '@/services/agentHandoffRedaction'

export const AgentSessionMenu = () => {
  const {
    project,
    previewIframeRef,
    previewState,
    updateProject,
    createPage,
    renamePage,
    deletePage,
    setStartPage,
  } = useProject()
  const { multiPageEnabled, theme, setTheme } = useSettings()
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const getPreviewEvidence = useCallback(
    () => requestPreviewEvidenceFromFrame(previewIframeRef.current),
    [previewIframeRef]
  )
  const {
    agentPairingHandoffCommand,
    isActive,
    statusText,
    startAgentSession,
    stopAgentSession,
  } = useAgentSession({
    project,
    previewState,
    theme,
    multiPageEnabled,
    onProjectChange: updateProject,
    onCreatePage: createPage,
    onRenamePage: renamePage,
    onDeletePage: deletePage,
    onSetStartPage: setStartPage,
    onThemeChange: setTheme,
    getPreviewEvidence,
  })

  const handleAccessChange = (checked: boolean) => {
    setCopyStatus('idle')
    if (checked) {
      void startAgentSession().catch((error) => {
        console.error('Agent access could not be started.', formatAgentErrorForLog(error))
      })
    } else {
      stopAgentSession()
    }
  }

  const copyAgentCommand = async () => {
    setCopyStatus('idle')
    if (!agentPairingHandoffCommand) {
      console.error(
        'Agent command could not be copied: Agent access is inactive or Desktop transport is unavailable.'
      )
      setCopyStatus('error')
      return
    }

    if (!navigator.clipboard?.writeText) {
      console.error('Agent command could not be copied: clipboard API is unavailable.')
      setCopyStatus('error')
      return
    }

    try {
      await navigator.clipboard.writeText(agentPairingHandoffCommand)
      setCopyStatus('success')
    } catch (error) {
      console.error(
        'Agent command could not be copied.',
        formatAgentErrorForLog(error, {
          knownSecrets: [agentPairingHandoffCommand],
        })
      )
      setCopyStatus('error')
    }
  }

  const copyFeedbackText =
    copyStatus === 'success'
      ? 'Command copied!'
      : copyStatus === 'error'
        ? 'Could not copy command. Try again.'
        : null

  useEffect(() => {
    if (copyStatus !== 'success') return
    const timer = setTimeout(() => setCopyStatus('idle'), 3000)
    return () => clearTimeout(timer)
  }, [copyStatus])

  return (
    <ActionMenu>
      <ActionMenu.Trigger>
        <Button
          variant="tertiary"
          data-color="neutral"
          size="small"
          icon={<RobotIcon title="Agent" />}
          aria-label="Connect an agent"
          data-testid="agent-session-menu"
        />
      </ActionMenu.Trigger>
      <ActionMenu.Content className="agent-menu">
        <ActionMenu.Label>Connect an agent</ActionMenu.Label>
        <ActionMenu.CheckboxItem checked={isActive} onCheckedChange={handleAccessChange}>
          Agent bridge
        </ActionMenu.CheckboxItem>
        <Box paddingInline="space-12" paddingBlock="space-8" role="none">
          <Detail role="status" aria-live="polite" className="agent-menu__status">
            {statusText}
          </Detail>
        </Box>
        {isActive && (
          <>
            <ActionMenu.Label>Connect command</ActionMenu.Label>
            <Box paddingInline="space-12" paddingBlock="space-8" role="none">
              <VStack gap="space-6">
                <Detail className="agent-menu__context">
                  Click the button below to copy a command, and share that with your agent. The
                  command will give the agent access to this project while the Agent bridge is
                  active.
                </Detail>
                {copyFeedbackText && (
                  <Detail
                    aria-live="polite"
                    className={
                      copyStatus === 'success'
                        ? 'agent-menu__feedback--success'
                        : 'agent-menu__context'
                    }
                    role={copyStatus === 'error' ? 'alert' : undefined}
                  >
                    {copyFeedbackText}
                  </Detail>
                )}
              </VStack>
            </Box>
            <ActionMenu.Item
              icon={<FilesIcon aria-hidden />}
              onSelect={(event) => {
                event.preventDefault()
                void copyAgentCommand()
              }}
            >
              {copyStatus === 'error' ? 'Try again' : 'Copy command'}
            </ActionMenu.Item>
          </>
        )}
      </ActionMenu.Content>
    </ActionMenu>
  )
}
