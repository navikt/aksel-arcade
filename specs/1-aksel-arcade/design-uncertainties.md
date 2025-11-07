# Design Uncertainties & Decisions - Aksel Arcade

**Date**: November 6, 2025  
**Status**: Post-Figma Extraction  
**Last Updated**: After extracting nodes 4-828, 30-596, 30-4151

---

## ✅ Resolved Uncertainties

### 1. Viewport Breakpoints (RESOLVED)
**Original Question**: Should we use standard Aksel breakpoints (320/480/768/1024/1280/1440)?  
**Resolution**: Figma design (node 4:555) specifies: **Full | 1440 | 1024 | 480**
- **Full**: 100% width of preview pane (responsive)
- **1440**: Desktop large
- **1024**: Tablet landscape
- **480**: Mobile (default selected in design)

**Data Model Updated**: Changed `ViewportSize` from `'XS' | 'SM' | 'MD' | 'LG' | 'XL' | '2XL'` to `'FULL' | '1440' | '1024' | '480'`

**Implementation Note**: Preview frame uses `max-width` constraint based on selection. Full mode removes constraint.

---

### 2. Component Palette UI (RESOLVED)
**Original Question**: How should users browse and insert components?  
**Resolution**: Figma design (node 30:596) specifies **Modal pattern**
- Trigger: "Add" button in code header
- Modal size: Full-screen responsive (not drawer)
- Search: Small text input with icon (no label)
- Tabs: Layout | Components (toggle group)
- Grid: 2 columns, 16px gap
- Cards: LinkCard component with title + description
- Aksel component: `<Modal>` from @navikt/ds-react

**Extracted Details**:
- Modal header: "Add component", 24px SemiBold, with close button
- Description: "Browse and insert Aksel components into your code."
- Search height: 32px with border
- Card padding: 16px 20px, rounded 12px
- Card title: 20px SemiBold, underlined (link style)
- Card description: 18px Regular, 4px top margin

---

### 3. Element Inspection UI (RESOLVED)
**Original Question**: How should inspection details be displayed?  
**Resolution**: Figma design (node 30:4151) specifies **Popover pattern**
- Width: 480px fixed
- Background: `--ax-bg-raised` with 1px border
- Rounded: 12px
- Padding: 16px 20px
- Aksel component: `<Popover>` from @navikt/ds-react

**Content Structure**:
1. **Element Label**: `p.aksel-body-long` (18px SemiBold) | Dimensions `433 x 23` (18px Regular)
2. **Properties** (8px gap between rows):
   - Color: `--ax-text-neutral` (CSS variable name)
   - Font: `aksel-body-long--large` (Aksel typography class)
   - Margin: `x: --ax-space-28 y: --ax-space-0` (spacing tokens)

**Behavior**: Appears on hover when inspection mode active, anchored near element.

---

### 4. Loading States (RESOLVED)
**Original Question**: What loading indicators should be shown?  
**Resolution**: Per specification + Aksel Loader component
- **Component**: `<Loader>` from @navikt/ds-react
- **Documentation**: https://aksel.nav.no/komponenter/core/loader
- **Explainer Threshold**: Show explanatory text if loading exceeds **9 seconds**

**Loading Scenarios**:
1. **Initial App Load** (Babel Standalone ~500KB):
   - Loader size: Medium/Large, center of viewport
   - Explainer (9s+): "Loading code transpiler... This may take a moment on slower connections."

2. **Project Import** (JSON parsing):
   - Loader size: Small, inline in header
   - Explainer (9s+): "Processing large project file..."

3. **Code Transpilation** (complex JSX):
   - Loader size: Small, preview pane overlay
   - Explainer (9s+): "Transpiling large code file..."

**Typography**: Explainer uses BodyShort (18px Regular), `--ax-text-neutral`

---

### 5. Error Display UI (RESOLVED)
**Original Question**: How should compile and runtime errors be displayed?  
**Resolution**: Figma design (node 31:1719) specifies **Aksel Alert component**
- **Variant**: Error (red theme)
- **Size**: Medium
- **Appearance**: Panel
- **Background**: `--ax-bg-danger-moderate` (#ffe8f0)
- **Border**: 1px solid `--ax-border-danger` (#e22a49)
- **Rounded**: 12px
- **Padding**: 16px 20px

**Content Structure**:
1. **Icon**: X-markOctagon (24×24px, error red)
2. **Heading**: "Error title" (20px SemiBold, e.g., "Compile Error")
3. **Description**: Detailed error message (18px Regular)
4. **Close Button**: **None** (errors persist until fixed)

**Positioning**: Top of preview pane, pushes content down, full width

**Dismissal Behavior**: Auto-clears on successful code fix

---

### 6. Settings Menu UI (RESOLVED)
**Original Question**: What UI pattern should settings use?  
**Resolution**: Figma design (node 31:2133) specifies **Dropdown Menu pattern** (not Modal)
- **Component**: Aksel Dropdown Menu
- **Trigger**: Settings button (node 4:961)
- **Width**: Auto-fit (~180px)
- **Background**: `--ax-bg-raised` with 1px border
- **Rounded**: 12px
- **Padding**: 8px

**Menu Items** (v1):
1. **Header**: "Settings" (14px, non-interactive label)
2. **Switch theme**: Icon + label (16px) - toggles theme
3. **Swap panels**: Icon + label (16px) - swaps editor/preview positions

**Future additions**: Editor settings, storage management (not in v1)

---

### 7. Console Panel (RESOLVED - Build Backend, Hide UI)
**Original Question**: Should console output be visible in v1?  
**Resolution**: Per user guidance - **Build infrastructure, hide UI**

**User Quote**:
> "Let's dial this level of advanced detail down in v1. If you think it's smart to build the feature, that's OK, but hide it until we want to show it. Remember, the app is a playground that lets designers and developers compose UIs, so it must be easy first and advanced if you want."

**Implementation Decision**:
- ✅ **Build backend**: Capture console messages from sandbox (data model already supports)
- ✅ **Store in memory**: Keep logs in React state (not rendered)
- ❌ **Hide UI**: Do not show console panel in interface
- 🔧 **Add hidden toggle**: Optional keyboard shortcut (e.g., `Cmd+Shift+C`) for debug access
- 📋 **Future**: Reveal when advanced users request it

**Rationale**: Keeps UI simple and focused on core use case (UI composition). Infrastructure in place for future enhancement.

---

## ⚠️ Partial Uncertainties (Design Not in Figma)

## 🔍 Edge Cases & Clarifications Needed

### 8. Auto-Save Behavior
**Question**: What should happen when auto-save fails (e.g., LocalStorage quota exceeded)?

**Current Spec**: 5MB max, 4MB warning threshold, 1s debounce

**Clarifications Needed**:
- Show persistent warning banner when approaching 4MB?
- Block further edits when 5MB reached, or just prevent save?
- Offer "Export and continue editing" option if quota exceeded?

**Suggested Resolution**:
- At 4MB: Show yellow Alert banner "Project size: 4.2 MB / 5 MB - Consider exporting to reduce size"
- At 5MB: Show red Alert banner "Project size limit reached (5 MB). Auto-save disabled. Export your work."
- Continue allowing edits (in-memory only), but prevent LocalStorage writes

---

### 9. Code Transpilation Timeout
**Question**: What should happen if Babel Standalone takes >10s to transpile?

**Current Spec**: 250ms debounce for preview updates, no timeout specified

**Clarifications Needed**:
- Should transpilation have a timeout (e.g., 30s)?
- Should there be a "Cancel transpilation" button?
- What error message should be shown?

**Suggested Resolution**:
- Timeout: 30 seconds
- Loader with "Cancel" button after 9s (when explainer appears)
- Error message: "Transpilation timed out (30s). Your code may be too complex or contain an infinite loop."

---

### 10. Component Snippet Format
**Question**: What exact format should component snippets use when inserted?

**Current Spec**: Component palette inserts "sensible default props"

**Example Uncertainties**:
```tsx
// Option A: Minimal (just required props)
<Button>Click me</Button>

// Option B: Common defaults (variant + size)
<Button variant="primary" size="medium">Click me</Button>

// Option C: All props with defaults
<Button 
  variant="primary" 
  size="medium"
  disabled={false}
  loading={false}
>
  Click me
</Button>
```

**Suggested Resolution**:
- Use **Option B** (common defaults) for balance
- Include most commonly used props (variant, size)
- Omit boolean props that default to false
- Add helpful placeholder text (e.g., "Click me", "Heading text")

---

### 11. Import Resolution Strategy
**Question**: How should imports be resolved in the Hooks tab when used in JSX tab?

**Current Spec**: "Import resolves correctly in the runtime environment"

**Implementation Options**:
```tsx
// Option A: Relative path (as if separate files)
import { useCounter } from './hooks';

// Option B: Module name
import { useCounter } from 'hooks';

// Option C: Special syntax
import { useCounter } from '@hooks';
```

**Technical Constraint**: Babel Standalone needs to understand the import path

**Suggested Resolution**:
- Use **Option A** (`'./hooks'`) for familiarity
- During transpilation, replace `./hooks` imports with inline code from Hooks tab
- Validate that Hooks tab exports match JSX tab imports

---

### 12. Multi-File Support (Future Consideration)
**Question**: Should multiple JSX files be supported in later versions?

**Current Spec**: 2 tabs (JSX, Hooks) only

**Future Considerations**:
- Adding components tab (e.g., `Button.jsx`, `Card.jsx`)
- File tree navigation
- Cross-file imports

**Current Resolution**: **Out of scope for v1.0**
- Stick with 2-tab model (JSX + Hooks)
- All component definitions must be in single JSX file
- Note as potential future enhancement in roadmap

---

## 📋 Summary of Decisions Made

| Topic | Decision | Source | Status |
|-------|----------|--------|--------|
| **Viewport breakpoints** | Full, 1440, 1024, 480 | Figma node 4:555 | ✅ Resolved |
| **Default viewport** | 480 (mobile) | Figma node 4:555 | ✅ Resolved |
| **Component palette UI** | Modal with search + grid | Figma node 30:596 | ✅ Resolved |
| **Inspection popover** | 480px popover with props | Figma node 30:4151 | ✅ Resolved |
| **Loading threshold** | 9 seconds for explainer | Specification | ✅ Resolved |
| **Error display** | Aksel Alert (Error variant) | Figma node 31:1719 | ✅ Resolved |
| **Settings UI** | Dropdown menu (2 items) | Figma node 31:2133 | ✅ Resolved |
| **Console panel** | Build backend, hide UI | User guidance | ✅ Resolved |
| **Auto-save failure** | Warning at 4MB, block at 5MB | Suggested | ⚠️ Needs confirmation |
| **Transpilation timeout** | 30s with cancel option | Suggested | ⚠️ Needs confirmation |
| **Snippet format** | Common defaults (Option B) | Suggested | ⚠️ Needs confirmation |
| **Import resolution** | `'./hooks'` relative path | Suggested | ⚠️ Needs confirmation |

---

## 🎯 Next Steps

1. **Confirm Suggested Resolutions**: Get user feedback on items marked "⚠️ Needs confirmation"
2. **Extract SVG Assets**: Download 8+ icons from Figma before implementation
3. **Validate Aksel Components**: Verify all referenced Aksel components exist in @navikt/ds-react
4. **Begin Task Generation**: Run `/speckit.tasks` to create implementation task breakdown

---

## 🔗 References

- **Main Figma Design**: https://www.figma.com/design/aPNvetW8NkJI39C3XN9rks/Aksel-Arcade?node-id=4-828
- **Component Modal**: https://www.figma.com/design/aPNvetW8NkJI39C3XN9rks/Aksel-Arcade?node-id=30-596
- **Inspection Popover**: https://www.figma.com/design/aPNvetW8NkJI39C3XN9rks/Aksel-Arcade?node-id=30-4151
- **Aksel Darkside Docs**: https://aksel.nav.no/god-praksis/artikler/darkside
- **Aksel Loader**: https://aksel.nav.no/komponenter/core/loader
- **Aksel Modal**: https://aksel.nav.no/komponenter/core/modal
- **Aksel Popover**: https://aksel.nav.no/komponenter/core/popover
- **Aksel Alert**: https://aksel.nav.no/komponenter/core/alert
