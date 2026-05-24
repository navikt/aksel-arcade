import { Alert, BodyLong, BodyShort, Button, HStack, VStack } from '@navikt/ds-react'
import './WarningNotification.css'

interface WarningNotificationProps {
  message: string
  description?: string
  variant?: 'info' | 'warning' | 'error' | 'success'
  actions?: WarningNotificationAction[]
  onClose?: () => void
}

interface WarningNotificationAction {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'tertiary'
}

export const WarningNotification = ({
  message,
  description,
  variant = 'warning',
  actions,
  onClose,
}: WarningNotificationProps) => {
  return (
    <div className="warning-notification">
      <Alert variant={variant} size="small" closeButton={!!onClose} onClose={onClose}>
        <VStack gap="space-8">
          <BodyShort size="small" weight="semibold">
            {message}
          </BodyShort>
          {description && <BodyLong size="small">{description}</BodyLong>}
          {actions?.length ? (
            <HStack gap="space-8" wrap>
              {actions.map((action) => (
                <Button
                  key={action.label}
                  size="small"
                  variant={action.variant ?? 'secondary'}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
            </HStack>
          ) : null}
        </VStack>
      </Alert>
    </div>
  )
}
