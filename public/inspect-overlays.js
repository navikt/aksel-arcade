// Utility helpers for inspect overlays (shared by sandbox runtime and tests)

export const overlayColors = {
  margin: 'var(--ax-bg-warning-moderate-hoverA, rgba(255, 183, 77, 0.45))',
  padding: 'var(--ax-bg-success-moderate-hoverA, rgba(0, 138, 56, 0.35))',
  element: 'var(--ax-bg-accent-moderate-hoverA, rgba(0, 103, 197, 0.35))',
  gap: 'var(--ax-bg-meta-purple-moderate-hoverA, rgba(102, 86, 255, 0.35))',
}

const defaultViewport = () => ({
  left: 0,
  top: 0,
  right: typeof window !== 'undefined' ? window.innerWidth : 0,
  bottom: typeof window !== 'undefined' ? window.innerHeight : 0,
})

const normalizeRect = (rect) => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
  right: rect.right ?? rect.left + rect.width,
  bottom: rect.bottom ?? rect.top + rect.height,
})

export const parseSpacing = (value) => {
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const clampRect = (rect, bounds) => {
  const viewport = bounds ?? defaultViewport()
  const left = Math.max(rect.left, viewport.left)
  const top = Math.max(rect.top, viewport.top)
  const right = Math.min(rect.left + rect.width, viewport.right)
  const bottom = Math.min(rect.top + rect.height, viewport.bottom)

  const width = right - left
  const height = bottom - top

  if (width <= 0 || height <= 0) {
    return null
  }

  return { left, top, width, height, right, bottom }
}

export const computeSpacingOverlayRects = ({ boundingRect, margin, padding, viewport }) => {
  const vp = viewport ?? defaultViewport()
  const base = normalizeRect(boundingRect)

  const marginRects = {
    top: clampRect({
      left: base.left - margin.left,
      top: base.top - margin.top,
      width: base.width + margin.left + margin.right,
      height: margin.top,
    }, vp),
    right: clampRect({
      left: base.right,
      top: base.top - margin.top,
      width: margin.right,
      height: base.height + margin.top + margin.bottom,
    }, vp),
    bottom: clampRect({
      left: base.left - margin.left,
      top: base.bottom,
      width: base.width + margin.left + margin.right,
      height: margin.bottom,
    }, vp),
    left: clampRect({
      left: base.left - margin.left,
      top: base.top - margin.top,
      width: margin.left,
      height: base.height + margin.top + margin.bottom,
    }, vp),
  }

  const paddingRects = {
    top: clampRect({
      left: base.left,
      top: base.top,
      width: base.width,
      height: padding.top,
    }, vp),
    right: clampRect({
      left: base.right - padding.right,
      top: base.top,
      width: padding.right,
      height: base.height,
    }, vp),
    bottom: clampRect({
      left: base.left,
      top: base.bottom - padding.bottom,
      width: base.width,
      height: padding.bottom,
    }, vp),
    left: clampRect({
      left: base.left,
      top: base.top,
      width: padding.left,
      height: base.height,
    }, vp),
  }

  const contentRect = clampRect({
    left: base.left + padding.left,
    top: base.top + padding.top,
    width: Math.max(base.width - padding.left - padding.right, 0),
    height: Math.max(base.height - padding.top - padding.bottom, 0),
  }, vp)

  return { marginRects, paddingRects, contentRect }
}

const addGapRect = (list, rect, bounds, dedupe) => {
  const clamped = clampRect(rect, bounds)
  if (!clamped) return
  const key = `${Math.round(clamped.left)}:${Math.round(clamped.top)}:${Math.round(clamped.width)}:${Math.round(clamped.height)}`
  if (dedupe.has(key)) return
  dedupe.add(key)
  list.push(clamped)
}

export const computeGapRects = ({ layoutType, flexDirection, rowGap = 0, columnGap = 0, childrenRects = [], containerRect, viewport }) => {
  const vp = viewport ?? defaultViewport()
  const bounds = containerRect ? normalizeRect(containerRect) : { ...vp, width: vp.right - vp.left, height: vp.bottom - vp.top }
  const normalizedChildren = childrenRects.map(normalizeRect)

  if (!normalizedChildren.length) return []

  const dedupe = new Set()
  const gaps = []
  const isFlex = layoutType?.includes('flex')
  const isGrid = layoutType?.includes('grid')

  if (isFlex) {
    const isRow = (flexDirection || 'row').includes('row')
    const gapSize = isRow ? columnGap : rowGap
    if (gapSize > 0) {
      const sorted = [...normalizedChildren].sort((a, b) => (isRow ? a.left - b.left : a.top - b.top))
      for (let i = 0; i < sorted.length - 1; i += 1) {
        const current = sorted[i]
        const next = sorted[i + 1]
        if (isRow) {
          const width = Math.max(next.left - current.right, gapSize)
          const top = Math.max(current.top, next.top)
          const height = Math.max(Math.min(current.bottom, next.bottom) - top, 0)
          addGapRect(gaps, { left: current.right, top, width, height }, bounds, dedupe)
        } else {
          const height = Math.max(next.top - current.bottom, gapSize)
          const left = Math.max(current.left, next.left)
          const width = Math.max(Math.min(current.right, next.right) - left, 0)
          addGapRect(gaps, { left, top: current.bottom, width, height }, bounds, dedupe)
        }
      }
    }
  }

  if (isGrid) {
    const rowGapSize = rowGap || 0
    const columnGapSize = columnGap || 0
    for (let i = 0; i < normalizedChildren.length; i += 1) {
      for (let j = i + 1; j < normalizedChildren.length; j += 1) {
        const a = normalizedChildren[i]
        const b = normalizedChildren[j]

        const horizontalGap = b.left - a.right
        const verticalOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (horizontalGap > 0 && verticalOverlap > 0 && columnGapSize > 0) {
          const height = Math.max(verticalOverlap, 0)
          const width = Math.max(horizontalGap, columnGapSize)
          addGapRect(gaps, { left: a.right, top: Math.max(a.top, b.top), width, height }, bounds, dedupe)
        }

        const verticalGap = b.top - a.bottom
        const horizontalOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        if (verticalGap > 0 && horizontalOverlap > 0 && rowGapSize > 0) {
          const width = Math.max(horizontalOverlap, 0)
          const height = Math.max(verticalGap, rowGapSize)
          addGapRect(gaps, { left: Math.max(a.left, b.left), top: a.bottom, width, height }, bounds, dedupe)
        }
      }
    }
  }

  return gaps
}

const applyRect = (element, rect, color) => {
  if (!element) return
  if (!rect) {
    element.style.display = 'none'
    return
  }
  element.style.display = 'block'
  element.style.left = `${rect.left}px`
  element.style.top = `${rect.top}px`
  element.style.width = `${rect.width}px`
  element.style.height = `${rect.height}px`
  element.style.backgroundColor = color
}

export const createOverlayElements = (doc = document) => {
  const root = doc.createElement('div')
  root.className = 'inspect-overlay-root aksel-theme'
  root.setAttribute('data-color', 'accent')
  root.style.position = 'fixed'
  root.style.left = '0'
  root.style.top = '0'
  root.style.width = '100%'
  root.style.height = '100%'
  root.style.pointerEvents = 'none'
  root.style.zIndex = '9998'
  root.style.mixBlendMode = 'normal'
  root.style.display = 'none'

  const makeLayer = (color) => {
    const layer = doc.createElement('div')
    layer.style.position = 'absolute'
    layer.style.opacity = '1'
    layer.style.pointerEvents = 'none'
    layer.style.display = 'none'
    layer.style.backgroundColor = color
    return layer
  }

  const margin = {
    top: makeLayer(overlayColors.margin),
    right: makeLayer(overlayColors.margin),
    bottom: makeLayer(overlayColors.margin),
    left: makeLayer(overlayColors.margin),
  }

  const padding = {
    top: makeLayer(overlayColors.padding),
    right: makeLayer(overlayColors.padding),
    bottom: makeLayer(overlayColors.padding),
    left: makeLayer(overlayColors.padding),
  }

  const content = makeLayer(overlayColors.element)

  const gapContainer = doc.createElement('div')
  gapContainer.style.position = 'absolute'
  gapContainer.style.left = '0'
  gapContainer.style.top = '0'
  gapContainer.style.width = '100%'
  gapContainer.style.height = '100%'
  gapContainer.style.pointerEvents = 'none'

  Object.values(margin).forEach((layer) => root.appendChild(layer))
  Object.values(padding).forEach((layer) => root.appendChild(layer))
  root.appendChild(content)
  root.appendChild(gapContainer)

  doc.body.appendChild(root)

  return { root, margin, padding, content, gapContainer }
}

export const renderSpacingLayers = (elements, spacingRects) => {
  if (!elements || !spacingRects) return
  elements.root.style.display = 'block'
  applyRect(elements.margin.top, spacingRects.marginRects.top, overlayColors.margin)
  applyRect(elements.margin.right, spacingRects.marginRects.right, overlayColors.margin)
  applyRect(elements.margin.bottom, spacingRects.marginRects.bottom, overlayColors.margin)
  applyRect(elements.margin.left, spacingRects.marginRects.left, overlayColors.margin)

  applyRect(elements.padding.top, spacingRects.paddingRects.top, overlayColors.padding)
  applyRect(elements.padding.right, spacingRects.paddingRects.right, overlayColors.padding)
  applyRect(elements.padding.bottom, spacingRects.paddingRects.bottom, overlayColors.padding)
  applyRect(elements.padding.left, spacingRects.paddingRects.left, overlayColors.padding)

  applyRect(elements.content, spacingRects.contentRect, overlayColors.element)
}

export const renderGapLayers = (elements, gapRects) => {
  if (!elements) return
  const container = elements.gapContainer

  const desired = gapRects.length
  while (container.children.length > desired) {
    container.removeChild(container.lastChild)
  }

  for (let i = 0; i < desired; i += 1) {
    const rect = gapRects[i]
    let layer = container.children[i]
    if (!layer) {
      layer = container.ownerDocument.createElement('div')
      layer.style.position = 'absolute'
      layer.style.opacity = '1'
      layer.style.pointerEvents = 'none'
      container.appendChild(layer)
    }
    applyRect(layer, rect, overlayColors.gap)
  }

  elements.root.style.display = 'block'
}

export const hideOverlays = (elements) => {
  if (!elements) return
  elements.root.style.display = 'none'
  ;[...elements.gapContainer.children].forEach((child) => {
    if (child instanceof HTMLElement) {
      child.style.display = 'none'
    }
  })
  Object.values(elements.margin).forEach((layer) => {
    layer.style.display = 'none'
  })
  Object.values(elements.padding).forEach((layer) => {
    layer.style.display = 'none'
  })
  elements.content.style.display = 'none'
}
