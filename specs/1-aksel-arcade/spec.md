# Feature Specification: Aksel Arcade - Browser-Based React Playground

**Feature Branch**: `1-aksel-arcade`  
**Created**: November 6, 2025  
**Status**: Draft  
**Input**: User description: "Build Aksel Arcade: a browser-based React playground that lets designers and developers compose UIs using the Aksel Darkside design system without setting up a project. It includes a Codemirror code editor with tabs: JSX & Hooks, an in-page live viewer with responsive modes, an inspect for elements (with name + props), and JSON file import/export of the project."

## UI Design Contract

**Figma Design URL**: https://www.figma.com/design/aPNvetW8NkJI39C3XN9rks/Aksel-Arcade?node-id=4-828&m=dev

**⚠️ IMPORTANT - UI Contract Rules**:
1. **The Figma design is the source of truth** for all UI implementation
2. When this specification is referenced for implementation, the Figma file MUST be open in the Figma desktop app
3. If the Figma file is not accessible via MCP, **STOP and ask the user** to open the file before proceeding
4. Any conflict between text descriptions and Figma design should be resolved in favor of the Figma design
5. Use Figma MCP tools to extract design context, component structure, and styling details during implementation

**Node ID**: `4-828` (Main design frame)

## User Scenarios & Testing

### User Story 1 - Quick UI Prototyping (Priority: P1)

A designer or developer wants to quickly prototype a user interface using the Aksel Darkside design system without setting up a local development environment. They open Aksel Arcade in their browser, select components from the component library, write JSX code, and immediately see their UI rendered with proper Darkside styling.

**Why this priority**: This is the core value proposition - enabling rapid prototyping without setup. This single capability delivers immediate value and forms the foundation for all other features.

**Independent Test**: Can be fully tested by opening the application, writing basic JSX code using Aksel components, and verifying that the preview updates in real-time with proper Darkside theme styling.

**Acceptance Scenarios**:

1. **Given** a user opens Aksel Arcade for the first time, **When** they view the interface, **Then** they see a split-pane layout with a code editor on the left and an empty preview pane on the right, with the Darkside theme applied
2. **Given** a user is in the JSX editor tab, **When** they type `<Button variant="primary">Click me</Button>`, **Then** the preview pane updates within 500ms showing a styled Aksel Button component with the Darkside theme
3. **Given** a user clicks the "Add component" button, **When** they select "Button" from the component palette, **Then** a Button snippet is inserted at their cursor position with sensible default props
4. **Given** a user has written JSX code, **When** the code contains syntax errors, **Then** the editor shows inline error indicators and an error overlay appears in the preview pane with a clear error message

---

### User Story 2 - Responsive Design Testing (Priority: P2)

A designer wants to test how their UI layout adapts to different screen sizes using standard breakpoints. They prototype their interface and use viewport toggle buttons to switch between mobile, tablet, and desktop views to verify responsive behavior.

**Why this priority**: Responsive design is critical for modern web applications, but this requires the basic editor functionality (P1) to be in place first.

**Independent Test**: Can be fully tested by creating a simple responsive layout, clicking viewport size buttons (XS, SM, MD, LG, XL, 2XL), and verifying that the preview pane resizes according to Aksel breakpoints.

**Acceptance Scenarios**:

1. **Given** a user has created a UI in the editor, **When** they click the "SM (480px)" viewport button, **Then** the preview pane resizes to 480px width and the UI adapts accordingly
2. **Given** a user is viewing their UI at MD breakpoint, **When** they click "XS (320px)", **Then** the preview transitions smoothly to 320px width
3. **Given** a user switches between viewport sizes, **When** they return to the editor, **Then** their code remains unchanged and the preview maintains the selected viewport size

---

### User Story 3 - Component Inspection (Priority: P2)

A developer wants to understand the structure of their rendered UI by inspecting elements to see component names, applied props, and computed styles (colors, fonts, spacing). They enable inspect mode, hover over elements, and see detailed information in a popover similar to browser DevTools.

**Why this priority**: This debugging capability significantly enhances the prototyping workflow, but requires the basic rendering functionality (P1) to exist first.

**Independent Test**: Can be fully tested by rendering a few components, toggling inspect mode on, hovering over elements, and verifying that a popover displays the component name, CSS class, props, colors, fonts, margins, and padding.

**Acceptance Scenarios**:

1. **Given** a user has rendered components in the preview, **When** they enable inspect mode and hover over a Button, **Then** a popover appears showing "Button", the CSS class (e.g., "button.aksel-button"), active props (variant, size), and computed styles (color, font, margin, padding)
2. **Given** a user is in inspect mode, **When** they hover over different elements, **Then** each element displays a highlight border and the popover updates with that element's information
3. **Given** a user is inspecting elements, **When** they disable inspect mode, **Then** hover interactions return to normal and popovers no longer appear

---

### User Story 4 - State Management with Hooks (Priority: P3)

A developer wants to add interactive behavior to their prototype by managing state with React hooks. They create custom hooks in a separate "Hooks" tab and import them into their JSX code to handle form state, counters, toggles, or other stateful logic.

**Why this priority**: While valuable for advanced prototyping, stateful interactions are not required for basic UI composition and layout testing.

**Independent Test**: Can be fully tested by creating a custom hook (e.g., `useCounter`) in the Hooks tab, importing it in the JSX tab, using it in a component, and verifying that state updates correctly in the live preview.

**Acceptance Scenarios**:

1. **Given** a user is in the Hooks tab, **When** they write `export const useCounter = () => { const [count, setCount] = useState(0); return { count, increment: () => setCount(c => c + 1) }; }`, **Then** the code is saved and ready for import
2. **Given** a user has defined a hook in the Hooks tab, **When** they switch to the JSX tab and write `import { useCounter } from './hooks'`, **Then** the import resolves correctly in the runtime environment
3. **Given** a user imports and uses `useCounter` in a Button's onClick handler, **When** they click the button in the preview, **Then** the counter increments and the UI updates to reflect the new count

---

### User Story 5 - Project Persistence and Sharing (Priority: P3)

A user wants to save their prototype work and share it with team members. They export their project as a JSON file, send it to a colleague, who then imports it into their own Aksel Arcade instance to view and edit the same prototype.

**Why this priority**: Persistence and sharing enable collaboration but are not required for individual prototyping sessions. Auto-save to localStorage provides basic safety net.

**Independent Test**: Can be fully tested by creating a project with multiple components and hooks, exporting to JSON, clearing the workspace, importing the JSON file, and verifying that all code and project metadata is restored correctly.

**Acceptance Scenarios**:

1. **Given** a user has created a project with JSX and Hooks code, **When** they click the "Export" button, **Then** a JSON file downloads containing the project name, JSX code, Hooks code, and viewport settings
2. **Given** a user has an exported JSON file, **When** they click "Import" and select the file, **Then** the project loads with all code, project name, and settings restored
3. **Given** a user makes changes to their code, **When** they wait 1 second, **Then** the project auto-saves to localStorage
4. **Given** a user closes and reopens their browser, **When** they return to Aksel Arcade, **Then** their last project state is automatically restored from localStorage

---

### User Story 6 - Code Formatting and Editor Experience (Priority: P2)

A developer wants to write clean, well-formatted code with minimal effort. They use autocompletion for Aksel components and props, format their code with Prettier on demand, and undo/redo changes when experimenting with different approaches.

**Why this priority**: Quality-of-life features that significantly improve the editing experience, but the core prototyping functionality must exist first.

**Independent Test**: Can be fully tested by typing code with intentionally poor formatting, pressing the Format button (or Ctrl/Cmd+S), and verifying that Prettier reformats the code. Also test autocomplete by typing `<But` and verifying that "Button" appears as a suggestion.

**Acceptance Scenarios**:

1. **Given** a user types `<But` in the editor, **When** they pause typing, **Then** an autocomplete dropdown appears showing Aksel components starting with "But" (Button, etc.)
2. **Given** a user types `<Button var`, **When** they pause, **Then** autocomplete suggests the "variant" prop with available values (primary, secondary, tertiary, danger)
3. **Given** a user has written poorly formatted code, **When** they click the "Format" button or press Cmd+S (Mac) / Ctrl+S (Windows), **Then** Prettier reformats the code with consistent indentation and spacing
4. **Given** a user has made changes to their code, **When** they click the "Undo" button or press Cmd+Z / Ctrl+Z, **Then** the last change is reverted
5. **Given** a user has undone changes, **When** they click "Redo" or press Cmd+Shift+Z / Ctrl+Y, **Then** the undone change is reapplied

---

### Edge Cases

- What happens when a user writes JSX code that throws a runtime error (e.g., accessing undefined props)? The preview pane should display a non-blocking error overlay with the error message and stack trace, without crashing the entire application.
- How does the system handle very large code files (e.g., 10,000+ lines)? The editor should debounce preview updates and consider implementing virtual scrolling for performance.
- What happens when a user tries to import an invalid or corrupted JSON file? The system should validate the JSON structure, show a clear error message, and leave the current project unchanged.
- How does the system behave when the user writes code that attempts to access `window.top`, `localStorage`, or make network requests from within the sandboxed iframe? The sandbox should block these attempts and optionally log security warnings.
- What happens when a user resizes the split pane to extremely narrow widths? The UI should enforce minimum widths for both editor and preview panes to maintain usability.
- How does the system handle rapid viewport switching (clicking multiple viewport buttons in quick succession)? The preview should debounce resize operations to prevent performance issues.
- What happens when a user has unsaved changes and tries to import a new project? The system should prompt for confirmation to prevent accidental data loss (unless auto-save has already persisted changes).
- How does inspect mode handle overlapping elements or deeply nested components? The system should show a hierarchy or allow drilling down through layers.
- What happens when a user tries to use Aksel components that haven't been preloaded? The system should show a clear error message indicating which package needs to be configured.

## Requirements

### UI Implementation Requirements

- **UI-001**: All UI implementation MUST follow the Figma design specification at node-id=4-828
- **UI-002**: Before implementation, developers MUST verify the Figma file is open and accessible via Figma MCP
- **UI-003**: Layout, spacing, colors, typography, and component arrangement MUST match the Figma design exactly
- **UI-004**: Any ambiguity between specification text and Figma design MUST be resolved by consulting the Figma design as the authoritative source

### Functional Requirements

- **FR-001**: System MUST run entirely in the browser without requiring a backend server or build process
- **FR-002**: System MUST preload Aksel Darkside design system tokens and components, specifically `@navikt/ds-css/darkside` (or equivalent package - confirm exact package name) and the Aksel tokens package
- **FR-003**: System MUST initialize the Darkside theme via Aksel's ThemeProvider for all rendered components
- **FR-004**: System MUST provide a CodeMirror-based code editor with two tabs: "JSX" (default) for UI code and "Hooks" for shared state/logic
- **FR-005**: System MUST support importing hooks from the Hooks tab into the JSX tab using `import { hookName } from './hooks'` syntax
- **FR-006**: System MUST provide a toolbar in the editor with "Add component", "Format", "Undo", and "Redo" buttons
- **FR-007**: System MUST implement an "Add component" feature that opens a searchable, Command Palette-style modal with toggleable Layout and Components panels showing available Aksel components
- **FR-008**: When a user selects a component from the "Add component" palette, the system MUST insert a snippet with sensible default props at the current cursor position in the active editor tab
- **FR-009**: System MUST provide autocomplete for Aksel component names and their props, including suggested values for enumerated props (e.g., variant, size)
- **FR-010**: System MUST provide live linting feedback in the editor, showing syntax errors and warnings inline
- **FR-011**: System MUST integrate Prettier for code formatting, triggered by a toolbar button or keyboard shortcut (Ctrl/Cmd+S)
- **FR-012**: System MUST provide a live preview pane that reflects code changes in real-time with a maximum 500ms debounce delay
- **FR-013**: System MUST provide viewport toggle buttons for Aksel breakpoints: 2XL (1440px), XL (1280px), LG (1024px), MD (768px), SM (480px), XS (320px)
- **FR-014**: System MUST implement an inspect mode that, when enabled, shows a highlight border and popover on hover containing: component/element name, CSS class, active props, computed color, font, margin, and padding
- **FR-015**: System MUST allow users to edit the project name in the application header
- **FR-016**: System MUST provide Import/Export functionality for project JSON files containing project name, JSX code, Hooks code, and viewport settings
- **FR-017**: System MUST auto-save the current project state to localStorage with a 1-second debounce after any code change
- **FR-018**: System MUST restore the last project state from localStorage when the application loads
- **FR-019**: System MUST provide a settings menu with an option to switch panel sides (swap editor and preview positions)
- **FR-020**: System MUST evaluate user code in a sandboxed iframe using an in-browser transpiler (Babel Standalone or Sucrase)
- **FR-021**: System MUST communicate between the main application and the sandboxed iframe using postMessage API
- **FR-022**: System MUST block access to `window.top`, untrusted `localStorage` access, network requests, and `eval()` within the sandboxed iframe
- **FR-023**: System MUST display compile errors and runtime errors in a non-blocking overlay within the preview pane
- **FR-024**: System MUST implement a resizable split-pane between the editor and preview, allowing users to adjust the width allocation
- **FR-025**: System MUST apply the Aksel Darkside theme to the entire application UI (editor, toolbar, preview chrome)
- **FR-026**: System MUST integrate Aksel Stylelint (`@navikt/aksel-stylelint`) for style-specific linting feedback
- **FR-027**: System MUST display the Aksel Arcade logo and editable project name in the header
- **FR-028**: System MUST provide keyboard shortcuts for common actions (Undo: Cmd/Ctrl+Z, Redo: Cmd/Ctrl+Shift+Z / Ctrl+Y, Format: Cmd/Ctrl+S)

### Key Entities

- **Project**: Represents a user's prototyping session, containing a name (default: "Untitled Project"), JSX code (string), Hooks code (string), selected viewport size, editor/preview panel positions, and last modified timestamp
- **Component Snippet**: Represents a reusable Aksel component template with a name, category (Layout or Component), search keywords, and default JSX template with props
- **Editor State**: Represents the current state of the code editor, including active tab (JSX or Hooks), cursor position, selection range, undo/redo history stack, and lint/error markers
- **Preview State**: Represents the state of the live preview, including selected viewport size, inspect mode enabled/disabled, rendered component tree, current errors/warnings, and scroll position
- **Inspection Data**: Represents information about an inspected element, including component name, CSS class, active props (key-value pairs), computed styles (color, font-family, font-size, margin, padding)

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can create and view a basic Aksel component (e.g., Button) in the preview pane within 30 seconds of opening the application
- **SC-002**: Code changes in the editor appear in the preview pane within 500ms for files under 1000 lines
- **SC-003**: Users can discover and insert any of the preloaded Aksel components using the "Add component" palette in under 10 seconds
- **SC-004**: Users can successfully export and re-import a project, with all code and settings restored accurately, in under 15 seconds
- **SC-005**: Users can switch between all 6 viewport sizes (XS to 2XL) with the preview resizing smoothly within 300ms per transition
- **SC-006**: Users can successfully inspect at least 5 different elements in a single session, with accurate component names, props, and computed styles displayed
- **SC-007**: The application remains responsive and functional with JSX files up to 5,000 lines without perceivable lag (< 100ms input latency)
- **SC-008**: Code formatting with Prettier completes within 1 second for files up to 2,000 lines
- **SC-009**: Autocomplete suggestions appear within 200ms of typing a component name or prop
- **SC-010**: Security sandbox successfully blocks unauthorized access attempts (window.top, localStorage, network requests) 100% of the time
- **SC-011**: Error messages in the preview overlay are clear enough that 90% of users can identify and fix syntax errors without external help
- **SC-012**: Projects persist in localStorage and restore correctly across browser sessions with 100% accuracy for projects under 10MB
- **SC-013**: Users can create a working counter component using custom hooks (from Hooks tab) and verify state updates in the preview within 2 minutes

### Assumptions

- **The Figma design file (https://www.figma.com/design/aPNvetW8NkJI39C3XN9rks/Aksel-Arcade?node-id=4-828&m=dev) is the definitive UI contract and takes absolute precedence over any text descriptions in this specification**
- **Implementation requires the Figma desktop app to be open with this file loaded to enable Figma MCP access**
- The exact npm packages for Aksel Darkside components and tokens will be confirmed during implementation (currently assumed to be `@navikt/ds-css/darkside` and a separate tokens package)
- Users have modern browsers with support for ES6+, localStorage, postMessage, and iframe sandboxing (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Users understand basic React and JSX syntax; the application does not provide React tutorials
- Component snippets will use TypeScript-compatible JSX where applicable
- The sandboxed iframe will have sufficient permissions to render React components but not access sensitive browser APIs
- Prettier configuration will follow standard React/JSX conventions unless Aksel provides specific style guidelines
- Aksel Stylelint rules are available via `@navikt/aksel-stylelint` package
- The application will be served over HTTPS in production to ensure Content Security Policy compatibility
- Users expect persistence across sessions but understand that localStorage has storage limits (typically 5-10MB)
- The "Add component" palette will be populated based on a curated list of commonly used Aksel components, not the entire component library automatically
- Inspect mode will display CSS class names and computed styles as they exist in the DOM, which may include Aksel's internal class naming conventions
