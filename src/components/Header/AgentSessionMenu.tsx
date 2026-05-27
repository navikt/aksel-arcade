import { useCallback, useState } from 'react'
import { ActionMenu, Box, Button, Detail, VStack } from '@navikt/ds-react'
import { FilesIcon, RobotIcon } from '@navikt/aksel-icons'
import { useAgentSession } from '@/hooks/useAgentSession'
import { type AgentChangeField } from '@/services/agentBridge'
import { collectPreviewEvidenceFromFrame } from '@/services/previewEvidence'
import { useSettings } from '@/contexts/SettingsContext'
import { useProject } from '@/hooks/useProject'

export const AgentSessionMenu = () => {
  const { project, previewIframeRef, previewState, updateProject } = useProject()
  const { theme, setTheme } = useSettings()
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const getPreviewEvidence = useCallback(
    () => collectPreviewEvidenceFromFrame(previewIframeRef.current),
    [previewIframeRef]
  )
  const {
    agentInstructions,
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
        console.error('Agent access could not be started.', error)
      })
    } else {
      stopAgentSession()
    }
  }

  const copyAgentInstructions = async () => {
    setCopyStatus('idle')
    if (!navigator.clipboard?.writeText) {
      console.error('Agent instructions could not be copied: clipboard API is unavailable.')
      setCopyStatus('error')
      return
    }

    try {
      await navigator.clipboard.writeText(agentInstructions)
      setCopyStatus('success')
    } catch (error) {
      console.error('Agent instructions could not be copied.', error)
      setCopyStatus('error')
    }
  }

  const copyFeedbackText =
    copyStatus === 'success'
      ? 'Instruksjoner kopiert.'
      : copyStatus === 'error'
        ? 'Kunne ikke kopiere instruksjoner. Prøv igjen.'
        : null

  return (
    <ActionMenu>
      <ActionMenu.Trigger>
        <Button
          variant="tertiary"
          data-color="neutral"
          size="small"
          icon={<RobotIcon title="Agent" />}
          aria-label="Agent access"
          data-testid="agent-session-menu"
        />
      </ActionMenu.Trigger>
      <ActionMenu.Content className="agent-menu">
        <ActionMenu.Label>Gi agenter tilgang</ActionMenu.Label>
        <ActionMenu.CheckboxItem checked={isActive} onCheckedChange={handleAccessChange}>
          Agent-tilgang
        </ActionMenu.CheckboxItem>
        <Box paddingInline="space-12" paddingBlock="space-8" role="none">
          <Detail role="status" aria-live="polite" className="agent-menu__status">
            {statusText}
          </Detail>
        </Box>
        <ActionMenu.Divider />
        <ActionMenu.Label>Gi agenten kontekst</ActionMenu.Label>
        <Box paddingInline="space-12" paddingBlock="space-8" role="none">
          <VStack gap="space-6">
            <Detail className="agent-menu__context">
              Klikk på knappen nedenfor for å kopiere instrukser du kan gi til agenten, slik at den
              får tilgang til denne filen.
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
            void copyAgentInstructions()
          }}
        >
          {copyStatus === 'error' ? 'Prøv igjen' : 'Kopier instruksjoner'}
        </ActionMenu.Item>
        {checkpoints.length > 0 && (
          <>
            <ActionMenu.Divider />
            <ActionMenu.Group label="Rollback Checkpoints">
              {checkpoints.map((checkpoint) => (
                <ActionMenu.Item
                  key={checkpoint.id}
                  onSelect={() => restoreCheckpoint(checkpoint.id)}
                >
                  {`Restore ${checkpoint.summary} (${formatChangedFields(checkpoint.changedFields)})`}
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
      return 'Viewport'
    case 'theme':
      return 'Theme'
    case 'name':
      return 'Name'
  }
}
