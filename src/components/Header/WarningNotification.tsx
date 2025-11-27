import { Alert, BodyLong, Button } from '@navikt/ds-react'
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

export const WarningNotification = ({ message, description, variant = 'warning', actions, onClose }: WarningNotificationProps) => {
  return (
    <div className="warning-notification">
      <Alert variant={variant} size="small" closeButton={!!onClose} onClose={onClose}>
        <div className="warning-notification__content">
          <span className="warning-notification__message">{message}</span>
          {description && (
            <BodyLong size="small">
              {description}
            </BodyLong>
          )}
          {actions?.length ? (
            <div className="warning-notification__actions">
              {actions.map(action => (
                <Button
                  key={action.label}
                  size="small"
                  variant={action.variant ?? 'secondary'}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      </Alert>
    </div>
  )
}
