# UI Contracts: Inspect overlay spacing highlights

## Hover Interaction
- **Action**: User moves cursor over elements while inspect mode is active.
- **Result**: Overlays update to the hovered element; margin/padding/gap sizes match computed values; colors use Aksel tokens that follow the active theme (no extra opacity beyond token alpha).
- **Constraints**: Update within 100ms; overlays do not block pointer interactions (pointer-events none).

## Click Interaction
- **Action**: User clicks any element while in inspect mode.
- **Result**: No state change to overlays or selection; hover remains authoritative.
- **Constraints**: Must not lock overlays or alter popover target.

## Popover Data Contract
- **Fields**: margin (per side), padding (per side), gap (numeric with units or "n/a"), existing inspect fields unchanged.
- **Presentation**: Uses Aksel components/tokens; values reflect computed layout at the time of hover.
- **Error/Absent Handling**: If gap not applicable, show "0" or "n/a" without errors; overlays hide gap region accordingly.

## Rendering Contract
- **Margin Region**: Render outside element bounds using `--ax-bg-warning-moderate-hoverA` and sized to actual margin per side.
- **Padding Region**: Render inside element bounds using `--ax-bg-success-moderate-hoverA` and sized to actual padding per side.
- **Element Region**: Use `--ax-bg-accent-moderate-hoverA` for the content box.
- **Gap Region**: Between children of flex/grid layouts using `--ax-bg-meta-purple-moderate-hoverA`; width/height equals computed gap.
- **Clipping**: Overlays clip to sandbox viewport; no overflow that blocks UI.

## Performance & Reliability
- **Latency**: Overlay and popover refresh within 100ms of hover change for typical pages.
- **Accuracy**: Spacing visualized within 1px of computed layout values.
- **Resilience**: Overlay rendering must not throw when gap is undefined or elements are offscreen/partially visible.
