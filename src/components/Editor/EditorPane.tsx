import { useContext, useMemo, useRef } from 'react'
import { Box, Button, HStack } from '@navikt/ds-react'
import { AppContext } from '@/hooks/useProject'
import { useSettings } from '@/contexts/SettingsContext'
import { CodeEditor, type CodeEditorRef } from './CodeEditor'
import { EditorTabs } from './EditorTabs'
import { EditorToolbar } from './EditorToolbar'
import { PagePanel } from './PagePanel'
import { ComponentPalette } from '@/components/ComponentPalette'
import { formatCode } from '@/services/formatter'
import {
  analyzeProjectPageReferences,
  getDeletePageImpact,
  type DeletePageImpact,
} from '@/services/pageReferences'
import { getSourceForEditTarget, resolveSelectedEditTarget } from '@/services/projectSource'
import type { ArcadePageId } from '@/types/project'
import './EditorPane.css'

export const EditorPane = () => {
  const context = useContext(AppContext)
  if (!context) throw new Error('EditorPane must be used within AppProvider')

  const {
    project,
    editorState,
    previewState,
    isComponentPaletteOpen,
    updateProject,
    createPage,
    renamePage,
    deletePage,
    setStartPage,
    updateEditorState,
    toggleComponentPalette,
    closeComponentPalette,
  } = context
  const {
    multiPageEnabled,
    pagePanelOpen,
    selectedEditTarget,
    setSelectedEditTarget,
    togglePagePanel,
  } = useSettings()

  // Ref for the currently active editor to access undo/redo
  const editorRef = useRef<CodeEditorRef>(null)

  const currentTab = editorState.activeTab
  const effectiveEditTarget = resolveSelectedEditTarget(multiPageEnabled, selectedEditTarget)
  const activeSource = getSourceForEditTarget(project, effectiveEditTarget)
  const currentContent = currentTab === 'JSX' ? activeSource.jsx : activeSource.hooks
  const validPageIds = useMemo(() => project.source.pages.map((page) => page.id), [project.source.pages])
  const errorPageIds = Array.from(
    new Set(
      [previewState.compileError?.pageId, previewState.runtimeError?.pageId].filter(
        (pageId): pageId is (typeof project.source.pages)[number]['id'] => typeof pageId === 'string'
      )
    )
  )
  const pageReferenceAnalysis = useMemo(
    () =>
      multiPageEnabled
        ? analyzeProjectPageReferences(project.source)
        : {
            brokenNavigationPageIds: [],
            globalConfigStaleReferences: [],
            staleReferencesByPageId: {},
          },
    [multiPageEnabled, project.source]
  )
  const deletePageImpacts = useMemo(
    () =>
      multiPageEnabled
        ? project.source.pages.reduce<Partial<Record<ArcadePageId, DeletePageImpact>>>(
            (result, page) => {
              result[page.id] = getDeletePageImpact(project.source, page.id)
              return result
            },
            {}
          )
        : {},
    [multiPageEnabled, project.source]
  )

  const handleCodeChange = (newContent: string) => {
    if (currentTab === 'JSX') {
      updateProject({ jsxCode: newContent, editTarget: effectiveEditTarget })
    } else {
      updateProject({ hooksCode: newContent, editTarget: effectiveEditTarget })
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
    // Close the component palette immediately
    closeComponentPalette()

    // Insert the snippet at the current cursor position
    const currentContent = currentTab === 'JSX' ? activeSource.jsx : activeSource.hooks
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
      handleCodeChange(formatted)
    } catch {
      // Silently ignore format errors - invalid syntax expected while editing
    }
  }

  const handleUndo = () => {
    editorRef.current?.undo()
  }

  const handleRedo = () => {
    editorRef.current?.redo()
  }

  const handleGlobalConfigSelect = () => {
    setSelectedEditTarget('global-config')
  }

  const handlePageSelect = (pageId: (typeof project.source.pages)[number]['id']) => {
    setSelectedEditTarget('page')
    updateProject({ activePageId: pageId })
  }

  const handleAddPage = () => {
    setSelectedEditTarget('page')
    createPage()
  }

  const handlePageRename = (pageId: (typeof project.source.pages)[number]['id'], name: string) => {
    renamePage(pageId, name)
  }

  const handlePageDelete = (pageId: (typeof project.source.pages)[number]['id']) => {
    deletePage(pageId)
  }

  const handleStartPageSet = (pageId: (typeof project.source.pages)[number]['id']) => {
    setStartPage(pageId)
  }

  // For now, we always enable undo/redo buttons
  // CodeMirror's history system handles the actual state
  // TODO: Track CodeMirror's history state for precise button enabling
  const canUndo = true
  const canRedo = true

  return (
    <Box as="section" className="editor-pane">
      <Box
        data-name="Code Header"
        borderWidth="0 1 1 0"
        borderColor="neutral-subtleA"
        paddingInline="space-20"
        paddingBlock="space-8"
      >
        <HStack justify="space-between" align="center" gap="space-16">
          <HStack className="editor-pane__header-group" gap="space-12" align="center">
            {multiPageEnabled && (
              <Button
                variant="tertiary"
                data-color="neutral"
                size="small"
                onClick={togglePagePanel}
              >
                {pagePanelOpen ? 'Hide pages' : 'Show pages'}
              </Button>
            )}
            <EditorTabs activeTab={currentTab} onTabChange={handleTabChange} />
          </HStack>
          <EditorToolbar
            canUndo={canUndo}
            canRedo={canRedo}
            onAddComponent={() => toggleComponentPalette()}
            onFormat={handleFormat}
            onUndo={handleUndo}
            onRedo={handleRedo}
          />
        </HStack>
      </Box>

      <Box className="editor-pane__workspace">
        {multiPageEnabled && pagePanelOpen && (
          <PagePanel
            activePageId={project.activePageId}
            startPageId={project.source.startPageId}
            pages={project.source.pages}
            brokenNavigationPageIds={pageReferenceAnalysis.brokenNavigationPageIds}
            deletePageImpacts={deletePageImpacts}
            errorPageIds={errorPageIds}
            selectedEditTarget={effectiveEditTarget}
            onAddPage={handleAddPage}
            onSelectGlobalConfig={handleGlobalConfigSelect}
            onSelectPage={handlePageSelect}
            onRenamePage={handlePageRename}
            onDeletePage={handlePageDelete}
            onSetStartPage={handleStartPageSet}
          />
        )}

        <Box
          data-name="Code editor"
          className="editor-pane__editor"
          borderWidth="0 1 0 0"
          borderColor="neutral-subtleA"
        >
          <CodeEditor
            ref={editorRef}
            key={`${effectiveEditTarget === 'global-config' ? 'global-config' : project.activePageId}-${currentTab}`}
            value={currentContent}
            onChange={handleCodeChange}
            onCursorChange={handleCursorChange}
            onFocusChange={(isCodeEditorFocused) => updateEditorState({ isCodeEditorFocused })}
            onFormat={handleFormat}
            validPageIds={multiPageEnabled ? validPageIds : undefined}
          />
        </Box>
      </Box>

      <ComponentPalette
        open={isComponentPaletteOpen}
        onInsertComponent={handleComponentInsert}
        onClose={() => closeComponentPalette()}
      />
    </Box>
  )
}
