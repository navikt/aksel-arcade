import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import { keymap } from '@codemirror/view'
import { undo, redo } from '@codemirror/commands'
import { linter, type Diagnostic } from '@codemirror/lint'
import { forwardRef, useImperativeHandle, useRef } from 'react'
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { AKSEL_SNIPPETS } from '@/services/componentLibrary'
import * as Babel from '@babel/standalone'
import './CodeEditor.css'

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
  height?: string
}

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
        // Adjust line number to account for wrapper (subtract 5 lines)
        const actualLine = Math.max(0, babelError.loc.line - 6)
        const pos = view.state.doc.line(actualLine + 1).from + (babelError.loc.column || 0)
        
        diagnostics.push({
          from: pos,
          to: pos,
          severity: 'error',
          message: babelError.message?.split('\n')[0] || 'Syntax error',
        })
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
  height = '100%',
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

  // Custom autocomplete for Aksel components
  const akselCompletion = (context: CompletionContext): CompletionResult | null => {
    // Match < followed by word characters (for JSX tags)
    const beforeLt = context.matchBefore(/<\w*/)
    
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
          info: snippet.template,
          apply: template, // Apply the parsed template without leading <
        }
      }).filter(opt => 
        // Filter by query if user has typed something after <
        query === '' || opt.label.toLowerCase().startsWith(query.toLowerCase())
      )

      if (options.length > 0) {
        return {
          from: beforeLt.from + 1, // Start after the < character (keep user's <)
          options,
        }
      }
    }

    // Also match word at cursor (for non-JSX context)
    const word = context.matchBefore(/\w+/)
    if (word && word.text.length > 0) {
      const options = AKSEL_SNIPPETS.map((snippet) => {
        let template = snippet.template
        template = template.replace(/\$\{(\d+):([^}]+)\}/g, (_match, _num, placeholder) => placeholder)
        
        return {
          label: snippet.name,
          type: 'class',
          detail: snippet.description,
          info: snippet.template,
          apply: template,
        }
      }).filter(opt => 
        opt.label.toLowerCase().startsWith(word.text.toLowerCase())
      )

      if (options.length > 0) {
        return {
          from: word.from,
          options,
        }
      }
    }

    return null
  }

  return (
    <div className="code-editor" style={{ height }}>
      <CodeMirror
        ref={editorRef}
        value={value}
        height={height}
        extensions={[
          javascript({ jsx: language === 'jsx', typescript: true }),
          autocompletion({ override: [akselCompletion], activateOnTyping: true }),
          customKeymap,
          jsxLinter,
        ]}
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
        theme="dark"
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
          autocompletion: true,
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
