import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import { useDebouncedCallback } from '@/hooks/useDebounce'
import { AKSEL_SNIPPETS } from '@/services/componentLibrary'
import './CodeEditor.css'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  onCursorChange?: (cursor: { line: number; column: number }) => void
  language?: 'jsx' | 'typescript'
  readOnly?: boolean
  height?: string
}

export const CodeEditor = ({
  value,
  onChange,
  onCursorChange,
  language = 'jsx',
  readOnly = false,
  height = '100%',
}: CodeEditorProps) => {
  // Debounce changes by 250ms
  const debouncedOnChange = useDebouncedCallback(onChange, 250)

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
        value={value}
        height={height}
        extensions={[
          javascript({ jsx: language === 'jsx', typescript: true }),
          autocompletion({ override: [akselCompletion], activateOnTyping: true }),
        ]}
        onChange={debouncedOnChange}
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
}
