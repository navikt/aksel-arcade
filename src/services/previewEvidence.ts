import type { ArcadePageId } from '@/types/project'

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

export type PreviewEvidenceLayer = 'screenshot' | 'frame'
export type PreviewEvidenceScreenshotScope = 'viewport' | 'full_page' | 'region'
export type PreviewEvidenceCaptureErrorCode =
  | 'preview-unavailable'
  | 'invalid-capture-target'
  | 'render-timeout'

export interface PreviewEvidenceCaptureTarget {
  selector?: string
  role?: string
  name?: string
  text?: string
  label?: string
}

export interface PreviewEvidenceScreenshot {
  mimeType: 'image/svg+xml'
  text: string
  width: number
  height: number
}

type LabelableElement =
  | HTMLButtonElement
  | HTMLInputElement
  | HTMLMeterElement
  | HTMLOutputElement
  | HTMLProgressElement
  | HTMLSelectElement
  | HTMLTextAreaElement

export interface PreviewEvidenceCaptureMetadata {
  currentPageId?: ArcadePageId | null
  screenshotScope?: PreviewEvidenceScreenshotScope
  targetDescription?: string
}

interface PreviewEvidenceViewportFallback {
  width: number
  height: number
}

export interface PreviewEvidenceCaptureFailure {
  ok: false
  error: {
    code: PreviewEvidenceCaptureErrorCode
    message: string
  }
}

export interface PreviewEvidenceCaptureSuccess {
  ok: true
  evidence: PreviewEvidence
  screenshot?: PreviewEvidenceScreenshot
  captureMeta?: PreviewEvidenceCaptureMetadata
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

export type PreviewEvidenceRequestHandler = () => Promise<PreviewEvidenceCaptureResult>

const previewEvidenceRequestHandlers = new WeakMap<
  HTMLIFrameElement,
  PreviewEvidenceRequestHandler
>()

export const registerPreviewEvidenceRequestHandler = (
  iframe: HTMLIFrameElement,
  handler: PreviewEvidenceRequestHandler
): (() => void) => {
  previewEvidenceRequestHandlers.set(iframe, handler)

  return () => {
    if (previewEvidenceRequestHandlers.get(iframe) === handler) {
      previewEvidenceRequestHandlers.delete(iframe)
    }
  }
}

export const requestPreviewEvidenceFromFrame = (
  iframe: HTMLIFrameElement | null
): Promise<PreviewEvidenceCaptureResult> => {
  if (!iframe) {
    return Promise.resolve(createPreviewUnavailableFailure('Preview iframe is not mounted yet.'))
  }

  const handler = previewEvidenceRequestHandlers.get(iframe)
  if (!handler) {
    return Promise.resolve(
      createPreviewUnavailableFailure('Preview iframe is not connected to the sandbox yet.')
    )
  }

  try {
    return handler()
  } catch (error) {
    return Promise.resolve(
      createPreviewUnavailableFailure(`Preview evidence request failed: ${getErrorMessage(error)}`)
    )
  }
}

export const serializePreviewEvidence = (
  root: Element,
  frameWindow: Window = root.ownerDocument.defaultView ?? window,
  viewportFallback?: PreviewEvidenceViewportFallback
): PreviewEvidence => {
  const state: SerializationState = {
    capturedElementCount: 0,
    truncated: false,
  }
  const tree = serializeElement(root, frameWindow, state)
  const viewport = getEffectiveViewportSize(frameWindow, viewportFallback)

  if (!tree) {
    throw new Error('Preview evidence root could not be serialized.')
  }

  return {
    frame: {
      rootSelector: PREVIEW_EVIDENCE_ROOT_SELECTOR,
      viewport: { ...viewport, devicePixelRatio: roundNumber(frameWindow.devicePixelRatio || 1) },
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

export const capturePreviewEvidenceSnapshot = (
  root: Element,
  {
    layers,
    screenshotScope = 'viewport',
    target,
    currentPageId = null,
    viewportFallback,
  }: {
    layers?: PreviewEvidenceLayer[]
    screenshotScope?: PreviewEvidenceScreenshotScope
    target?: PreviewEvidenceCaptureTarget
    currentPageId?: ArcadePageId | null
    viewportFallback?: PreviewEvidenceViewportFallback
  } = {},
  frameWindow: Window = root.ownerDocument.defaultView ?? window
): PreviewEvidenceCaptureResult => {
  try {
    const evidence = serializePreviewEvidence(root, frameWindow, viewportFallback)
    const normalizedLayers = layers ? [...layers] : []
    const screenshotRequested = normalizedLayers.includes('screenshot')
    const screenshot = screenshotRequested
      ? createPreviewScreenshot(root, { screenshotScope, target, viewportFallback }, frameWindow)
      : null

    if (screenshotRequested && !screenshot) {
      return createPreviewCaptureFailure(
        'preview-unavailable',
        'Preview screenshot could not be captured.'
      )
    }

    return {
      ok: true,
      evidence,
      ...(screenshot ? { screenshot } : {}),
      captureMeta: {
        currentPageId,
        screenshotScope,
        ...(screenshot?.targetDescription ? { targetDescription: screenshot.targetDescription } : {}),
      },
    }
  } catch (error) {
    const code = isTaggedPreviewCaptureError(error) ? error.code : 'preview-unavailable'
    const message = getErrorMessage(error)
    return createPreviewCaptureFailure(
      code,
      code === 'preview-unavailable' ? `Preview evidence could not be captured: ${message}` : message
    )
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

interface PreviewScreenshotResult extends PreviewEvidenceScreenshot {
  targetDescription?: string
}

interface CaptureRect {
  x: number
  y: number
  width: number
  height: number
}

const createPreviewScreenshot = (
  root: Element,
  {
    screenshotScope,
    target,
    viewportFallback,
  }: {
    screenshotScope: PreviewEvidenceScreenshotScope
    target?: PreviewEvidenceCaptureTarget
    viewportFallback?: PreviewEvidenceViewportFallback
  },
  frameWindow: Window
): PreviewScreenshotResult | null => {
  const captureRegion = resolvePreviewCaptureRegion(
    root,
    frameWindow,
    screenshotScope,
    target,
    viewportFallback
  )
  if (!captureRegion) {
    return null
  }

  const frameDocument = root.ownerDocument
  const documentWidth = getCaptureDocumentWidth(root, frameWindow, viewportFallback)
  const documentHeight = getCaptureDocumentHeight(root, frameWindow, viewportFallback)
  const stage = frameDocument.createElement('div')
  stage.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  stage.style.width = `${documentWidth}px`
  stage.style.height = `${documentHeight}px`
  stage.style.overflow = 'hidden'
  stage.style.boxSizing = 'border-box'
  stage.style.backgroundColor = resolvePreviewCanvasBackgroundColor(frameDocument, frameWindow)
  stage.style.transform = `translate(${-captureRegion.rect.x}px, ${-captureRegion.rect.y}px)`
  stage.style.transformOrigin = 'top left'

  const clonedRoot = cloneStyledElementTree(root, frameWindow)
  if (!clonedRoot) {
    return null
  }

  stage.appendChild(clonedRoot)

  const serializedStage = new XMLSerializer().serializeToString(stage)
  const width = Math.max(1, roundNumber(captureRegion.rect.width))
  const height = Math.max(1, roundNumber(captureRegion.rect.height))
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<foreignObject x="0" y="0" width="${width}" height="${height}">`,
    serializedStage,
    '</foreignObject>',
    '</svg>',
  ].join('')

  return {
    mimeType: 'image/svg+xml',
    text: svg,
    width,
    height,
    ...(captureRegion.targetDescription
      ? { targetDescription: captureRegion.targetDescription }
      : {}),
  }
}

const resolvePreviewCaptureRegion = (
  root: Element,
  frameWindow: Window,
  screenshotScope: PreviewEvidenceScreenshotScope,
  target?: PreviewEvidenceCaptureTarget,
  viewportFallback?: PreviewEvidenceViewportFallback
): {
  rect: CaptureRect
  targetDescription?: string
} | null => {
  switch (screenshotScope) {
    case 'viewport': {
      const viewport = getEffectiveViewportSize(frameWindow, viewportFallback)
      return {
        rect: {
          x: roundNumber(frameWindow.scrollX),
          y: roundNumber(frameWindow.scrollY),
          width: viewport.width,
          height: viewport.height,
        },
      }
    }
    case 'full_page':
      return {
        rect: {
          x: 0,
          y: 0,
          width: roundNumber(getCaptureDocumentWidth(root, frameWindow, viewportFallback)),
          height: roundNumber(getCaptureDocumentHeight(root, frameWindow, viewportFallback)),
        },
      }
    case 'region': {
      const resolvedTarget = resolvePreviewCaptureTarget(root, target)
      if (!resolvedTarget) {
        throw createTaggedPreviewCaptureError(
          'invalid-capture-target',
          'Preview region capture requires a preview-root selector or accessibility target that resolves inside the sandbox preview.'
        )
      }

      const rect = resolvedTarget.element.getBoundingClientRect()
      return {
        rect: {
          x: roundNumber(rect.left + frameWindow.scrollX),
          y: roundNumber(rect.top + frameWindow.scrollY),
          width: roundNumber(rect.width),
          height: roundNumber(rect.height),
        },
        targetDescription: resolvedTarget.targetDescription,
      }
    }
  }
}

const getCaptureDocumentWidth = (
  root: Element,
  frameWindow: Window,
  viewportFallback?: PreviewEvidenceViewportFallback
): number => {
  const document = root.ownerDocument
  const rootRect = root.getBoundingClientRect()
  const viewport = getEffectiveViewportSize(frameWindow, viewportFallback)
  return Math.max(
    viewport.width,
    roundNumber(document.documentElement.scrollWidth),
    roundNumber(document.body.scrollWidth),
    roundNumber(rootRect.width),
    roundNumber(rootRect.right + frameWindow.scrollX)
  )
}

const getCaptureDocumentHeight = (
  root: Element,
  frameWindow: Window,
  viewportFallback?: PreviewEvidenceViewportFallback
): number => {
  const document = root.ownerDocument
  const rootRect = root.getBoundingClientRect()
  const viewport = getEffectiveViewportSize(frameWindow, viewportFallback)
  return Math.max(
    viewport.height,
    roundNumber(document.documentElement.scrollHeight),
    roundNumber(document.body.scrollHeight),
    roundNumber(rootRect.height),
    roundNumber(rootRect.bottom + frameWindow.scrollY)
  )
}

const resolvePreviewCanvasBackgroundColor = (
  frameDocument: Document,
  frameWindow: Window
): string => {
  const bodyColor = frameDocument.body
    ? frameWindow.getComputedStyle(frameDocument.body).backgroundColor
    : ''
  if (!isTransparentColor(bodyColor)) {
    return bodyColor
  }

  const documentElementColor = frameWindow.getComputedStyle(frameDocument.documentElement).backgroundColor
  if (!isTransparentColor(documentElementColor)) {
    return documentElementColor
  }

  return bodyColor || documentElementColor || 'transparent'
}

const cloneStyledElementTree = (element: Element, frameWindow: Window): Element | null => {
  if (isExcludedElement(element)) {
    return null
  }

  const clonedElement = element.cloneNode(false) as Element
  inlineComputedStyles(element, clonedElement, frameWindow)
  syncClonedControlState(element, clonedElement)

  for (const childNode of Array.from(element.childNodes)) {
    if (childNode.nodeType === Node.TEXT_NODE) {
      clonedElement.appendChild(
        element.ownerDocument.createTextNode(childNode.textContent ?? '')
      )
      continue
    }

    if (childNode.nodeType !== Node.ELEMENT_NODE) {
      continue
    }

    const clonedChild = cloneStyledElementTree(childNode as Element, frameWindow)
    if (clonedChild) {
      clonedElement.appendChild(clonedChild)
    }
  }

  return clonedElement
}

const inlineComputedStyles = (
  sourceElement: Element,
  clonedElement: Element,
  frameWindow: Window
) => {
  if (!(clonedElement instanceof HTMLElement) && !(clonedElement instanceof SVGElement)) {
    return
  }

  const computedStyle = frameWindow.getComputedStyle(sourceElement)
  const styleTarget = clonedElement.style
  for (const propertyName of Array.from(computedStyle)) {
    styleTarget.setProperty(
      propertyName,
      computedStyle.getPropertyValue(propertyName),
      computedStyle.getPropertyPriority(propertyName)
    )
  }
}

const syncClonedControlState = (sourceElement: Element, clonedElement: Element) => {
  if (sourceElement instanceof HTMLTextAreaElement && clonedElement instanceof HTMLTextAreaElement) {
    clonedElement.value = sourceElement.value
    clonedElement.textContent = sourceElement.value
    return
  }

  if (sourceElement instanceof HTMLInputElement && clonedElement instanceof HTMLInputElement) {
    clonedElement.value = sourceElement.value
    clonedElement.checked = sourceElement.checked
    if (sourceElement.checked) {
      clonedElement.setAttribute('checked', 'checked')
    } else {
      clonedElement.removeAttribute('checked')
    }
    return
  }

  if (sourceElement instanceof HTMLSelectElement && clonedElement instanceof HTMLSelectElement) {
    clonedElement.value = sourceElement.value
    const sourceOptions = Array.from(sourceElement.options)
    Array.from(clonedElement.options).forEach((option, index) => {
      option.selected = sourceOptions[index]?.selected ?? false
    })
  }
}

const resolvePreviewCaptureTarget = (
  root: Element,
  target?: PreviewEvidenceCaptureTarget
): { element: Element; targetDescription: string } | null => {
  if (!target) {
    return null
  }

  if (target.selector) {
    const element = root.querySelector(target.selector)
    if (!element || isExcludedElement(element)) {
      throw createTaggedPreviewCaptureError(
        'invalid-capture-target',
        `Preview region selector "${target.selector}" did not match a preview element.`
      )
    }

    return {
      element,
      targetDescription: `selector "${target.selector}"`,
    }
  }

  const candidates = [root, ...Array.from(root.querySelectorAll('*'))]
  const normalizedRole = target.role?.toLowerCase()
  const normalizedName = normalizeComparableText(target.name)
  const normalizedText = normalizeComparableText(target.text)
  const normalizedLabel = normalizeComparableText(target.label)

  const matchingCandidates = candidates.filter((candidate) =>
    matchesPreviewCaptureTargetCandidate(candidate, {
      normalizedRole,
      normalizedName,
      normalizedText,
      normalizedLabel,
    })
  )
  const matchingElement =
    matchingCandidates.find(
      (candidate) =>
        !matchingCandidates.some(
          (otherCandidate) => otherCandidate !== candidate && candidate.contains(otherCandidate)
        )
    ) ?? null

  if (!matchingElement) {
    throw createTaggedPreviewCaptureError(
      'invalid-capture-target',
      'Preview region accessibility target did not match a preview element.'
    )
  }

  return {
    element: matchingElement,
    targetDescription: describePreviewCaptureTarget(target),
  }
}

const matchesPreviewCaptureTargetCandidate = (
  candidate: Element,
  {
    normalizedRole,
    normalizedName,
    normalizedText,
    normalizedLabel,
  }: {
    normalizedRole?: string
    normalizedName?: string
    normalizedText?: string
    normalizedLabel?: string
  }
): boolean => {
  if (isExcludedElement(candidate)) {
    return false
  }

  if (normalizedRole && getElementRole(candidate) !== normalizedRole) {
    return false
  }

  if (normalizedName && !getElementAccessibleName(candidate).includes(normalizedName)) {
    return false
  }

  if (normalizedText && !getElementVisibleText(candidate).includes(normalizedText)) {
    return false
  }

  if (normalizedLabel && !getElementLabelText(candidate).includes(normalizedLabel)) {
    return false
  }

  return true
}

const describePreviewCaptureTarget = (target: PreviewEvidenceCaptureTarget): string =>
  [
    target.role ? `role=${target.role}` : null,
    target.name ? `name="${target.name}"` : null,
    target.text ? `text="${target.text}"` : null,
    target.label ? `label="${target.label}"` : null,
  ]
    .filter(Boolean)
    .join(' ')

const getElementRole = (element: Element): string => {
  const explicitRole = element.getAttribute('role')
  if (explicitRole) {
    return explicitRole.toLowerCase()
  }

  const tagName = element.tagName.toLowerCase()
  if (tagName === 'button') return 'button'
  if (tagName === 'a' && element.hasAttribute('href')) return 'link'
  if (tagName === 'textarea') return 'textbox'
  if (tagName === 'select') return 'combobox'
  if (tagName === 'option') return 'option'
  if (tagName === 'img') return 'img'
  if (/^h[1-6]$/.test(tagName)) return 'heading'
  if (tagName !== 'input') return tagName

  const input = element as HTMLInputElement
  switch (input.type) {
    case 'checkbox':
      return 'checkbox'
    case 'radio':
      return 'radio'
    case 'range':
      return 'slider'
    case 'button':
    case 'submit':
    case 'reset':
      return 'button'
    default:
      return 'textbox'
  }
}

const getElementAccessibleName = (element: Element): string => {
  const ariaLabel = element.getAttribute('aria-label')
  if (ariaLabel) {
    return normalizeComparableText(ariaLabel)
  }

  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '')
      .join(' ')
    if (text.trim()) {
      return normalizeComparableText(text)
    }
  }

  const labelText = getElementLabelText(element)
  if (labelText) {
    return labelText
  }

  const title = element.getAttribute('title')
  if (title) {
    return normalizeComparableText(title)
  }

  if (element instanceof HTMLInputElement && element.value) {
    return normalizeComparableText(element.value)
  }

  return getElementVisibleText(element)
}

const getElementLabelText = (element: Element): string => {
  if (!(element instanceof HTMLElement)) {
    return ''
  }

  const labels = isLabelableElement(element) ? Array.from(element.labels ?? []) : []
  if (labels.length > 0) {
    return normalizeComparableText(labels.map((label) => label.textContent ?? '').join(' '))
  }

  if (element.id) {
    const label = Array.from(element.ownerDocument.querySelectorAll('label[for]')).find(
      (candidate) => candidate.getAttribute('for') === element.id
    )
    if (label) {
      return normalizeComparableText(label.textContent ?? '')
    }
  }

  const wrappingLabel = element.closest('label')
  return wrappingLabel ? normalizeComparableText(wrappingLabel.textContent ?? '') : ''
}

const getElementVisibleText = (element: Element): string =>
  normalizeComparableText((element.textContent ?? '').replace(/\s+/g, ' '))

const normalizeComparableText = (value: string | undefined): string =>
  normalizeWhitespace(value ?? '').toLowerCase()

const isLabelableElement = (element: HTMLElement): element is LabelableElement =>
  element instanceof HTMLButtonElement ||
  element instanceof HTMLInputElement ||
  element instanceof HTMLMeterElement ||
  element instanceof HTMLOutputElement ||
  element instanceof HTMLProgressElement ||
  element instanceof HTMLSelectElement ||
  element instanceof HTMLTextAreaElement

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

const isTransparentColor = (value: string | undefined): boolean => {
  const normalized = normalizeComparableText(value)
  return (
    normalized.length === 0 ||
    normalized === 'transparent' ||
    /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(?:\.0+)?\s*\)$/.test(normalized)
  )
}

const truncateEvidenceValue = (value: string, maxLength: number): string =>
  value.length > maxLength ? `${value.slice(0, maxLength)}...` : value

const roundNumber = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }

  const rounded = Math.round(value * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}

function getEffectiveViewportSize(
  frameWindow: Window,
  viewportFallback?: PreviewEvidenceViewportFallback
): { width: number; height: number } {
  const document = frameWindow.document
  const normalizedFallback = normalizeViewportFallback(viewportFallback)

  return {
    width: Math.max(
      roundNumber(frameWindow.innerWidth),
      roundNumber(frameWindow.visualViewport?.width ?? 0),
      roundNumber(document.documentElement.clientWidth),
      roundNumber(document.body?.clientWidth ?? 0),
      normalizedFallback?.width ?? 0
    ),
    height: Math.max(
      roundNumber(frameWindow.innerHeight),
      roundNumber(frameWindow.visualViewport?.height ?? 0),
      roundNumber(document.documentElement.clientHeight),
      roundNumber(document.body?.clientHeight ?? 0),
      normalizedFallback?.height ?? 0
    ),
  }
}

function normalizeViewportFallback(
  viewportFallback?: PreviewEvidenceViewportFallback
): PreviewEvidenceViewportFallback | undefined {
  if (!viewportFallback) {
    return undefined
  }

  return {
    width: Math.max(1, roundNumber(viewportFallback.width)),
    height: Math.max(1, roundNumber(viewportFallback.height)),
  }
}

const createPreviewUnavailableFailure = (message: string): PreviewEvidenceCaptureFailure =>
  createPreviewCaptureFailure('preview-unavailable', message)

const createPreviewCaptureFailure = (
  code: PreviewEvidenceCaptureErrorCode,
  message: string
): PreviewEvidenceCaptureFailure => ({
  ok: false,
  error: {
    code,
    message,
  },
})

const createTaggedPreviewCaptureError = (
  code: PreviewEvidenceCaptureErrorCode,
  message: string
): Error & { code: PreviewEvidenceCaptureErrorCode } => Object.assign(new Error(message), { code })

const isTaggedPreviewCaptureError = (
  error: unknown
): error is Error & { code: PreviewEvidenceCaptureErrorCode } =>
  error instanceof Error &&
  (() => {
    const errorWithCode = error as Error & { code?: unknown }
    return (
      errorWithCode.code !== undefined &&
      errorWithCode.code !== null &&
      ['preview-unavailable', 'invalid-capture-target', 'render-timeout'].includes(
        String(errorWithCode.code)
      )
    )
  })()

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown frame access error'
