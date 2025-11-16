import type { Project } from '@/types/project'
import type { EditorState } from '@/types/editor'
import type { PreviewState } from '@/types/preview'

// Intro content that showcases features
export const INTRO_JSX_CODE = `export default function App() {
  return (
    <BoxNew
      padding="space-16"
      background="raised"
      borderRadius="xlarge"
      borderWidth="1"
      borderColor="neutral-subtleA"
    >
      <VStack gap="space-8">
        <Heading size="large" level="1">👋 Welcome to Aksel Arcade!</Heading>
        <BodyLong>
          A browser-based React playground for Aksel Darkside components.
        </BodyLong>
        
        <VStack gap="space-4">
          <Heading size="small" level="2">✨ Features:</Heading>
          <BodyShort>• <strong>Two tabs:</strong> JSX for components, Hooks for custom logic</BodyShort>
          <BodyShort>• <strong>Live preview:</strong> See changes instantly</BodyShort>
          <BodyShort>• <strong>Component palette:</strong> Click "Add" to insert components</BodyShort>
          <BodyShort>• <strong>Format code:</strong> Prettier integration</BodyShort>
          <BodyShort>• <strong>Responsive testing:</strong> Toggle viewports</BodyShort>
          <BodyShort>• <strong>Auto-save:</strong> Your work is saved automatically</BodyShort>
        </VStack>
        
        <Alert variant="info">
          <strong>Quick tip:</strong> Delete this intro and start coding! You can always reset via Settings → Reset editor.
        </Alert>
      </VStack>
    </BoxNew>
  )
}`

export const INTRO_HOOKS_CODE = `// Define custom hooks here
// Example:
// import { useState } from 'react';
//
// export const useToggle = (initial = false) => {
//   const [value, setValue] = useState(initial);
//   const toggle = () => setValue(v => !v);
//   return [value, toggle];
// };`

export const createDefaultProject = (): Project => ({
  id: crypto.randomUUID(),
  name: 'Untitled Project',
  jsxCode: INTRO_JSX_CODE,
  hooksCode: INTRO_HOOKS_CODE,
  viewportSize: 'MD',
  panelLayout: 'editor-left',
  version: '1.0.0',
  createdAt: new Date().toISOString(),
  lastModified: new Date().toISOString(),
})

export const createDefaultEditorState = (): EditorState => ({
  activeTab: 'JSX',
  jsxCursor: { line: 0, column: 0 },
  hooksCursor: { line: 0, column: 0 },
  jsxSelection: null,
  hooksSelection: null,
  jsxHistory: { past: [], current: '', future: [] },
  hooksHistory: { past: [], current: '', future: [] },
  jsxErrors: [],
  hooksErrors: [],
})

export const createDefaultPreviewState = (): PreviewState => ({
  status: 'idle',
  transpiledCode: null,
  compileError: null,
  runtimeError: null,
  inspectEnabled: false,
  inspectedElement: null,
  currentViewport: 'MD',
  viewportWidth: 768,
  lastRenderTime: Date.now(),
  renderDuration: 0,
})
