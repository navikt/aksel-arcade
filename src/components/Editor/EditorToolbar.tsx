import { Button } from '@navikt/ds-react'
import { PlusIcon } from '@navikt/aksel-icons'
import './EditorToolbar.css'

interface EditorToolbarProps {
  onAddComponent: () => void
  onFormat?: () => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
}

export const EditorToolbar = ({
  onAddComponent,
  onFormat,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: EditorToolbarProps) => {
  return (
    <div className="editor-toolbar">
      <Button
        variant="secondary"
        size="small"
        icon={<PlusIcon aria-hidden />}
        onClick={onAddComponent}
      >
        Add Component
      </Button>

      <div className="editor-toolbar__spacer" />

      {onFormat && (
        <Button variant="tertiary" size="small" onClick={onFormat}>
          Format
        </Button>
      )}

      {onUndo && (
        <Button variant="tertiary" size="small" onClick={onUndo} disabled={!canUndo}>
          Undo
        </Button>
      )}

      {onRedo && (
        <Button variant="tertiary" size="small" onClick={onRedo} disabled={!canRedo}>
          Redo
        </Button>
      )}
    </div>
  )
}
