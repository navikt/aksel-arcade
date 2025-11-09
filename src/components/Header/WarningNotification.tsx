import { Alert } from '@navikt/ds-react'
import './WarningNotification.css'

interface WarningNotificationProps {
  message: string
  onClose?: () => void
}

export const WarningNotification = ({ message, onClose }: WarningNotificationProps) => {
  return (
    <div className="warning-notification">
      <Alert variant="warning" size="small" closeButton={!!onClose} onClose={onClose}>
        {message}
      </Alert>
    </div>
  )
}
