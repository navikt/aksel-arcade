# Figma Design Extraction - Aksel Arcade

**Extracted**: November 6, 2025  
**Figma File**: https://www.figma.com/design/aPNvetW8NkJI39C3XN9rks/Aksel-Arcade?node-id=4-828&m=dev  
**Node ID**: 4-828 (Root: "Aksel Arcade")

---

## Design Overview

The Figma design provides the complete UI specification for Aksel Arcade, a browser-based React playground featuring:

- **Header**: Logo, project name input, action buttons (Export JSON, Import JSON, Settings)
- **Body Split Layout**: 
  - Left: Live preview pane with viewport controls (Full/1440/1024/480)
  - Right: Code editor with JSX/Hook tabs, Format/Add buttons, line numbers
- **Preview**: Centered viewport with responsive frame, sunken background
- **Code Editor**: Line-numbered code display with syntax highlighting placeholder

---

## Layout Structure

### Root Container
```
data-node-id="4:828"
className="bg-[var(--ax-bg-default,#ffffff)] content-stretch flex flex-col items-start relative size-full"
```

### Header (Node 4:10)
```
border-[0px_0px_1px] border-[var(--ax-border-neutral-subtleA,rgba(0,22,48,0.19))]
padding: 8px 20px (--ax-space-8, --ax-space-20)
layout: flex items-center justify-between
```

**Left Group (Node 23:66)**:
- Aksel Logo Mark (24×24px, node 2:68) - SVG: `imgAkselLogoMark`
- Title "Aksel Arcade" (font: Source Sans 3 SemiBold, 24px/32px, weight 650, tracking -0.048px, color: `--ax-text-brand-blue-subtle`)
- Project Name Input: "Skriv navn..." (font: Source Sans 3 Regular, 14px/20px, tracking 0.056px, color: `--ax-text-neutral`)
- Edit Icon Button (16.667×16.667px, padding 2px, rounded 6.667px)

**Right Group (Node 4:960)**:
- Export JSON Button (node 23:68): Icon + Text, padding 2px 8px, rounded 8px
- Import JSON Button (node 23:141): Icon + Text, padding 2px 8px, rounded 8px  
- Settings Button (node 4:961): Icon-only, padding 4px, rounded 8px

### Body Wrapper (Node 4:827)
```
layout: flex items-center
full width, no explicit height (grows to fill)
```

---

## Preview Pane (Left - Node 4:796)

### Preview Header (Node 4:777)
```
border-bottom: 1px solid var(--ax-border-neutral-subtleA)
padding: 8px 20px
layout: flex gap-12px items-center justify-end
```

**Inspection Toggle Button** (Node 25:158):
- Icon: 16.667×16.667px (pointer/cursor icon)
- Padding: 2px
- Rounded: 8px

**Viewport Toggle Group** (Node 4:555):
- Width: 213px
- Border: 1px solid `--ax-border-neutral`
- Padding: 1px
- Rounded: 8px
- Options: "Full" | "1440" | "1024" | **"480"** (selected)
- Selected state: `bg-[--ax-bg-neutral-strong-pressed]`, white text
- Font: Source Sans 3 Regular, 16px/20px, tracking 0.032px

### Preview Content Area (Node 4:795)
```
background: var(--ax-bg-sunken,#ecedef)
height: 758px
padding: 8px 0
layout: flex items-start justify-center
overflow: clip
```

**Preview Frame** (Node 4:971):
```
background: var(--ax-bg-default,#ffffff)
border: 1px solid var(--ax-border-neutral-subtleA)
max-width: 480px (matches selected viewport)
rounded: 4px (--ax-border-radius-medium)
grow: 1 (fills available height)
```

---

## Code Editor Pane (Right - Node 4:797)

### Dimensions
```
width: 888px (fixed)
height: 798px (matches preview pane total height)
border-right: 1px solid var(--ax-border-neutral-subtleA)
```

### Code Header (Node 4:798)
```
border-bottom: 1px solid var(--ax-border-neutral-subtleA)
padding: 8px 20px
layout: flex items-center justify-between
```

**Left Group (Node 25:76)** - JSX/Hook Toggle (Node 4:802):
- Width: 107px
- Border: 1px solid `--ax-border-neutral`
- Padding: 1px
- Rounded: 8px
- Options: **"JSX"** (selected) | "Hook"
- Selected state: `bg-[--ax-bg-neutral-strong-pressed]`, white text
- Font: Source Sans 3 Regular, 16px/20px, tracking 0.032px

**Right Group (Node 25:77)**:
- Format Button (Node 25:78): Icon + "Format", padding 2px 8px, rounded 8px
- Add Button (Node 25:104): Icon + "Add", padding 2px 8px, rounded 8px, **background**: `--ax-bg-neutral-strong`, **white text**

### Code Content Area (Node 4:803)
```
padding: 12px 0 (--ax-space-12)
layout: flex flex-col gap-4px
overflow: clip
grows to fill available space
```

**Code Line Structure** (Nodes 4:851-4:936):

Each line (example Node 4:851):
```
layout: flex gap-4px items-start
overflow: clip
full width
```

**Line Number Column** (32px width):
```
padding: 0 4px
layout: flex gap-8px items-center justify-end
overflow: clip
font: Source Sans 3 Regular, 16px/20px, tracking 0.032px
color: var(--ax-text-neutral-icon,#6f7785)
```

**Code Content Column** (flexible width):
```
padding: 0 4px (varies by indentation level)
layout: flex gap-8px items-center
overflow: clip
grow: 1
font: Source Sans 3 Regular, 16px/20px, tracking 0.032px
color: var(--ax-text-neutral,#202733)
```

**Indentation Levels**:
- Level 0: `px-4px` (lines 1, 16)
- Level 1: `pl-20px pr-4px` (lines 2, 4, 5, 7, 8, 15)
- Level 2: `pl-36px pr-4px` (lines 3, 6, 9, 11, 12, 14)
- Level 3: `pl-52px pr-4px` (lines 10, 13)

---

## Typography System

### Text Styles

| Style | Family | Weight | Size/Line Height | Tracking | Usage |
|-------|--------|--------|------------------|----------|-------|
| **Heading/Desktop/Medium** | Source Sans 3 SemiBold | 650 | 24px/32px | -0.048px | App title "Aksel Arcade" |
| **Detail/Regular** | Source Sans 3 Regular | 400 | 14px/20px | 0.056px | Project name placeholder |
| **BodyShort/Small Strong** | Source Sans 3 SemiBold | 600 | 16px/20px | 0.032px | Button labels |
| **BodyShort/Small** | Source Sans 3 Regular | 400 | 16px/20px | 0.032px | Toggle options, code text, line numbers (icon variant) |

### Font Loading

**Critical**: Must load **Source Sans 3** with weights:
- Regular (400)
- SemiBold (600)
- Bold (650) - for heading

---

## Color System (Aksel Darkside Tokens)

### Backgrounds
```css
--ax-bg-default: #ffffff          /* Main background */
--ax-bg-sunken: #ecedef           /* Preview area background */
--ax-bg-neutral-strong: #5d6573   /* Add button background */
--ax-bg-neutral-strong-pressed: #49515e /* Selected toggle state */
```

### Text
```css
--ax-text-neutral: #202733        /* Primary text (code, buttons) */
--ax-text-neutral-icon: #6f7785   /* Line numbers, deselected toggles */
--ax-text-neutral-contrast: #ffffff /* White text on dark backgrounds */
--ax-text-brand-blue-subtle: #156389 /* App title brand color */
```

### Borders
```css
--ax-border-neutral: #6f7785      /* Toggle group borders */
--ax-border-neutral-subtleA: rgba(0,22,48,0.19) /* Header/pane dividers, preview frame */
```

### Spacing Tokens
```css
--ax-space-1: 1px
--ax-space-2: 2px
--ax-space-4: 4px
--ax-space-6: 6px
--ax-space-8: 8px
--ax-space-12: 12px
--ax-space-20: 20px
--ax-space-32: 32px
```

### Border Radius Tokens
```css
--ax-border-radius-medium: 4px    /* Preview frame */
--ax-border-radius-large: 8px     /* Buttons, toggles */
```

---

## Icon Assets (SVG)

All icons are served via localhost Figma MCP server. For production, extract and bundle:

| Icon | Usage | Node ID | Size | Source Var |
|------|-------|---------|------|------------|
| Aksel Logo Mark | Header branding | 2:68 | 24×24px | `imgAkselLogoMark` |
| Edit Pencil | Project name edit | I23:60;6:561 | 16.667×16.667px | `img` |
| Download | Export JSON | I23:68;6:553 | 16.667×16.667px | `img1` |
| Upload | Import JSON | I23:141;6:553 | 16.667×16.667px | `img2` |
| Settings Cog | Settings menu | I4:961;6:559 | 24×24px | `img3` |
| Pointer/Cursor | Inspection toggle | I25:158;6:561 | 16.667×16.667px | `img4` |
| Divider Line | Toggle separators | Multiple | 1px×8px | `img5` |
| Code Brackets | Format button | I25:78;6:553 | 16.667×16.667px | `img6` |
| Plus Circle | Add button | I25:104;6:517 | 16.667×16.667px | `img7` |

**Action Required**: Download SVG assets from Figma before implementation. Replace localhost URLs with bundled asset paths.

---

## Responsive Breakpoints

Viewport toggle reveals target breakpoints:
- **Full**: 100% width (fluid)
- **1440**: Desktop large
- **1024**: Tablet landscape
- **480**: Mobile (default in design)

Preview pane uses `max-width` constraint based on selected viewport.

---

## Component Mapping (Aksel DS)

The design uses Aksel components which should be imported:

```tsx
import { Button } from "@navikt/ds-react";
import { ToggleGroup } from "@navikt/ds-react";
// Logo/icons: Custom SVG components
```

**Note**: Design shows custom button styling (not standard Aksel Button variants). May need custom CSS or wrapper components.

---

## Key Implementation Notes

### 1. Layout System
- Use CSS Grid or Flexbox for header/body split
- Preview pane: `flex-grow: 1` to fill available width
- Code pane: Fixed 888px width
- Both panes: Match height (798px total body height)

### 2. Border Rendering
- Header: Bottom border only
- Preview pane: Right border only
- Code pane: Right border only
- Preview header: Bottom border only
- Code header: Bottom border only
- All borders: `1px solid var(--ax-border-neutral-subtleA)`

### 3. Code Editor
- Line numbers: Right-aligned in 32px column
- Code content: Left-aligned with dynamic left padding (indentation)
- Line height: 20px (matches font line-height)
- Gap between lines: 4px (from flex gap)
- Indentation: 16px increments (20px, 36px, 52px for levels 1, 2, 3)

### 4. Preview Frame
- Centered horizontally with `justify-center`
- Responsive width with `max-width` constraint
- Maintains aspect ratio (height grows with content)
- Background: White (#ffffff) inside sunken gray (#ecedef) container

### 5. Toggle Groups
- Custom dividers between options (8px vertical lines)
- Padding hack for border overlap (`H@ck` nodes with negative margins)
- Selected state applies background + white text + border-radius
- Equal-width segments (`flex-grow: 1` on each toggle)

### 6. Accessibility
- All interactive elements have visible focus states (not shown in static design)
- Line numbers are decorative (not interactive)
- Icon buttons need `aria-label` attributes

---

## Design Validation Checklist

Before implementation, verify:

- [ ] Source Sans 3 font loaded (weights: 400, 600, 650)
- [ ] All Aksel Darkside CSS variables available (`--ax-*` prefix)
- [ ] SVG icons extracted and bundled (8 assets)
- [ ] Border rendering matches pixel-perfect (single-pixel borders)
- [ ] Toggle group dividers render correctly
- [ ] Preview frame max-width responds to viewport toggle
- [ ] Code indentation uses 16px increments
- [ ] Header height: 48px (8px top + 32px content + 8px bottom)
- [ ] Preview header height: 40px (8px top + 24px content + 8px bottom)
- [ ] Code header height: 40px (8px top + 24px content + 8px bottom)

---

## Deviations from Data Model

After extracting design context, compare with `data-model.md`:

### ✅ Confirmed Design Decisions
1. **Viewport options**: Full/1440/1024/480 (matches `ViewportDefinition` presets)
2. **JSX/Hook toggle**: Two-tab system (matches `EditorState.activeTab`)
3. **Header actions**: Export JSON, Import JSON, Settings (matches requirements)
4. **Preview background**: Sunken gray (#ecedef) as specified

### ⚠️ Previously Missing from Main Design
These components are now documented below:
1. ✅ **Component palette**: Modal with search and grid layout (node 30:596)
2. ✅ **Inspection popover**: Popover showing element details (node 30:4151)
3. ✅ **Loading states**: Use Aksel Loader component (per specification)
4. ⚠️ **Error states**: No compile/runtime error UI in Figma (implement per data model)
5. ⚠️ **Console output**: No console panel in Figma (implement per specification)

### 📋 Implementation Implications
- Component palette: Modal pattern (documented below)
- Inspection overlay: Popover anchored to hovered element (documented below)
- Loading: Aksel Loader component with explainer text after 9s
- Error/console UI: Follow data model specifications (no Figma design available)

---

## Component Palette Modal (Node 30:596)

**Purpose**: Browse and insert Aksel components into code  
**Trigger**: "Add" button in code header (node 25:104)  
**Component**: Aksel Modal - https://aksel.nav.no/komponenter/core/modal

### Modal Structure

```
data-node-id="30:596"
className="bg-[var(--ax-bg-raised,#ffffff)] border border-[var(--ax-border-neutral-subtleA)] rounded-[12px]"
Full size modal (responsive width/height)
```

### Header (Node 94:2316)
```
padding: 16px 20px (--ax-space-16, --ax-space-20)
layout: flex gap-16px items-start justify-between
```

**Title**: "Add component"
- Font: Source Sans 3 SemiBold, 24px/32px, weight 650, tracking -0.048px
- Color: `--ax-text-neutral`

**Close Button** (Node 94:4579):
- X-mark icon (24×24px)
- Padding: 4px
- Rounded: 8px

### Body (Node 94:2324)
```
padding: 0 20px 16px 20px
layout: flex flex-col gap-16px
```

**Description Text**:
"Browse and insert Aksel components into your code."
- Font: Source Sans 3 Regular, 18px/28px
- Color: `--ax-text-neutral`

### Modal Content (_ComponentModalContent, Node 30:3424)

**Search Field** (Node 30:1075-30:1113):
- Size: Small
- Variant: Simple (no label)
- No search button (icon inside input)
- Clear button visible when text present
- Height: 32px
- Border: 1px solid `--ax-border-neutral`
- Rounded: 8px
- Search icon: 20×20px (left side)
- Placeholder: Empty (user can type component name)

**Toggle Group** (Node 30:1478):
- Width: Full
- Height: 32px
- Border: 1px solid `--ax-border-neutral`
- Padding: 1px
- Rounded: 8px
- Options: "Layout" | **"Components"** (selected)
- Selected state: `bg-[--ax-bg-neutral-strong-pressed]`, white text
- Font: Source Sans 3 Regular, 16px/20px, tracking 0.032px

**Card Grid** (Node 30:3333):
- Layout: 2 columns
- Gap: 16px (between columns and rows)
- 4 rows visible (8 cards total in design)

**Component Card** (LinkCard instances):
```
Node IDs: 30:1540, 30:3052, 30:3335, 30:3336, 30:3358, 30:3359, 30:3381, 30:3382
background: var(--ax-bg-raised,#ffffff)
border: 1px solid var(--ax-border-neutral-subtleA)
rounded: 12px (--ax-border-radius-xlarge)
padding: 16px 20px (--ax-space-16, --ax-space-20)
```

**Card Title**:
- Text: "Button" (example - varies by component)
- Font: Source Sans 3 SemiBold, 20px/28px, weight 600, tracking -0.02px
- Color: `--ax-text-neutral`
- Underline: Yes (link style)

**Card Description**:
- Text: "Button lar brukeren utføre en handling." (example)
- Font: Source Sans 3 Regular, 18px/28px
- Color: `--ax-text-neutral`
- Margin-top: 4px

### Behavior Notes
- Modal should be scrollable if content exceeds viewport height
- Cards are clickable (insert component code on click)
- Search filters cards by name/description
- Toggle switches between Layout and Components tabs

---

## Inspection Popover (Node 30:4151)

**Purpose**: Display element inspection details when hovering over preview elements  
**Trigger**: Inspection mode enabled (toggle button node 25:158)  
**Component**: Aksel Popover - https://aksel.nav.no/komponenter/core/popover

### Popover Structure

```
data-node-id="30:4151"
width: 480px
background: var(--ax-bg-raised,#ffffff)
border: 1px solid var(--ax-border-neutral-subtleA)
rounded: 12px (--ax-border-radius-xlarge)
padding: 16px 20px (--ax-space-16, --ax-space-20)
layout: flex flex-col gap-8px
```

### Element Label (Node 24:232)
```
layout: flex items-start justify-between
full width
```

**Left**: Element selector (Label component)
- Text: "p.aksel-body-long" (example)
- Font: Source Sans 3 SemiBold, 18px/24px, weight 600
- Color: `--ax-text-neutral`

**Right**: Dimensions (BodyShort component)
- Text: "433 x 23" (example - width × height in px)
- Font: Source Sans 3 Regular, 18px/24px
- Color: `--ax-text-neutral`

### Properties List (Node 24:343)
```
layout: flex flex-col gap-4px
full width
```

Each property row (Nodes 24:326, 24:333, 24:338):
```
layout: flex items-start justify-between
full width
font: Source Sans 3 Regular, 18px/24px
color: --ax-text-neutral
```

**Property 1 - Color**:
- Left: "Color"
- Right: "--ax-text-neutral" (CSS variable name)

**Property 2 - Font**:
- Left: "Font"
- Right: "aksel-body-long--large" (Aksel typography class)

**Property 3 - Margin**:
- Left: "Margin"
- Right: "x: --ax-space-28 y: --ax-space-0" (spacing tokens)

### Behavior Notes
- Popover appears on hover when inspection mode active
- Positioned near hovered element (anchor point: element bounding box)
- Shows computed styles from preview iframe
- Updates dynamically as user hovers different elements
- Dismissed when inspection mode disabled

---

## Loading States

**Component**: Aksel Loader - https://aksel.nav.no/komponenter/core/loader  
**Specification Requirement**: Show explainer text if loading exceeds 9 seconds

### Loading Scenarios

1. **Initial App Load**:
   - Context: Loading Babel Standalone (~500KB bundle)
   - Loader size: Medium or Large
   - Position: Center of viewport
   - Explainer (after 9s): "Loading code transpiler... This may take a moment on slower connections."

2. **Project Import**:
   - Context: Parsing and validating imported JSON
   - Loader size: Small
   - Position: Inline in header (near Import button)
   - Explainer (after 9s): "Processing large project file..."

3. **Code Transpilation** (if exceeds debounce):
   - Context: Complex JSX with many components
   - Loader size: Small
   - Position: Preview pane (overlay on content)
   - Explainer (after 9s): "Transpiling large code file..."

### Loader Configuration

```tsx
import { Loader } from "@navikt/ds-react";

// Example usage
<Loader
  size="medium"
  title="Loading..."
  transparent={false}
/>

// With explainer after 9s
{showExplainer && (
  <BodyShort className="mt-4">
    Loading code transpiler... This may take a moment on slower connections.
  </BodyShort>
)}
```

**Design Tokens**:
- Loader uses Aksel default styling (no custom colors needed)
- Explainer text: Source Sans 3 Regular, 18px/28px, `--ax-text-neutral`

---

---

## Error Display (Node 31:1719)

**Purpose**: Display compile errors and runtime errors from code execution  
**Trigger**: Babel transpilation error or runtime exception in sandbox  
**Component**: Aksel Alert - https://aksel.nav.no/komponenter/core/alert

### Alert Structure

```
data-node-id="31:1719"
variant: Error
size: Medium
appearance: Panel
background: var(--ax-bg-danger-moderate,#ffe8f0)
border: 1px solid var(--ax-border-danger,#e22a49)
rounded: 12px (--ax-border-radius-xlarge)
padding: 16px 20px (--ax-space-16, --ax-space-20)
layout: flex gap-12px items-start
```

### Content Components

**Icon** (Node 31:1617):
- Component: X-markOctagon (24×24px)
- Color: `#e22a49` (error red)
- Position: Top-left, aligned with text baseline
- Padding-top: 2px (to align with heading)

**Text Container** (Node 31:1618):
```
layout: flex flex-col gap-8px
color: var(--ax-text-danger,#560000)
line-height: 28px
```

**Heading** (Node 31:1595):
- Text: "Error title" (e.g., "Compile Error", "Runtime Error")
- Font: Source Sans 3 SemiBold, 20px/28px, weight 600, tracking -0.02px
- Color: `--ax-text-danger`

**Description** (Node 31:1596):
- Text: "Detailed error description. Informing the user what to do to fix the error."
- Font: Source Sans 3 Regular, 18px/28px
- Color: `--ax-text-danger`
- Margin-top: 8px

**Close Button** (Optional, Node 31:1622):
- Icon: X-mark (24×24px, dark red)
- Padding: 4px
- Rounded: 8px
- Position: Top-right corner
- **Note**: Design shows no close button for errors (persistent until fixed)

### Error Types

**Compile Error** (from Babel):
```tsx
<Alert variant="error" size="medium">
  <Alert.Heading>Compile Error</Alert.Heading>
  Unexpected token '}' at line 12, column 5
</Alert>
```

**Runtime Error** (from Sandbox):
```tsx
<Alert variant="error" size="medium">
  <Alert.Heading>Runtime Error</Alert.Heading>
  Cannot read property 'onClick' of undefined
</Alert>
```

### Positioning

**Location**: Top of preview pane (inside preview wrapper, above iframe)
- Pushes preview content down (does not overlay)
- Full width of preview pane
- Margin-bottom: 8px before preview iframe
- Scrolls with preview content

**Dismissal**: Errors are **not dismissible** via close button. They disappear when:
- User fixes the code (auto-clears on successful transpilation)
- User clicks "Format" to auto-fix syntax errors

---

## Settings Menu (Node 31:2133)

**Purpose**: Provide quick access to theme switching and panel layout  
**Trigger**: Settings button in header (node 4:961)  
**Component**: Aksel Dropdown Menu - https://aksel.nav.no/komponenter/core/actionmenu

### Menu Structure

```
data-node-id="31:2133"
background: var(--ax-bg-raised,#ffffff)
border: 1px solid var(--ax-border-neutral-subtleA)
rounded: 12px (--ax-border-radius-xlarge)
padding: 8px (--ax-space-8)
min-width: ~180px (auto-fits content)
```

### Menu Items

**Header Item** (Node 35:16377):
```
padding: 3px 12px 3px 8px
text: "Settings"
font: Source Sans 3 Regular, 14px/20px, tracking 0.056px
color: var(--ax-text-neutral-subtle,#49515e)
non-interactive (label only)
```

**Item 1 - Switch Theme** (Node 35:16401):
```
padding: 6px 8px (--ax-space-6, --ax-space-8)
rounded: 8px (--ax-border-radius-large)
layout: flex gap-8px items-start
hover: background highlight
```

- **Icon**: Sun/moon theme icon (13.5×13.5px, positioned -5px left offset)
- **Label**: "Switch theme"
- **Font**: Source Sans 3 Regular, 16px/20px, tracking 0.032px
- **Color**: `--ax-text-neutral`
- **Action**: Toggle between light and dark theme (future: Aksel Darkside only in v1)

**Item 2 - Swap Panels** (Node 35:16441):
```
padding: 6px 8px (--ax-space-6, --ax-space-8)
rounded: 8px (--ax-border-radius-large)
layout: flex gap-8px items-start
hover: background highlight
```

- **Icon**: Arrows swap icon (13.5×13.5px, positioned -5px left offset)
- **Label**: "Swap panels"
- **Font**: Source Sans 3 Regular, 16px/20px, tracking 0.032px
- **Color**: `--ax-text-neutral`
- **Action**: Swap editor and preview positions (left ↔ right)

### Behavior Notes

- Menu appears on click of settings button (node 4:961)
- Positioned below/near settings button (dropdown pattern)
- Closes on item click or click outside
- Items have hover state (subtle background highlight)
- **v1 Scope**: Only 2 menu items (theme switch, panel swap)
- **Future**: Can add editor settings, storage management, etc.

### Implementation Note

Use Aksel's `Dropdown.Menu` component:
```tsx
<Dropdown>
  <Dropdown.Toggle>
    {/* Settings button icon */}
  </Dropdown.Toggle>
  <Dropdown.Menu>
    <Dropdown.Menu.GroupedList>
      <Dropdown.Menu.GroupedList.Heading>
        Settings
      </Dropdown.Menu.GroupedList.Heading>
      <Dropdown.Menu.List>
        <Dropdown.Menu.List.Item onClick={handleThemeSwitch}>
          <ThemeIcon /> Switch theme
        </Dropdown.Menu.List.Item>
        <Dropdown.Menu.List.Item onClick={handlePanelSwap}>
          <SwapIcon /> Swap panels
        </Dropdown.Menu.List.Item>
      </Dropdown.Menu.List>
    </Dropdown.Menu.GroupedList>
  </Dropdown.Menu>
</Dropdown>
```

---

## Console Panel (Hidden in v1)

**Purpose**: Capture and display console output from user's code  
**Status**: ⚠️ **Build backend, hide UI in v1**

**Design Philosophy** (per user guidance):
> "Let's dial this level of advanced detail down in v1. If you think it's smart to build the feature, that's OK, but hide it until we want to show it. Remember, the app is a playground that lets designers and developers compose UIs, so it must be easy first and advanced if you want."

### Implementation Strategy

**Phase 1 (v1.0 - Hidden)**:
1. ✅ **Build infrastructure**: Implement console message capture from sandbox
2. ✅ **Build data model**: `SandboxMessage.type="CONSOLE_LOG"` with `payload.logs[]`
3. ✅ **Build storage**: Store logs in memory (no UI rendering)
4. ❌ **Hide UI**: Do not show console panel in interface
5. 🔧 **Add toggle**: Hidden keyboard shortcut or dev mode to reveal (e.g., `Cmd+Shift+C`)

**Phase 2 (Future - When Needed)**:
- Reveal console panel UI when advanced users request it
- Design decision: Bottom panel (resizable) or overlay pattern
- Add controls: Clear, filter by level, search logs

### Infrastructure (Build in v1)

**From Data Model**:
```typescript
type SandboxMessage = {
  type: 'CONSOLE_LOG'
  payload: {
    logs: Array<{
      level: 'log' | 'warn' | 'error'
      args: any[]
      timestamp: number
    }>
  }
}
```

**Backend Implementation**:
1. Inject console interceptor in sandbox iframe
2. Capture `console.log()`, `console.warn()`, `console.error()`
3. Send messages to parent via postMessage
4. Store in React state (not rendered)
5. Expose via hidden debug panel (keyboard shortcut)

**UI Placeholder** (if revealed):
- Position: Overlay panel (top-right corner, small badge icon)
- Toggle: Click badge or `Cmd+Shift+C` to expand
- Minimal design: Simple list, no filtering in v1
- Hide by default: Do not show unless explicitly toggled

### Rationale

**Why build backend**: Console capture is valuable for debugging user code. Building the infrastructure now prevents future refactoring.

**Why hide UI**: Keeps interface simple and focused on core use case (UI composition). Advanced debugging can be added when user feedback demands it.

**Future considerations**: 
- Monitor user requests for console access
- Add when playground is used for more complex prototyping
- Consider browser DevTools as alternative (users can open DevTools for console)

---

## Next Steps

1. **Extract SVG assets**: Download all 8 icons from Figma, add to `public/icons/`
2. **Verify Aksel tokens**: Confirm all `--ax-*` variables exist in `@navikt/ds-css/darkside`
3. **Test font loading**: Ensure Source Sans 3 is available (via Aksel or Google Fonts)
4. **Create layout components**: Header, PreviewPane, CodePane using extracted dimensions
5. **Implement toggles**: Viewport selector and JSX/Hook tab switcher
6. **Add placeholder content**: Use LinkCard example code from design
7. **Test responsive behavior**: Verify preview pane resizes with viewport selection

---

## References

- **Figma File**: https://www.figma.com/design/aPNvetW8NkJI39C3XN9rks/Aksel-Arcade?node-id=4-828&m=dev
- **Aksel Darkside**: https://aksel.nav.no/god-praksis/artikler/darkside
- **Source Sans 3**: https://fonts.google.com/specimen/Source+Sans+3
- **Data Model**: `specs/1-aksel-arcade/data-model.md`
- **Contracts**: `specs/1-aksel-arcade/contracts/`
