// Type declarations for inspect-overlays.js utilities used by sandbox runtime and tests

export type RectInput = {
  left: number
  top: number
  width: number
  height: number
  right?: number
  bottom?: number
}

export type Bounds = {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export type SpacingBox = {
  top: number
  right: number
  bottom: number
  left: number
}

export type NormalizedRect = Bounds
export type NullableRect = NormalizedRect | null

export type LayerRects = {
  top: NullableRect
  right: NullableRect
  bottom: NullableRect
  left: NullableRect
}

export type SpacingOverlayRects = {
  marginRects: LayerRects
  paddingRects: LayerRects
  contentRect: NullableRect
}

export type OverlayElements = {
  root: HTMLElement
  margin: LayerElements
  padding: LayerElements
  content: HTMLElement
  gapContainer: HTMLElement
}

export type LayerElements = {
  top: HTMLElement
  right: HTMLElement
  bottom: HTMLElement
  left: HTMLElement
}

export const overlayColors: {
  margin: string
  padding: string
  element: string
  gap: string
}

export function parseSpacing(value: string | number): number

export function clampRect(rect: RectInput, bounds?: Bounds): NullableRect

export function computeSpacingOverlayRects(params: {
  boundingRect: RectInput
  margin: SpacingBox
  padding: SpacingBox
  viewport?: Bounds
}): SpacingOverlayRects

export function computeGapRects(params: {
  layoutType?: string
  flexDirection?: string
  rowGap?: number
  columnGap?: number
  childrenRects?: RectInput[]
  containerRect?: RectInput
  viewport?: Bounds
}): NormalizedRect[]

export function createOverlayElements(doc?: Document): OverlayElements

export function renderSpacingLayers(elements: OverlayElements | null | undefined, spacingRects: SpacingOverlayRects | null | undefined): void

export function renderGapLayers(elements: OverlayElements | null | undefined, gapRects: NormalizedRect[]): void

export function hideOverlays(elements: OverlayElements | null | undefined): void
