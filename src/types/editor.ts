export type EditorTab = 'JSX' | 'Hooks'

export interface CursorPosition {
  line: number // 0-indexed line number
  column: number // 0-indexed column number
}

export interface SelectionRange {
  start: CursorPosition
  end: CursorPosition
}

export interface HistoryStack {
  past: string[] // Previous code states (for undo)
  current: string // Current code state
  future: string[] // Undone states (for redo)
}

export interface LintMarker {
  line: number
  column: number
  message: string
  severity: 'error' | 'warning' | 'info'
}

export interface EditorState {
  // Active context
  activeTab: EditorTab // Currently visible tab

  // Cursor state (per tab)
  jsxCursor: CursorPosition // Cursor in JSX tab
  hooksCursor: CursorPosition // Cursor in Hooks tab

  // Selection state (per tab)
  jsxSelection: SelectionRange | null
  hooksSelection: SelectionRange | null

  // Edit history (per tab)
  jsxHistory: HistoryStack
  hooksHistory: HistoryStack

  // Lint/error markers
  jsxErrors: LintMarker[]
  hooksErrors: LintMarker[]
}
