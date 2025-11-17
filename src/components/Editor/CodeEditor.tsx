import CodeMirror from '@uiw/react-codemirror'
import { createTheme } from '@uiw/codemirror-themes'
import { javascript } from '@codemirror/lang-javascript'
import { autocompletion, startCompletion, completionStatus, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import { ViewPlugin, EditorView, type ViewUpdate } from '@codemirror/view'
import { keymap } from '@codemirror/view'
import { undo, redo } from '@codemirror/commands'
import { linter, type Diagnostic } from '@codemirror/lint'
import { bracketMatching } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { forwardRef, useImperativeHandle, useRef, useMemo } from 'react'
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { AKSEL_SNIPPETS } from '@/services/componentLibrary'
import { getComponentProps, getPropValues, getPropDefinition } from '@/services/akselMetadata'
import * as Babel from '@babel/standalone'
import './CodeEditor.css'

// Custom Aksel Darkside theme for CodeMirror
const akselDarksideTheme = createTheme({
  theme: 'dark',
  settings: {
    background: 'var(--ax-bg-default)',
    backgroundImage: '',
    foreground: 'var(--ax-text-neutral)',
    caret: 'var(--ax-text-neutral-decoration)',
    selection: 'var(--ax-bg-brand-magenta-moderate-hover)',
    selectionMatch: 'var(--ax-bg-brand-beige-moderate-hover)',
    gutterBackground: 'var(--ax-bg-neutral-soft)',
    gutterForeground: 'var(--ax-text-neutral)',
    gutterBorder: 'var(--ax-border-neutral-subtleA)',
    gutterActiveForeground: 'var(--ax-text-brand-magenta-subtle)',
    lineHighlight: 'var(--ax-bg-neutral-softA)',
  },
  styles: [
    { tag: t.comment, color: 'var(--ax-text-success-decoration)' },
    { tag: t.definition(t.typeName), color: 'var(--ax-text-meta-purple-subtle)' },
    { tag: t.typeName, color: 'var(--ax-text-meta-purple-subtle)' },
    { tag: t.tagName, color: 'var(--ax-text-accent-subtle)' },
    { tag: t.variableName, color: 'var(--ax-text-warning-subtle)' },
    { tag: t.propertyName, color: 'var(--ax-text-warning-subtle)' },
  ],
})

export interface CodeEditorRef {
  undo: () => void
  redo: () => void
}

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  onCursorChange?: (cursor: { line: number; column: number }) => void
  onFormat?: () => void | Promise<void>
  language?: 'jsx' | 'typescript'
  readOnly?: boolean
}

// Helper to detect if cursor is inside quotes of a prop value
function isCursorInPropValue(view: EditorView, pos: number): boolean {
  const line = view.state.doc.lineAt(pos)
  const textBeforeCursor = line.text.slice(0, pos - line.from)
  const textAfterCursor = line.text.slice(pos - line.from)
  
  // Check if cursor is between quotes: prop="...cursor..." or prop='...cursor...'
  // Match: <Component prop="text before cursor
  // Support component names with dots like Page.Block
  // Support prop names with hyphens like data-color
  const beforeMatch = textBeforeCursor.match(/<[\w.]+[^>]*\s+[\w-]+=["']([^"']*)$/)
  if (!beforeMatch) return false
  
  // Check that there's a closing quote after cursor (or end of prop value typing)
  // We're inside quotes if we haven't hit the closing quote yet
  const afterMatch = textAfterCursor.match(/^[^"']*["']/)
  
  // Inside quotes if: we have opening quote before AND (closing quote after OR still typing)
  return beforeMatch !== null && (afterMatch !== null || textAfterCursor.length === 0 || !textAfterCursor.includes('>'))
}

// ViewPlugin to trigger autocomplete when cursor enters prop value quotes
const cursorInQuotesPlugin = ViewPlugin.fromClass(class {
  private lastPos: number = -1
  private completionTimeout: number | null = null
  private lastTriggerTime: number = 0
  
  update(update: ViewUpdate) {
    // Only check on selection changes (cursor movement)
    if (!update.selectionSet) return
    
    const pos = update.state.selection.main.head
    
    // Skip if cursor hasn't actually moved to a different position
    if (pos === this.lastPos) return
    this.lastPos = pos
    
    // Clear any pending completion trigger
    if (this.completionTimeout !== null) {
      window.clearTimeout(this.completionTimeout)
      this.completionTimeout = null
    }
    
    // Check if autocomplete is already open - if so, don't re-trigger
    const status = completionStatus(update.state)
    if (status === 'active') {
      return
    }
    
    // Prevent re-triggering too quickly (within 500ms of last trigger)
    // This prevents the plugin from interfering with autocomplete navigation
    const now = Date.now()
    if (now - this.lastTriggerTime < 500) {
      return
    }
    
    // Check if cursor is inside prop value quotes
    if (isCursorInPropValue(update.view, pos)) {
      // Defer startCompletion to next tick to avoid calling during view update
      this.completionTimeout = window.setTimeout(() => {
        this.lastTriggerTime = Date.now()
        startCompletion(update.view)
        this.completionTimeout = null
      }, 0)
    }
  }
  
  destroy() {
    // Clean up timeout on plugin destruction
    if (this.completionTimeout !== null) {
      window.clearTimeout(this.completionTimeout)
    }
  }
})

// Create JSX linter using Babel for syntax validation
const jsxLinter = linter((view) => {
  const diagnostics: Diagnostic[] = []
  const code = view.state.doc.toString()

  // Wrap in default export component for validation
  const wrappedCode = `
import { Button, TextField, Select, Checkbox, Radio, Box, Stack, Grid } from '@navikt/ds-react'

function App() {
  return (
    <>
${code}
    </>
  );
}

export default App;
`

  try {
    Babel.transform(wrappedCode, {
      presets: ['react', 'typescript'],
      filename: 'app.tsx',
    })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'loc' in error) {
      const babelError = error as { loc?: { line: number; column: number }; message?: string }
      if (babelError.loc) {
        // Adjust line number to account for wrapper (subtract 6 lines)
        const actualLine = Math.max(0, babelError.loc.line - 6)
        const lineCount = view.state.doc.lines
        
        // Ensure we don't try to access invalid line numbers
        if (actualLine < lineCount) {
          const pos = view.state.doc.line(actualLine + 1).from + (babelError.loc.column || 0)
          
          diagnostics.push({
            from: pos,
            to: pos,
            severity: 'error',
            message: babelError.message?.split('\n')[0] || 'Syntax error',
          })
        } else {
          // If line is out of bounds, just report at end of document
          const lastLine = view.state.doc.line(lineCount)
          diagnostics.push({
            from: lastLine.from,
            to: lastLine.to,
            severity: 'error',
            message: babelError.message?.split('\n')[0] || 'Syntax error',
          })
        }
      }
    }
  }

  return diagnostics
})

export const CodeEditor = forwardRef<CodeEditorRef, CodeEditorProps>(({
  value,
  onChange,
  onCursorChange,
  onFormat,
  language = 'jsx',
  readOnly = false,
}, ref) => {
  const editorRef = useRef<ReactCodeMirrorRef>(null)

  // Expose undo/redo methods via ref
  useImperativeHandle(ref, () => ({
    undo: () => {
      const view = editorRef.current?.view
      if (view) {
        undo(view)
      }
    },
    redo: () => {
      const view = editorRef.current?.view
      if (view) {
        redo(view)
      }
    },
  }))

  // Memoize extensions to prevent CodeMirror from reinitializing on every render
  // This fixes the autocomplete focus snapping bug caused by extension recreation
  const extensions = useMemo(() => {
    // Custom keymap for formatting
    // Cmd/Ctrl+S hijacked from browser save, Alt+Shift+F as alternative
    const customKeymap = keymap.of([
      {
        key: 'Mod-s',
        preventDefault: true,
        run: () => {
          if (onFormat) {
            onFormat()
            return true
          }
          return false
        },
      },
      {
        key: 'Alt-Shift-f',
        preventDefault: true,
        run: () => {
          if (onFormat) {
            onFormat()
            return true
          }
          return false
        },
      },
    ])

    // Custom autocomplete for Aksel components, props, and prop values
    const akselCompletion = (context: CompletionContext): CompletionResult | null => {
    const line = context.state.doc.lineAt(context.pos)
    const textBeforeCursor = line.text.slice(0, context.pos - line.from)
    
    // 1. Match prop values: e.g., <Button variant="|" or size="m|" or variant="d|"
    // Support component names with dots like Page.Block
    // Support prop names with hyphens like data-color
    // This matches when typing inside quotes OR when cursor is right after opening quote
    const propValueMatch = textBeforeCursor.match(/<([\w.]+)[^>]*\s+([\w-]+)=["']([^"']*)$/)
    if (propValueMatch) {
      const [, componentName, propName, partialValue] = propValueMatch
      const values = getPropValues(componentName, propName)
      
      if (values.length > 0) {
        const propDef = getPropDefinition(componentName, propName)
        const options = values
          .filter((val) => val.toLowerCase().startsWith(partialValue.toLowerCase()))
          .map((val) => ({
            label: val,
            type: 'value',
            detail: propDef?.description || `${propName} value`,
            apply: val,
          }))
        
        if (options.length > 0) {
          const valueStart = context.pos - partialValue.length
          return {
            from: valueStart,
            options,
            filter: false, // Disable default filtering since we handle it
            validFor: /^[\w-]*$/, // Keep results valid while typing word characters or hyphens
          }
        }
      }
    }
    
    // 2. Match props after component name: e.g., <Button | or <Button v|
    // Support component names with dots like Page.Block
    // Support prop names with hyphens like data-color
    // Fixed ReDoS vulnerability by simplifying regex - use [^>]*? to skip existing props
    const propMatch = textBeforeCursor.match(/<([\w.]+)[^>]*?\s+([\w-]*)$/)
    if (propMatch) {
      const [, componentName, partialProp] = propMatch
      const props = getComponentProps(componentName)
      
      if (props.length > 0) {
        const options = props
          .filter((prop) => prop.toLowerCase().startsWith(partialProp.toLowerCase()))
          .map((prop) => {
            const propDef = getPropDefinition(componentName, prop)
            const hasValues = propDef?.values && propDef.values.length > 0
            
            return {
              label: prop,
              type: 'property',
              detail: propDef?.description || `${componentName} prop`,
              // If prop has enum values, add ="..." template, otherwise just add prop name
              apply: hasValues ? `${prop}=""` : prop,
              // Move cursor inside quotes if we added them
              boost: propDef?.required ? 10 : 0,
            }
          })
        
        if (options.length > 0) {
          const propStart = context.pos - partialProp.length
          return {
            from: propStart,
            options,
            validFor: /^[\w-]*$/, // Keep results valid while typing word characters or hyphens
          }
        }
      }
    }
    
    // 3. Match < followed by word characters (for JSX component tags)
    // Support component names with dots like Page.Block
    const beforeLt = context.matchBefore(/<[\w.]*/)
    if (beforeLt) {
      const query = beforeLt.text.slice(1) // Remove the <
      
      const options = AKSEL_SNIPPETS.map((snippet) => {
        // Parse template to extract just the component code (remove ${N:placeholder} syntax)
        let template = snippet.template
        template = template.replace(/\$\{(\d+):([^}]+)\}/g, (_match, _num, placeholder) => placeholder)
        
        // Strip the leading < since we're replacing after the < character
        if (template.startsWith('<')) {
          template = template.slice(1)
        }
        
        return {
          label: snippet.name,
          type: 'class',
          detail: snippet.description,
          // info: snippet.template, // DISABLED: Testing if preview popover causes focus snapping
          apply: template, // Apply the parsed template without leading <
        }
      }).filter(opt => 
        // Filter by query if user has typed something after <
        query === '' || opt.label.toLowerCase().startsWith(query.toLowerCase())
      )

      if (options.length > 0) {
        const result = {
          from: beforeLt.from + 1, // Start after the < character (keep user's <)
          options,
          validFor: /^[\w.]*$/, // Keep results valid while typing word characters or dots
        }
        console.log('[akselCompletion] Returning component completions:', options.length, 'items')
        return result
      }
    }

    // 4. Also match word at cursor (for non-JSX context)
    const word = context.matchBefore(/\w+/)
    if (word && word.text.length > 0) {
      const options = AKSEL_SNIPPETS.map((snippet) => {
        let template = snippet.template
        template = template.replace(/\$\{(\d+):([^}]+)\}/g, (_match, _num, placeholder) => placeholder)
        
        return {
          label: snippet.name,
          type: 'class',
          detail: snippet.description,
          // info: snippet.template, // DISABLED: Testing if preview popover causes focus snapping
          apply: template,
        }
      }).filter(opt => 
        opt.label.toLowerCase().startsWith(word.text.toLowerCase())
      )

      if (options.length > 0) {
        return {
          from: word.from,
          options,
          validFor: /^\w*$/, // Keep results valid while typing word characters
        }
      }
    }

      return null
    }

    // Return the extensions array
    return [
      javascript({ jsx: language === 'jsx', typescript: true }),
      autocompletion({ 
        override: [akselCompletion], 
        activateOnTyping: true,
        // Auto-trigger completion after selecting an option
        activateOnCompletion: () => true,
      }),
      bracketMatching(),
      cursorInQuotesPlugin,
      customKeymap,
      jsxLinter,
    ]
  }, [language, onFormat]) // Memoize based on language and onFormat

  return (
    <div className="code-editor">
      <CodeMirror
        ref={editorRef}
        value={value}
        extensions={extensions}
        onChange={onChange}
        onUpdate={(update) => {
          if (onCursorChange && update.selectionSet) {
            const pos = update.state.selection.main.head
            const line = update.state.doc.lineAt(pos)
            onCursorChange({
              line: line.number - 1, // 0-indexed
              column: pos - line.from,
            })
          }
        }}
        readOnly={readOnly}
        theme={akselDarksideTheme}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightSpecialChars: true,
          history: true,
          foldGutter: true,
          drawSelection: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          syntaxHighlighting: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false, // Disabled - we configure it manually in extensions
          rectangularSelection: true,
          crosshairCursor: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: true,
          defaultKeymap: true,
          searchKeymap: true,
          historyKeymap: true,
          foldKeymap: true,
          completionKeymap: true, // Keep keybindings for Ctrl+Space
          lintKeymap: true,
        }}
      />
    </div>
  )
})

CodeEditor.displayName = 'CodeEditor'
