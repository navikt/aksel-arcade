import { useCallback, useState } from 'react'
import { ActionMenu, Box, Button, Detail, VStack } from '@navikt/ds-react'
import { FilesIcon, RobotIcon } from '@navikt/aksel-icons'
import { useAgentSession } from '@/hooks/useAgentSession'
import { type AgentChangeField } from '@/services/agentBridge'
import { collectPreviewEvidenceFromFrame } from '@/services/previewEvidence'
import { useSettings } from '@/contexts/SettingsContext'
import { useProject } from '@/hooks/useProject'
import { formatAgentErrorForLog } from '@/services/agentHandoffRedaction'

export const AgentSessionMenu = () => {
  const { project, previewIframeRef, previewState, updateProject } = useProject()
  const { theme, setTheme } = useSettings()
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const getPreviewEvidence = useCallback(
    () => collectPreviewEvidenceFromFrame(previewIframeRef.current),
    [previewIframeRef]
  )
  const {
    agentPairingHandoffCommand,
    checkpoints,
    isActive,
    restoreCheckpoint,
    statusText,
    startAgentSession,
    stopAgentSession,
  } = useAgentSession({
    project,
    previewState,
    theme,
    onProjectChange: updateProject,
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
      ? 'Agentkommando kopiert.'
      : copyStatus === 'error'
        ? 'Kunne ikke kopiere agentkommando. Prøv igjen.'
        : null

  return (
    <ActionMenu>
      <ActionMenu.Trigger>
        <Button
          variant="tertiary"
          data-color="neutral"
          size="small"
          icon={<RobotIcon title="Agent" />}
          aria-label="Koble til agent"
          data-testid="agent-session-menu"
        />
      </ActionMenu.Trigger>
      <ActionMenu.Content className="agent-menu">
        <ActionMenu.Label>Koble til agent</ActionMenu.Label>
        <ActionMenu.CheckboxItem checked={isActive} onCheckedChange={handleAccessChange}>
          Agent-tilgang
        </ActionMenu.CheckboxItem>
        <Box paddingInline="space-12" paddingBlock="space-8" role="none">
          <Detail role="status" aria-live="polite" className="agent-menu__status">
            {statusText}
          </Detail>
        </Box>
        <Box paddingInline="space-12" paddingBlock="space-8" role="none">
          <VStack gap="space-6">
            <Detail className="agent-menu__context">
              Start Agent-tilgang, kopier kommandoen og del den med agenten du vil koble til.
              Kommandoen gir agenten tilgang til dette aktive Arcade-prosjektet mens Agent-tilgang
              er aktiv.
            </Detail>
            <Detail className="agent-menu__warning">
              Del bare med agenten du vil gi tilgang.
            </Detail>
            {copyFeedbackText && (
              <Detail
                aria-live="polite"
                className="agent-menu__context"
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
          {copyStatus === 'error' ? 'Prøv igjen' : 'Kopier agentkommando'}
        </ActionMenu.Item>
        {checkpoints.length > 0 && (
          <>
            <ActionMenu.Divider />
            <ActionMenu.Group label="Kontrollpunkter">
              {checkpoints.map((checkpoint) => (
                <ActionMenu.Item
                  key={checkpoint.id}
                  onSelect={() => restoreCheckpoint(checkpoint.id)}
                >
                  {`Gjenopprett ${checkpoint.summary} (${formatChangedFields(checkpoint.changedFields)})`}
                </ActionMenu.Item>
              ))}
            </ActionMenu.Group>
          </>
        )}
      </ActionMenu.Content>
    </ActionMenu>
  )
}

const formatChangedFields = (fields: AgentChangeField[]): string =>
  fields.map(formatChangedField).join(' + ')

const formatChangedField = (field: AgentChangeField): string => {
  switch (field) {
    case 'jsxCode':
      return 'JSX'
    case 'hooksCode':
      return 'Hooks'
    case 'viewportSize':
      return 'Skjermstørrelse'
    case 'theme':
      return 'Tema'
    case 'name':
      return 'Navn'
  }
}
