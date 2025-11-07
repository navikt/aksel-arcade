# Data Model: Aksel Arcade

**Feature**: 1-aksel-arcade  
**Date**: 2025-11-06  
**Status**: Phase 1 Design

## Overview

This document defines the core data entities, their relationships, validation rules, and state transitions for Aksel Arcade. All entities are client-side only (no backend persistence beyond LocalStorage).

---

## Core Entities

### 1. Project

**Description**: Represents a user's prototyping session, containing all code, settings, and metadata.

**Fields**:
```typescript
interface Project {
  // Identity
  id: string;                    // UUID v4 (generated on creation)
  name: string;                  // User-editable project name
  
  // Code content
  jsxCode: string;               // JSX tab code content
  hooksCode: string;             // Hooks tab code content
  
  // UI state
  viewportSize: ViewportSize;    // Selected responsive breakpoint
  panelLayout: PanelLayout;      // Editor/preview position
  
  // Metadata
  version: string;               // Schema version (e.g., "1.0.0")
  createdAt: string;             // ISO 8601 timestamp
  lastModified: string;          // ISO 8601 timestamp
}

// Per Figma design (node 36:981) and Aksel breakpoints (https://aksel.nav.no/grunnleggende/styling/brekkpunkter)
type ViewportSize = '2XL' | 'XL' | 'LG' | 'MD' | 'SM' | 'XS';
type PanelLayout = 'editor-left' | 'editor-right';
```

**Validation Rules**:
- `name`: 1-100 characters, non-empty after trim
- `jsxCode`: Max 5MB when serialized (see size enforcement)
- `hooksCode`: Max 5MB when serialized (see size enforcement)
- `viewportSize`: Must be one of the 6 Aksel standard breakpoints (2XL/1440, XL/1280, LG/1024, MD/768, SM/480, XS/320)
- `panelLayout`: Must be one of the 2 layout options
- `version`: Semantic versioning (e.g., "1.0.0")
- `createdAt`: Valid ISO 8601 timestamp, immutable after creation
- `lastModified`: Valid ISO 8601 timestamp, updated on every change

**Size Enforcement**:
```typescript
const MAX_PROJECT_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const WARN_PROJECT_SIZE_BYTES = 4 * 1024 * 1024; // 4MB (80% threshold)

const validateProjectSize = (project: Project): ProjectSizeStatus => {
  const json = JSON.stringify(project);
  const sizeBytes = new Blob([json]).size;
  
  if (sizeBytes > MAX_PROJECT_SIZE_BYTES) {
    return { valid: false, sizeBytes, message: 'Project exceeds 5MB limit' };
  }
  
  if (sizeBytes > WARN_PROJECT_SIZE_BYTES) {
    return { valid: true, sizeBytes, warning: 'Project approaching 5MB limit' };
  }
  
  return { valid: true, sizeBytes };
};
```

**Default Values**:
```typescript
const createDefaultProject = (): Project => ({
  id: crypto.randomUUID(),
  name: 'Untitled Project',
  jsxCode: '// Start coding here\nimport { Button } from "@navikt/ds-react";\n\nexport default function App() {\n  return <Button>Hello Aksel!</Button>;\n}',
  hooksCode: '// Define custom hooks here\nimport { useState } from "react";',
  viewportSize: 'MD',  // Per Figma design: MD (768px) is default selected
  panelLayout: 'editor-left',
  version: '1.0.0',
  createdAt: new Date().toISOString(),
  lastModified: new Date().toISOString(),
});
```

**State Transitions**:
- **Create**: User opens app with no saved project → Generate default project
- **Update**: User edits code, changes viewport, renames project → Update `lastModified`
- **Save**: Auto-save after 1s debounce → Persist to LocalStorage
- **Export**: User clicks Export → Serialize to JSON file download
- **Import**: User selects JSON file → Validate schema → Replace current project
- **Restore**: User reopens app → Load from LocalStorage or create default

**Relationships**:
- Has one `EditorState` (ephemeral, not persisted)
- Has one `PreviewState` (ephemeral, not persisted)
- Contains zero or more transpilation errors (derived, not persisted)

---

### 2. EditorState

**Description**: Represents the ephemeral state of the code editor (cursor position, selection, undo history). Not persisted to LocalStorage.

**Fields**:
```typescript
interface EditorState {
  // Active context
  activeTab: EditorTab;          // Currently visible tab
  
  // Cursor state (per tab)
  jsxCursor: CursorPosition;     // Cursor in JSX tab
  hooksCursor: CursorPosition;   // Cursor in Hooks tab
  
  // Selection state (per tab)
  jsxSelection: SelectionRange | null;
  hooksSelection: SelectionRange | null;
  
  // Edit history (per tab)
  jsxHistory: HistoryStack;
  hooksHistory: HistoryStack;
  
  // Lint/error markers
  jsxErrors: LintMarker[];
  hooksErrors: LintMarker[];
}

type EditorTab = 'JSX' | 'Hooks';

interface CursorPosition {
  line: number;    // 0-indexed line number
  column: number;  // 0-indexed column number
}

interface SelectionRange {
  start: CursorPosition;
  end: CursorPosition;
}

interface HistoryStack {
  past: string[];    // Previous code states (for undo)
  current: string;   // Current code state
  future: string[];  // Undone states (for redo)
}

interface LintMarker {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}
```

**Validation Rules**:
- `activeTab`: Must be 'JSX' or 'Hooks'
- `line` and `column`: Must be non-negative integers
- `past` and `future`: Max 50 history entries each (to prevent memory leaks)

**Default Values**:
```typescript
const createDefaultEditorState = (): EditorState => ({
  activeTab: 'JSX',
  jsxCursor: { line: 0, column: 0 },
  hooksCursor: { line: 0, column: 0 },
  jsxSelection: null,
  hooksSelection: null,
  jsxHistory: { past: [], current: '', future: [] },
  hooksHistory: { past: [], current: '', future: [] },
  jsxErrors: [],
  hooksErrors: [],
});
```

**State Transitions**:
- **Type code**: Update current tab's code → Push to history.past → Clear history.future
- **Undo**: Pop from history.past → Update current → Push to history.future
- **Redo**: Pop from history.future → Update current → Push to history.past
- **Switch tabs**: Save cursor/selection for old tab → Load cursor/selection for new tab
- **Lint**: Run linter → Update appropriate `*Errors` array

---

### 3. PreviewState

**Description**: Represents the ephemeral state of the live preview pane. Not persisted to LocalStorage.

**Fields**:
```typescript
interface PreviewState {
  // Rendering state
  status: PreviewStatus;
  transpiledCode: string | null;    // Compiled JS code for iframe
  
  // Error state
  compileError: CompileError | null;
  runtimeError: RuntimeError | null;
  
  // Inspect mode
  inspectEnabled: boolean;
  inspectedElement: InspectionData | null;
  
  // Viewport
  currentViewport: ViewportSize;
  viewportWidth: number;            // Actual pixel width for current viewport
  
  // Performance tracking
  lastRenderTime: number;           // Timestamp of last successful render
  renderDuration: number;           // Time taken for last render (ms)
}

type PreviewStatus = 'idle' | 'transpiling' | 'rendering' | 'error';

interface CompileError {
  message: string;
  line: number | null;
  column: number | null;
  stack: string | null;
}

interface RuntimeError {
  message: string;
  componentStack: string | null;
  stack: string;
}
```

**Validation Rules**:
- `status`: Must be one of 4 defined states
- `viewportWidth`: Must be positive integer matching viewport size
- `renderDuration`: Must be non-negative number

**Default Values**:
```typescript
const createDefaultPreviewState = (): PreviewState => ({
  status: 'idle',
  transpiledCode: null,
  compileError: null,
  runtimeError: null,
  inspectEnabled: false,
  inspectedElement: null,
  currentViewport: 'LG',
  viewportWidth: 1024,
  lastRenderTime: Date.now(),
  renderDuration: 0,
});
```

**State Transitions**:
- **Code change**: status: 'idle' → 'transpiling' → 'rendering' → 'idle' (success) or 'error' (failure)
- **Compile error**: status → 'error', set `compileError`, clear `transpiledCode`
- **Runtime error**: status → 'error', set `runtimeError`, keep `transpiledCode`
- **Toggle inspect**: `inspectEnabled` flips, clear `inspectedElement`
- **Hover element (inspect on)**: Update `inspectedElement` with element data
- **Change viewport**: Update `currentViewport` and `viewportWidth`, trigger re-render

---

### 4. InspectionData

**Description**: Represents information about an inspected element in the preview. Displayed in a popover during inspect mode.

**Fields**:
```typescript
interface InspectionData {
  // Element identity
  componentName: string;         // React component name (e.g., "Button")
  tagName: string;               // HTML tag name (e.g., "button")
  cssClass: string;              // CSS class (e.g., "button.aksel-button")
  
  // Props (React component props)
  props: Record<string, unknown>;
  
  // Computed styles
  color: string;                 // Computed color (e.g., "rgb(255, 255, 255)")
  fontFamily: string;            // Font family (e.g., "Inter, sans-serif")
  fontSize: string;              // Font size (e.g., "16px")
  margin: string;                // Margin shorthand (e.g., "16px 0px")
  padding: string;               // Padding shorthand (e.g., "8px 16px")
  
  // Position (for highlight border)
  boundingRect: DOMRect;         // Element bounding box
}
```

**Validation Rules**:
- `componentName`: Non-empty string (fallback to tagName if unknown)
- `tagName`: Valid HTML tag name (lowercase)
- `cssClass`: May be empty string if no class
- `props`: Must be serializable (no functions, circular refs)
- `color`, `fontFamily`, `fontSize`, `margin`, `padding`: Non-empty strings
- `boundingRect`: Valid DOMRect with positive width/height

**Data Extraction** (in sandbox iframe):
```typescript
const extractInspectionData = (element: HTMLElement): InspectionData => {
  const computedStyle = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  
  // Try to find React component name from Fiber
  const fiberKey = Object.keys(element).find(key => key.startsWith('__reactFiber'));
  const fiber = fiberKey ? (element as any)[fiberKey] : null;
  const componentName = fiber?.type?.name || element.tagName.toLowerCase();
  
  // Extract React props
  const propsKey = Object.keys(element).find(key => key.startsWith('__reactProps'));
  const props = propsKey ? (element as any)[propsKey] : {};
  
  return {
    componentName,
    tagName: element.tagName.toLowerCase(),
    cssClass: element.className,
    props: sanitizeProps(props),
    color: computedStyle.color,
    fontFamily: computedStyle.fontFamily,
    fontSize: computedStyle.fontSize,
    margin: computedStyle.margin,
    padding: computedStyle.padding,
    boundingRect: rect,
  };
};

// Remove non-serializable props (functions, circular refs)
const sanitizeProps = (props: any): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value !== 'function' && key !== 'children') {
      try {
        JSON.stringify(value); // Test serializability
        sanitized[key] = value;
      } catch {
        sanitized[key] = '[Non-serializable]';
      }
    }
  }
  return sanitized;
};
```

---

### 5. ComponentSnippet

**Description**: Represents a reusable Aksel component template for the "Add component" palette.

**Fields**:
```typescript
interface ComponentSnippet {
  id: string;                    // Unique identifier (e.g., "button")
  name: string;                  // Display name (e.g., "Button")
  category: SnippetCategory;     // Layout or Component
  keywords: string[];            // Search terms (e.g., ["button", "click"])
  template: string;              // JSX snippet with placeholders
  description: string;           // Short description for palette
  import: string;                // Import statement (e.g., "import { Button } from '@navikt/ds-react';")
}

type SnippetCategory = 'layout' | 'component';
```

**Validation Rules**:
- `id`: Lowercase alphanumeric + hyphens, unique within registry
- `name`: Non-empty, human-readable
- `category`: Must be 'layout' or 'component'
- `keywords`: Non-empty array, all lowercase
- `template`: Valid JSX string with optional `${N:placeholder}` markers
- `description`: 1-100 characters
- `import`: Valid ES6 import statement

**Example Snippets**:
```typescript
export const AKSEL_SNIPPETS: ComponentSnippet[] = [
  {
    id: 'button',
    name: 'Button',
    category: 'component',
    keywords: ['button', 'click', 'action', 'submit'],
    template: '<Button variant="primary" size="medium">${1:Button text}</Button>',
    description: 'Action button with variants',
    import: "import { Button } from '@navikt/ds-react';",
  },
  {
    id: 'box',
    name: 'Box',
    category: 'layout',
    keywords: ['box', 'container', 'layout', 'padding'],
    template: '<Box padding="4">\n  ${1:Content}\n</Box>',
    description: 'Layout container with spacing',
    import: "import { Box } from '@navikt/ds-react';",
  },
  {
    id: 'stack',
    name: 'Stack',
    category: 'layout',
    keywords: ['stack', 'vertical', 'column', 'layout'],
    template: '<Stack gap="4">\n  ${1:Content}\n</Stack>',
    description: 'Vertical layout stack',
    import: "import { Stack } from '@navikt/ds-react';",
  },
  {
    id: 'grid',
    name: 'Grid',
    category: 'layout',
    keywords: ['grid', 'layout', 'columns'],
    template: '<Grid columns={{ xs: 1, sm: 2, md: 3 }}>\n  ${1:Content}\n</Grid>',
    description: 'Responsive grid layout',
    import: "import { Grid } from '@navikt/ds-react';",
  },
  {
    id: 'textfield',
    name: 'TextField',
    category: 'component',
    keywords: ['input', 'text', 'form', 'field'],
    template: '<TextField label="${1:Label}" />',
    description: 'Text input field',
    import: "import { TextField } from '@navikt/ds-react';",
  },
  {
    id: 'select',
    name: 'Select',
    category: 'component',
    keywords: ['select', 'dropdown', 'options', 'form'],
    template: '<Select label="${1:Label}">\n  <option value="">${2:Option 1}</option>\n</Select>',
    description: 'Dropdown select menu',
    import: "import { Select } from '@navikt/ds-react';",
  },
  {
    id: 'checkbox',
    name: 'Checkbox',
    category: 'component',
    keywords: ['checkbox', 'check', 'toggle', 'form'],
    template: '<Checkbox>${1:Label}</Checkbox>',
    description: 'Checkbox input',
    import: "import { Checkbox } from '@navikt/ds-react';",
  },
  {
    id: 'radio',
    name: 'Radio',
    category: 'component',
    keywords: ['radio', 'option', 'choice', 'form'],
    template: '<Radio name="${1:group}">${2:Label}</Radio>',
    description: 'Radio button input',
    import: "import { Radio } from '@navikt/ds-react';",
  },
];
```

**Search Algorithm**:
```typescript
const searchSnippets = (query: string, snippets: ComponentSnippet[]): ComponentSnippet[] => {
  const lowerQuery = query.toLowerCase().trim();
  
  if (!lowerQuery) return snippets; // Return all if no query
  
  return snippets.filter(snippet => {
    // Match on name (exact or prefix)
    if (snippet.name.toLowerCase().includes(lowerQuery)) return true;
    
    // Match on keywords
    if (snippet.keywords.some(kw => kw.includes(lowerQuery))) return true;
    
    return false;
  }).sort((a, b) => {
    // Prioritize exact name matches
    const aNameMatch = a.name.toLowerCase().startsWith(lowerQuery);
    const bNameMatch = b.name.toLowerCase().startsWith(lowerQuery);
    if (aNameMatch && !bNameMatch) return -1;
    if (!aNameMatch && bNameMatch) return 1;
    
    // Otherwise alphabetical
    return a.name.localeCompare(b.name);
  });
};
```

---

### 6. ViewportDefinition

**Description**: Defines Aksel standard responsive breakpoints per Figma design (node 36:981) and Aksel documentation (https://aksel.nav.no/grunnleggende/styling/brekkpunkter).

**Fields**:
```typescript
interface ViewportDefinition {
  id: ViewportSize;
  name: string;           // Display name (e.g., "Mobile")
  width: number;          // Pixel width
  label: string;          // Button label (e.g., "SM")
}
```

**Aksel Standard Breakpoints** (from Figma design node 36:981):
```typescript
export const VIEWPORTS: ViewportDefinition[] = [
  { id: '2XL', name: 'Desktop Extra Large', width: 1440, label: '2XL' },
  { id: 'XL', name: 'Desktop Large', width: 1280, label: 'XL' },
  { id: 'LG', name: 'Tablet Landscape', width: 1024, label: 'LG' },
  { id: 'MD', name: 'Tablet Portrait', width: 768, label: 'MD' },
  { id: 'SM', name: 'Mobile Large', width: 480, label: 'SM' },
  { id: 'XS', name: 'Mobile Small', width: 320, label: 'XS' },
];

// Helper to get viewport width by ID
export const getViewportWidth = (id: ViewportSize): number => {
  const viewport = VIEWPORTS.find(v => v.id === id);
  return viewport?.width ?? 768; // Default to MD (768px) if unknown
};
```

**Reference**: Aksel breakpoint documentation at https://aksel.nav.no/grunnleggende/styling/brekkpunkter

---

## Derived Entities (Non-Persisted)

### 7. TranspileResult

**Description**: Result of Babel Standalone transpilation. Ephemeral, used to communicate between transpiler and preview.

```typescript
interface TranspileResult {
  success: boolean;
  code: string | null;       // Transpiled JavaScript (if success)
  error: CompileError | null; // Error details (if failure)
}
```

---

### 8. SandboxMessage

**Description**: Type-safe messages exchanged between main app and sandboxed iframe via postMessage.

**Main → Sandbox**:
```typescript
type MainToSandboxMessage =
  | { type: 'EXECUTE_CODE'; payload: { jsxCode: string; hooksCode: string } }
  | { type: 'UPDATE_VIEWPORT'; payload: { width: number } }
  | { type: 'TOGGLE_INSPECT'; payload: { enabled: boolean } }
  | { type: 'GET_INSPECTION_DATA'; payload: { x: number; y: number } };
```

**Sandbox → Main**:
```typescript
type SandboxToMainMessage =
  | { type: 'RENDER_SUCCESS' }
  | { type: 'COMPILE_ERROR'; payload: CompileError }
  | { type: 'RUNTIME_ERROR'; payload: RuntimeError }
  | { type: 'INSPECTION_DATA'; payload: InspectionData | null }
  | { type: 'CONSOLE_LOG'; payload: { level: 'log' | 'warn' | 'error'; args: any[] } };
```

**Validation**:
```typescript
const isMainToSandboxMessage = (msg: any): msg is MainToSandboxMessage => {
  return msg && typeof msg === 'object' && 'type' in msg && 'payload' in msg;
};

const isSandboxToMainMessage = (msg: any): msg is SandboxToMainMessage => {
  return msg && typeof msg === 'object' && 'type' in msg;
};
```

---

## Entity Relationships

```
Project (1)
  ├── has-one EditorState (ephemeral, not persisted)
  ├── has-one PreviewState (ephemeral, not persisted)
  └── persisted-in LocalStorage

EditorState (1)
  ├── contains-many LintMarker (0..*)
  └── contains HistoryStack per tab (2)

PreviewState (1)
  ├── has-zero-or-one CompileError (0..1)
  ├── has-zero-or-one RuntimeError (0..1)
  └── has-zero-or-one InspectionData (0..1)

ComponentSnippet (*)
  └── registered-in ComponentLibrary (singleton)

ViewportDefinition (6)
  └── registered-in VIEWPORTS constant
```

---

## State Management Strategy

### Global State (React Context / Zustand)

```typescript
interface AppState {
  // Persisted state
  project: Project;
  
  // Ephemeral state
  editorState: EditorState;
  previewState: PreviewState;
  
  // UI state
  isComponentPaletteOpen: boolean;
  isSettingsOpen: boolean;
  
  // Actions
  updateProject: (updates: Partial<Project>) => void;
  saveProject: () => void;
  loadProject: (project: Project) => void;
  exportProject: () => void;
  importProject: (file: File) => Promise<void>;
  
  updateEditorState: (updates: Partial<EditorState>) => void;
  updatePreviewState: (updates: Partial<PreviewState>) => void;
  
  insertSnippet: (snippet: ComponentSnippet) => void;
  formatCode: () => void;
  undo: () => void;
  redo: () => void;
}
```

### Auto-Save Hook

```typescript
const useAutoSave = (project: Project) => {
  const timeoutRef = useRef<number>();
  
  useEffect(() => {
    clearTimeout(timeoutRef.current);
    
    // Debounce save by 1 second
    timeoutRef.current = setTimeout(() => {
      try {
        const validation = validateProjectSize(project);
        if (!validation.valid) {
          console.error('Cannot save:', validation.message);
          return;
        }
        
        if (validation.warning) {
          console.warn(validation.warning);
        }
        
        localStorage.setItem('aksel-arcade:project', JSON.stringify(project));
        console.log('Project auto-saved');
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, 1000);
    
    return () => clearTimeout(timeoutRef.current);
  }, [project]);
};
```

---

## Schema Versioning

**Current Version**: 1.0.0

**Migration Strategy**:
```typescript
const migrateProject = (stored: any): Project => {
  const version = stored.version || '0.0.0';
  
  if (version === '1.0.0') {
    return stored as Project; // No migration needed
  }
  
  // Future migrations
  // if (version < '1.1.0') { ... }
  
  throw new Error(`Unsupported schema version: ${version}`);
};

const loadProject = (): Project => {
  try {
    const json = localStorage.getItem('aksel-arcade:project');
    if (!json) return createDefaultProject();
    
    const stored = JSON.parse(json);
    return migrateProject(stored);
  } catch (error) {
    console.error('Failed to load project:', error);
    return createDefaultProject();
  }
};
```

---

## Validation Library (Optional)

For runtime type safety, consider using Zod:

```typescript
import { z } from 'zod';

const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  jsxCode: z.string(),
  hooksCode: z.string(),
  viewportSize: z.enum(['2XL', 'XL', 'LG', 'MD', 'SM', 'XS']),
  panelLayout: z.enum(['editor-left', 'editor-right']),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  createdAt: z.string().datetime(),
  lastModified: z.string().datetime(),
});

const validateProject = (data: unknown): Project => {
  return ProjectSchema.parse(data);
};
```

---

**Data Model Status**: ✅ Complete - All entities defined with validation rules and relationships
