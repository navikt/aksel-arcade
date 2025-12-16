export interface SpacingValues {
  top: number
  right: number
  bottom: number
  left: number
}

export interface InspectionRect {
  x?: number
  y?: number
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface InspectionData {
  // Element identity
  componentName: string // React component name (e.g., "Button")
  tagName: string // HTML tag name (e.g., "button")
  cssClass: string // CSS class (e.g., "button.aksel-button")

  // Props (React component props)
  props: Record<string, unknown>

  // Computed styles
  color: string // Computed color (e.g., "rgb(255, 255, 255)")
  fontFamily: string // Font family (e.g., "Inter, sans-serif")
  fontSize: string // Font size (e.g., "16px")
  margin: string // Margin shorthand (e.g., "16px 0px")
  padding: string // Padding shorthand (e.g., "8px 16px")
  marginValues: SpacingValues
  paddingValues: SpacingValues
  layoutType: string // e.g., flex | grid | block
  flexDirection: string // e.g., row | column
  rowGap: number // gap along inline dimension
  columnGap: number // gap along cross dimension
  gap: string | null // gap shorthand, null when n/a
  gapApplicable: boolean

  // Position (for highlight border)
  boundingRect: InspectionRect // Element bounding box
  
  // Cursor position (relative to iframe viewport)
  cursorX: number // Mouse X position in iframe
  cursorY: number // Mouse Y position in iframe
}
