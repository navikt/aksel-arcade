import { useContext } from 'react'
import { AppContext } from '@/hooks/useProject'
import { CodeEditor } from './CodeEditor'
import { EditorTabs } from './EditorTabs'
import { EditorToolbar } from './EditorToolbar'
import { ComponentPalette } from './ComponentPalette'
import type { ComponentSnippet } from '@/types/snippets'
import { formatCode } from '@/services/formatter'
import './EditorPane.css'

export const EditorPane = () => {
  const context = useContext(AppContext)
  if (!context) throw new Error('EditorPane must be used within AppProvider')

  const { project, editorState, isComponentPaletteOpen, updateProject, updateEditorState, insertSnippet, toggleComponentPalette } = context

  const currentTab = editorState.activeTab
  const currentContent = currentTab === 'JSX' ? project.jsxCode : project.hooksCode

  const handleCodeChange = (newContent: string) => {
    if (currentTab === 'JSX') {
      updateProject({ jsxCode: newContent })
    } else {
      updateProject({ hooksCode: newContent })
    }
  }

  const handleCursorChange = (cursor: { line: number; column: number }) => {
    if (currentTab === 'JSX') {
      updateEditorState({ jsxCursor: cursor })
    } else {
      updateEditorState({ hooksCursor: cursor })
    }
  }

  const handleTabChange = (tabId: string) => {
    updateEditorState({ activeTab: tabId as 'JSX' | 'Hooks' })
  }

  const handleSnippetSelect = (snippet: ComponentSnippet) => {
    insertSnippet(snippet)
  }

  const handleFormat = async () => {
    try {
      const formatted = await formatCode(currentContent, { parser: 'babel' })
      console.log('✅ Format successful!')
      handleCodeChange(formatted)
    } catch {
      // Silently ignore format errors - invalid syntax expected while editing
      console.log('Format skipped - invalid syntax (expected while editing)')
    }
  }

  return (
    <div className="editor-pane">
      <EditorTabs activeTab={currentTab} onTabChange={handleTabChange} />
      
      <EditorToolbar
        canUndo={editorState.jsxHistory.past.length > 0 || editorState.hooksHistory.past.length > 0}
        canRedo={editorState.jsxHistory.future.length > 0 || editorState.hooksHistory.future.length > 0}
        onAddComponent={() => toggleComponentPalette()}
        onFormat={handleFormat}
        onUndo={() => console.log('Undo')}
        onRedo={() => console.log('Redo')}
      />

      <CodeEditor 
        value={currentContent} 
        onChange={handleCodeChange}
        onCursorChange={handleCursorChange}
        onFormat={handleFormat}
      />

      {isComponentPaletteOpen && (
        <ComponentPalette
          isOpen={isComponentPaletteOpen}
          onSelectSnippet={handleSnippetSelect}
          onClose={() => toggleComponentPalette()}
        />
      )}
    </div>
  )
}
