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

### ⚠️ Missing from Design
1. **Component palette**: "Add" button exists, but no palette UI shown
2. **Error states**: No compile error or runtime error UI
3. **Console output**: No console panel visible
4. **Inspection mode**: Toggle button exists, but no inspection overlay shown
5. **Loading states**: No spinner or skeleton screens

### 📋 Implementation Implications
- Component palette: Modal/drawer pattern (not in main layout)
- Error/console UI: Likely overlays or bottom panel (responsive design)
- Inspection overlay: Transparent overlay with highlight boxes (runtime feature)
- Loading: Inline spinners or skeleton screens (not static design)

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
