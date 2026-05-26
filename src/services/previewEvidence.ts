export const PREVIEW_EVIDENCE_ROOT_SELECTOR = '#root'
export const MAX_PREVIEW_EVIDENCE_ELEMENTS = 200
const MAX_PREVIEW_EVIDENCE_TEXT_LENGTH = 200
const MAX_PREVIEW_EVIDENCE_ATTRIBUTE_LENGTH = 200
const MAX_PREVIEW_EVIDENCE_CLASS_NAMES = 30

export interface PreviewEvidenceRect {
  x: number
  y: number
  width: number
  height: number
  top: number
  right: number
  bottom: number
  left: number
}

export interface PreviewEvidenceComputedStyle {
  display?: string
  position?: string
  boxSizing?: string
  width?: string
  height?: string
  marginTop?: string
  marginRight?: string
  marginBottom?: string
  marginLeft?: string
  paddingTop?: string
  paddingRight?: string
  paddingBottom?: string
  paddingLeft?: string
  rowGap?: string
  columnGap?: string
  flexDirection?: string
  alignItems?: string
  justifyContent?: string
  gridTemplateColumns?: string
  gridTemplateRows?: string
  color?: string
  backgroundColor?: string
  fontSize?: string
  fontWeight?: string
  lineHeight?: string
  textAlign?: string
  borderTopWidth?: string
  borderRightWidth?: string
  borderBottomWidth?: string
  borderLeftWidth?: string
  borderTopColor?: string
  borderRightColor?: string
  borderBottomColor?: string
  borderLeftColor?: string
  borderTopLeftRadius?: string
  borderTopRightRadius?: string
  borderBottomRightRadius?: string
  borderBottomLeftRadius?: string
}

export interface PreviewEvidenceElement {
  tagName: string
  text?: string
  attributes?: Record<string, string>
  classNames?: string[]
  boundingBox: PreviewEvidenceRect
  computedStyle: PreviewEvidenceComputedStyle
  children?: PreviewEvidenceElement[]
}

export interface PreviewEvidenceFrameMetadata {
  rootSelector: typeof PREVIEW_EVIDENCE_ROOT_SELECTOR
  viewport: {
    width: number
    height: number
    devicePixelRatio: number
  }
  scroll: {
    x: number
    y: number
  }
  capturedElementCount: number
  truncated: boolean
}

export interface PreviewEvidence {
  frame: PreviewEvidenceFrameMetadata
  tree: PreviewEvidenceElement
}

export interface PreviewEvidenceCaptureFailure {
  ok: false
  error: {
    code: 'preview-unavailable'
    message: string
  }
}

export interface PreviewEvidenceCaptureSuccess {
  ok: true
  evidence: PreviewEvidence
}

export type PreviewEvidenceCaptureResult =
  | PreviewEvidenceCaptureFailure
  | PreviewEvidenceCaptureSuccess

interface SerializationState {
  capturedElementCount: number
  truncated: boolean
}

export const collectPreviewEvidenceFromFrame = (
  iframe: HTMLIFrameElement | null
): PreviewEvidenceCaptureResult => {
  if (!iframe) {
    return createPreviewUnavailableFailure('Preview iframe is not mounted yet.')
  }

  let frameDocument: Document | null = null
  let frameWindow: Window | null = null
  try {
    frameDocument = iframe.contentDocument
    frameWindow = iframe.contentWindow
  } catch (error) {
    return createPreviewUnavailableFailure(
      `Preview iframe could not be read: ${getErrorMessage(error)}`
    )
  }

  if (!frameDocument || !frameWindow) {
    return createPreviewUnavailableFailure('Preview iframe document is not available yet.')
  }

  const root = frameDocument.querySelector(PREVIEW_EVIDENCE_ROOT_SELECTOR)
  if (!root) {
    return createPreviewUnavailableFailure('Preview root element was not found in the sandbox.')
  }

  return {
    ok: true,
    evidence: serializePreviewEvidence(root, frameWindow),
  }
}

export const serializePreviewEvidence = (
  root: Element,
  frameWindow: Window = root.ownerDocument.defaultView ?? window
): PreviewEvidence => {
  const state: SerializationState = {
    capturedElementCount: 0,
    truncated: false,
  }
  const tree = serializeElement(root, frameWindow, state)

  if (!tree) {
    throw new Error('Preview evidence root could not be serialized.')
  }

  return {
    frame: {
      rootSelector: PREVIEW_EVIDENCE_ROOT_SELECTOR,
      viewport: {
        width: roundNumber(frameWindow.innerWidth),
        height: roundNumber(frameWindow.innerHeight),
        devicePixelRatio: roundNumber(frameWindow.devicePixelRatio || 1),
      },
      scroll: {
        x: roundNumber(frameWindow.scrollX),
        y: roundNumber(frameWindow.scrollY),
      },
      capturedElementCount: state.capturedElementCount,
      truncated: state.truncated,
    },
    tree,
  }
}

const serializeElement = (
  element: Element,
  frameWindow: Window,
  state: SerializationState
): PreviewEvidenceElement | null => {
  if (isExcludedElement(element)) {
    return null
  }

  if (state.capturedElementCount >= MAX_PREVIEW_EVIDENCE_ELEMENTS) {
    state.truncated = true
    return null
  }

  state.capturedElementCount += 1

  const children: PreviewEvidenceElement[] = []
  for (const child of Array.from(element.children)) {
    const childEvidence = serializeElement(child, frameWindow, state)
    if (childEvidence) {
      children.push(childEvidence)
    }
  }

  const text = getDirectTextContent(element)
  const attributes = getAllowedAttributes(element)
  const classNames = getClassNames(element)

  return {
    tagName: element.tagName.toLowerCase(),
    ...(text ? { text } : {}),
    ...(attributes ? { attributes } : {}),
    ...(classNames ? { classNames } : {}),
    boundingBox: getBoundingBox(element),
    computedStyle: getSelectedComputedStyle(frameWindow.getComputedStyle(element)),
    ...(children.length > 0 ? { children } : {}),
  }
}

const isExcludedElement = (element: Element): boolean => {
  const tagName = element.tagName.toLowerCase()
  return (
    tagName === 'script' || tagName === 'style' || tagName === 'template' || tagName === 'noscript'
  )
}

const getAllowedAttributes = (element: Element): Record<string, string> | undefined => {
  const attributes = Array.from(element.attributes)
    .filter((attribute) => isAllowedAttributeName(attribute.name))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((attribute) => [
      attribute.name,
      truncateEvidenceValue(
        normalizeWhitespace(attribute.value),
        MAX_PREVIEW_EVIDENCE_ATTRIBUTE_LENGTH
      ),
    ])

  if (attributes.length === 0) {
    return undefined
  }

  return Object.fromEntries(attributes)
}

const isAllowedAttributeName = (name: string): boolean => {
  const normalizedName = name.toLowerCase()

  if (
    normalizedName === 'style' ||
    normalizedName.startsWith('on') ||
    normalizedName.startsWith('data-react') ||
    normalizedName.startsWith('__react')
  ) {
    return false
  }

  return (
    normalizedName === 'id' ||
    normalizedName === 'role' ||
    normalizedName === 'title' ||
    normalizedName.startsWith('aria-') ||
    normalizedName.startsWith('data-')
  )
}

const getClassNames = (element: Element): string[] | undefined => {
  const classNames = Array.from(element.classList)
    .filter((className) => !className.toLowerCase().startsWith('react-'))
    .sort((left, right) => left.localeCompare(right))
    .slice(0, MAX_PREVIEW_EVIDENCE_CLASS_NAMES)

  return classNames.length > 0 ? classNames : undefined
}

const getDirectTextContent = (element: Element): string | undefined => {
  const text = Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? '')
    .join(' ')

  const normalizedText = normalizeWhitespace(text)
  return normalizedText
    ? truncateEvidenceValue(normalizedText, MAX_PREVIEW_EVIDENCE_TEXT_LENGTH)
    : undefined
}

const getBoundingBox = (element: Element): PreviewEvidenceRect => {
  const rect = element.getBoundingClientRect()

  return {
    x: roundNumber(rect.x),
    y: roundNumber(rect.y),
    width: roundNumber(rect.width),
    height: roundNumber(rect.height),
    top: roundNumber(rect.top),
    right: roundNumber(rect.right),
    bottom: roundNumber(rect.bottom),
    left: roundNumber(rect.left),
  }
}

const getSelectedComputedStyle = (style: CSSStyleDeclaration): PreviewEvidenceComputedStyle =>
  removeEmptyStyleValues({
    display: style.display,
    position: style.position,
    boxSizing: style.boxSizing,
    width: style.width,
    height: style.height,
    marginTop: style.marginTop,
    marginRight: style.marginRight,
    marginBottom: style.marginBottom,
    marginLeft: style.marginLeft,
    paddingTop: style.paddingTop,
    paddingRight: style.paddingRight,
    paddingBottom: style.paddingBottom,
    paddingLeft: style.paddingLeft,
    rowGap: style.rowGap,
    columnGap: style.columnGap,
    flexDirection: style.flexDirection,
    alignItems: style.alignItems,
    justifyContent: style.justifyContent,
    gridTemplateColumns: style.gridTemplateColumns,
    gridTemplateRows: style.gridTemplateRows,
    color: style.color,
    backgroundColor: style.backgroundColor,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    textAlign: style.textAlign,
    borderTopWidth: style.borderTopWidth,
    borderRightWidth: style.borderRightWidth,
    borderBottomWidth: style.borderBottomWidth,
    borderLeftWidth: style.borderLeftWidth,
    borderTopColor: style.borderTopColor,
    borderRightColor: style.borderRightColor,
    borderBottomColor: style.borderBottomColor,
    borderLeftColor: style.borderLeftColor,
    borderTopLeftRadius: style.borderTopLeftRadius,
    borderTopRightRadius: style.borderTopRightRadius,
    borderBottomRightRadius: style.borderBottomRightRadius,
    borderBottomLeftRadius: style.borderBottomLeftRadius,
  })

const removeEmptyStyleValues = (
  style: PreviewEvidenceComputedStyle
): PreviewEvidenceComputedStyle =>
  Object.fromEntries(
    Object.entries(style).filter(([, value]) => Boolean(value))
  ) as PreviewEvidenceComputedStyle

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim()

const truncateEvidenceValue = (value: string, maxLength: number): string =>
  value.length > maxLength ? `${value.slice(0, maxLength)}...` : value

const roundNumber = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }

  const rounded = Math.round(value * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}

const createPreviewUnavailableFailure = (message: string): PreviewEvidenceCaptureFailure => ({
  ok: false,
  error: {
    code: 'preview-unavailable',
    message,
  },
})

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown frame access error'
