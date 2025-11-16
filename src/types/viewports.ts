import type { ViewportSize } from './project'

export interface ViewportDefinition {
  id: ViewportSize
  name: string // Display name (e.g., "Mobile")
  width: number // Pixel width
  label: string // Button label (e.g., "SM")
}

// Aksel Standard Breakpoints (from Figma design node 36:981)
// Reference: https://aksel.nav.no/grunnleggende/styling/brekkpunkter
export const VIEWPORTS: ViewportDefinition[] = [
  { id: '2XL', name: 'Desktop Extra Large', width: 1440, label: '2XL' },
  { id: 'XL', name: 'Desktop Large', width: 1280, label: 'XL' },
  { id: 'LG', name: 'Tablet Landscape', width: 1024, label: 'LG' },
  { id: 'MD', name: 'Tablet Portrait', width: 768, label: 'MD' },
  { id: 'SM', name: 'Mobile Large', width: 480, label: 'SM' },
  { id: 'XS', name: 'Mobile Small', width: 320, label: 'XS' },
]

// Helper to get viewport width by ID
export const getViewportWidth = (id: ViewportSize): number => {
  const viewport = VIEWPORTS.find((v) => v.id === id)
  return viewport?.width ?? 768 // Default to MD (768px) if unknown
}
