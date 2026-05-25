import { ActionMenu, BodyShort, Box, Button, Detail, VStack } from '@navikt/ds-react'
import { RobotIcon } from '@navikt/aksel-icons'
import { useAgentSession } from '@/hooks/useAgentSession'
import { AGENT_BRIDGE_GLOBAL, type AgentPermissionKey } from '@/services/agentBridge'
import { useSettings } from '@/contexts/SettingsContext'
import { useProject } from '@/hooks/useProject'

interface PermissionItem {
  key: AgentPermissionKey
  label: string
}

const permissionItems: PermissionItem[] = [
  { key: 'sourceChanges', label: 'Allow source changes' },
  { key: 'previewSettings', label: 'Allow preview setting changes' },
  { key: 'previewEvidence', label: 'Allow Preview evidence reads' },
  { key: 'projectMetadata', label: 'Allow project metadata changes' },
]

export const AgentSessionMenu = () => {
  const { project } = useProject()
  const { theme } = useSettings()
  const {
    agentInstructions,
    isActive,
    permissions,
    statusText,
    startAgentSession,
    stopAgentSession,
    setPermission,
  } = useAgentSession({ project, theme })

  const handleAccessChange = (checked: boolean) => {
    if (checked) {
      startAgentSession()
    } else {
      stopAgentSession()
    }
  }

  const handleCopyInstructions = async () => {
    if (!navigator.clipboard?.writeText) {
      console.error('Agent instructions could not be copied: clipboard API is unavailable.')
      return
    }

    try {
      await navigator.clipboard.writeText(agentInstructions)
    } catch (error) {
      console.error('Agent instructions could not be copied.', error)
    }
  }

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
        <ActionMenu.Label>Agent session</ActionMenu.Label>
        <Box paddingInline="space-12" paddingBlock="space-8" role="none">
          <VStack gap="space-6">
            <Detail role="status" aria-live="polite" className="agent-menu__status">
              {statusText}
            </Detail>
            <BodyShort size="small">
              Bridge global: <code>{AGENT_BRIDGE_GLOBAL}</code>
            </BodyShort>
            <BodyShort size="small">
              Arcade-scoped read access is mandatory while active so an authorized agent can
              understand the current project and preview context.
            </BodyShort>
            <Button
              type="button"
              size="small"
              variant="secondary"
              onClick={handleCopyInstructions}
            >
              Copy agent instructions
            </Button>
          </VStack>
        </Box>
        <ActionMenu.Divider />
        <ActionMenu.Group label="Access">
          <ActionMenu.CheckboxItem checked={isActive} onCheckedChange={handleAccessChange}>
            {isActive ? 'Stop temporary Agent access' : 'Start temporary Agent access'}
          </ActionMenu.CheckboxItem>
        </ActionMenu.Group>
        <ActionMenu.Divider />
        <ActionMenu.Group label="Permissions">
          {permissionItems.map((item) => (
            <ActionMenu.CheckboxItem
              key={item.key}
              checked={permissions[item.key]}
              onCheckedChange={(checked) => setPermission(item.key, checked)}
            >
              {item.label}
            </ActionMenu.CheckboxItem>
          ))}
        </ActionMenu.Group>
      </ActionMenu.Content>
    </ActionMenu>
  )
}
