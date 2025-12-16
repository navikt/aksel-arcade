# Data Model: Inspect overlay spacing highlights

## Entities

### InspectedElement
- **identity**: DOM node reference or stable inspect id
- **boxModel**: content box (x, y, width, height)
- **padding**: { top, right, bottom, left } (number, px, can be fractional)
- **margin**: { top, right, bottom, left }
- **gap**: number (px) or null when not a flex/grid gap
- **layoutType**: flex | grid | block | inline | other (for gap applicability)
- **themeContext**: current theme; overlays use Aksel tokens for the active theme (no forced light mode)

### OverlayLayer
- **target**: InspectedElement
- **colors**: { element: --ax-bg-accent-moderate-hoverA, padding: --ax-bg-success-moderate-hoverA, margin: --ax-bg-warning-moderate-hoverA, gap: --ax-bg-meta-purple-moderate-hoverA }
- **renderMode**: hover (only interaction)
- **visibility**: visible | hidden (based on inspect mode)
- **metrics**: pixel rectangles per region, clipped to viewport/iframe bounds
- **interaction**: pointer-events none to avoid blocking sandbox content

### InspectPopover
- **target**: InspectedElement
- **properties**: margin, padding, gap (numeric with units), other existing inspect fields
- **presentation**: Aksel tokens and typography; gap shows zero/absent states explicitly

## Relationships
- OverlayLayer references exactly one InspectedElement (current hover target).
- InspectPopover references the same InspectedElement as the current overlay.
- Theme context feeds token selection; overlays inherit the active theme tokens (no forced light mode).

## State & Transitions
- Hover change → update InspectedElement selection → recompute OverlayLayer metrics and colors → refresh InspectPopover values.
- Inspect mode off → OverlayLayer hidden and Popover hidden; hover has no effect.
- Gap null/zero → gap overlay hidden/zero-sized; popover shows "0" or "n/a".
