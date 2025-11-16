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

  // Position (for highlight border)
  boundingRect: DOMRect // Element bounding box
  
  // Cursor position (relative to iframe viewport)
  cursorX: number // Mouse X position in iframe
  cursorY: number // Mouse Y position in iframe
}
