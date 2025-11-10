import { useContext, useRef } from 'react'
import { AppContext } from '@/hooks/useProject'
import { CodeEditor, type CodeEditorRef } from './CodeEditor'
import { EditorTabs } from './EditorTabs'
import { EditorToolbar } from './EditorToolbar'
import { ComponentPalette } from '@/components/ComponentPalette'
import { formatCode } from '@/services/formatter'
import './EditorPane.css'

export const EditorPane = () => {
  const context = useContext(AppContext)
  if (!context) throw new Error('EditorPane must be used within AppProvider')

  const { project, editorState, isComponentPaletteOpen, updateProject, updateEditorState, toggleComponentPalette } = context
  
  // Ref for the currently active editor to access undo/redo
  const editorRef = useRef<CodeEditorRef>(null)

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

  const handleComponentInsert = (snippet: string) => {
    // Insert the snippet at the current cursor position
    const currentContent = currentTab === 'JSX' ? project.jsxCode : project.hooksCode
    const cursor = currentTab === 'JSX' ? editorState.jsxCursor : editorState.hooksCursor
    
    // Simple insertion: add snippet at cursor or end of code
    const lines = currentContent.split('\n')
    const insertLine = cursor?.line ?? lines.length
    
    // Insert with proper indentation
    lines.splice(insertLine, 0, snippet)
    const newContent = lines.join('\n')
    
    handleCodeChange(newContent)
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

  const handleUndo = () => {
    editorRef.current?.undo()
  }

  const handleRedo = () => {
    editorRef.current?.redo()
  }

  // For now, we always enable undo/redo buttons
  // CodeMirror's history system handles the actual state
  // TODO: Track CodeMirror's history state for precise button enabling
  const canUndo = true
  const canRedo = true

  return (
    <div className="editor-pane">
      <EditorTabs activeTab={currentTab} onTabChange={handleTabChange} />
      
      <EditorToolbar
        canUndo={canUndo}
        canRedo={canRedo}
        onAddComponent={() => toggleComponentPalette()}
        onFormat={handleFormat}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      <CodeEditor 
        ref={editorRef}
        key={currentTab}
        value={currentContent} 
        onChange={handleCodeChange}
        onCursorChange={handleCursorChange}
        onFormat={handleFormat}
      />

      <ComponentPalette
        open={isComponentPaletteOpen}
        onInsertComponent={handleComponentInsert}
        onClose={() => toggleComponentPalette()}
      />
    </div>
  )
}
