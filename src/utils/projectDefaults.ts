import type { Project } from '@/types/project'
import type { EditorState } from '@/types/editor'
import type { PreviewState } from '@/types/preview'

export const createDefaultProject = (): Project => ({
  id: crypto.randomUUID(),
  name: 'Untitled Project',
  jsxCode: 'export default function App() {\n  return (\n    <Alert variant="info">\n      Welcome to AkselArcade! This Alert component is styled with Aksel Darkside.\n    </Alert>\n  )\n}',
  hooksCode: '// Define custom hooks here\n// Example:\n// export const useCounter = () => {\n//   const [count, setCount] = useState(0);\n//   return { count, increment: () => setCount(c => c + 1) };\n// };',
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
