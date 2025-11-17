import { Button, HStack } from '@navikt/ds-react'
import { PlusIcon, CodeIcon, ArrowUndoIcon, ArrowRedoIcon } from '@navikt/aksel-icons'

interface EditorToolbarProps {
  onAddComponent: () => void
  onFormat?: () => void | Promise<void>
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
    <HStack data-name="Right group" gap="space-12" align="center">
      <Button
        variant="primary-neutral"
        size="small"
        icon={<PlusIcon aria-hidden />}
        onClick={onAddComponent}
      >
        Add
      </Button>

      {onFormat && (
        <Button 
          variant="tertiary-neutral" 
          size="small" 
          icon={<CodeIcon aria-hidden />}
          onClick={onFormat}
        >
          Format
        </Button>
      )}

      {onUndo && (
        <Button 
          variant="tertiary-neutral" 
          size="small" 
          icon={<ArrowUndoIcon title="Undo" />}
          onClick={onUndo} 
          disabled={!canUndo}
        />
      )}

      {onRedo && (
        <Button 
          variant="tertiary-neutral" 
          size="small" 
          icon={<ArrowRedoIcon title="Redo" />}
          onClick={onRedo} 
          disabled={!canRedo}
        />
      )}
    </HStack>
  )
}
