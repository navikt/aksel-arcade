import type { ArcadePageId } from '@/types/project'

export const PREVIEW_EVIDENCE_ROOT_SELECTOR = '#root'
export const MAX_PREVIEW_EVIDENCE_ELEMENTS = 200
export const MAX_PREVIEW_INTERACTION_STEPS = 10
export const MAX_PREVIEW_INTERACTION_TOTAL_TIME_MS = 10_000
export const MAX_PREVIEW_INTERACTION_WAIT_TIMEOUT_MS = 5_000
const MAX_PREVIEW_EVIDENCE_TEXT_LENGTH = 200
const MAX_PREVIEW_EVIDENCE_ATTRIBUTE_LENGTH = 200
const MAX_PREVIEW_EVIDENCE_CLASS_NAMES = 30
const DEFAULT_PREVIEW_INTERACTION_WAIT_TIMEOUT_MS = 1_500
const PREVIEW_INTERACTION_POLL_INTERVAL_MS = 16
const PREVIEW_INTERACTION_SETTLE_FRAMES = 2
const PREVIEW_INTERACTION_RENDER_IDLE_MS = 100
const PREVIEW_INTERACTION_PRINTABLE_KEY_PATTERN = /^[^\s]$/
const PREVIEW_INTERACTION_SUPPORTED_KEYS = new Set([
  'Enter',
  'Escape',
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Backspace',
  'Delete',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Space',
  ' ',
])

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
  overflowX?: string
  overflowY?: string
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

export interface PreviewEvidenceAccessibilityState {
  disabled?: boolean
  selected?: boolean
  expanded?: boolean
  checked?: boolean | 'mixed'
  current?: string | true
  pressed?: boolean | 'mixed'
}

export interface PreviewEvidenceAccessibilityNode {
  role: string
  name?: string
  level?: number
  focusable?: true
  states?: PreviewEvidenceAccessibilityState
  children?: PreviewEvidenceAccessibilityNode[]
}

export interface PreviewEvidenceAccessibility {
  rootSelector: typeof PREVIEW_EVIDENCE_ROOT_SELECTOR
  nodeCount: number
  truncated: boolean
  nodes: PreviewEvidenceAccessibilityNode[]
}

export type PreviewEvidenceLayer =
  | 'screenshot'
  | 'accessibility'
  | 'dom_layout_style'
  | 'frame'
export type PreviewInteractionAction =
  | 'click'
  | 'fill'
  | 'select'
  | 'press'
  | 'scroll'
  | 'waitFor'
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

export interface PreviewClickInteraction {
  action: 'click'
  target: PreviewEvidenceCaptureTarget
}

export interface PreviewFillInteraction {
  action: 'fill'
  target: PreviewEvidenceCaptureTarget
  value: string
}

export interface PreviewSelectInteraction {
  action: 'select'
  target: PreviewEvidenceCaptureTarget
  value?: string
  checked?: boolean
}

export interface PreviewPressInteraction {
  action: 'press'
  key: string
  target?: PreviewEvidenceCaptureTarget
}

export interface PreviewScrollInteraction {
  action: 'scroll'
  target?: PreviewEvidenceCaptureTarget
  x?: number
  y?: number
}

export interface PreviewWaitForInteraction {
  action: 'waitFor'
  text?: string
  target?: PreviewEvidenceCaptureTarget
  renderIdle?: boolean
  timeoutMs?: number
}

export type PreviewInteractionStep =
  | PreviewClickInteraction
  | PreviewFillInteraction
  | PreviewSelectInteraction
  | PreviewPressInteraction
  | PreviewScrollInteraction
  | PreviewWaitForInteraction

export interface PreviewInteractionExecutionRecord {
  index: number
  step: PreviewInteractionStep
  targetDescription?: string
}

export interface PreviewInteractionFailureDetails {
  index: number
  step: PreviewInteractionStep
  reason: string
  targetDescription?: string
}

export interface PreviewInteractionState {
  requested: PreviewInteractionStep[]
  executed: PreviewInteractionExecutionRecord[]
  failedStep?: PreviewInteractionFailureDetails
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
  interactions?: PreviewInteractionState
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
  captureMeta?: PreviewEvidenceCaptureMetadata
}

export interface PreviewEvidenceCaptureSuccess {
  ok: true
  evidence: PreviewEvidence
  accessibility?: PreviewEvidenceAccessibility
  screenshot?: PreviewEvidenceScreenshot
  captureMeta?: PreviewEvidenceCaptureMetadata
}

export type PreviewEvidenceCaptureResult =
  | PreviewEvidenceCaptureFailure
  | PreviewEvidenceCaptureSuccess

interface PreviewInteractionSequenceSuccess {
  ok: true
  interactionState: PreviewInteractionState
}

type PreviewInteractionSequenceResult =
  | PreviewInteractionSequenceSuccess
  | PreviewEvidenceCaptureFailure

interface SerializationState {
  capturedElementCount: number
  truncated: boolean
}

interface AccessibilitySerializationState {
  nodeCount: number
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

const serializePreviewAccessibility = (
  root: Element,
  frameWindow: Window = root.ownerDocument.defaultView ?? window
): PreviewEvidenceAccessibility => {
  const state: AccessibilitySerializationState = {
    nodeCount: 0,
    truncated: false,
  }
  const nodes = serializeAccessibilityNodes(root, frameWindow, state)

  return {
    rootSelector: PREVIEW_EVIDENCE_ROOT_SELECTOR,
    nodeCount: state.nodeCount,
    truncated: state.truncated,
    nodes,
  }
}

export const capturePreviewEvidenceSnapshot = (
  root: Element,
  {
    layers,
    screenshotScope = 'viewport',
    target,
    currentPageId = null,
    interactionState,
    viewportFallback,
  }: {
    layers?: PreviewEvidenceLayer[]
    screenshotScope?: PreviewEvidenceScreenshotScope
    target?: PreviewEvidenceCaptureTarget
    currentPageId?: ArcadePageId | null
    interactionState?: PreviewInteractionState
    viewportFallback?: PreviewEvidenceViewportFallback
  } = {},
  frameWindow: Window = root.ownerDocument.defaultView ?? window
): PreviewEvidenceCaptureResult => {
  try {
    const evidence = serializePreviewEvidence(root, frameWindow, viewportFallback)
    const normalizedLayers = layers ? [...layers] : []
    const screenshotRequested = normalizedLayers.includes('screenshot')
    const accessibilityRequested = normalizedLayers.includes('accessibility')
    const screenshot = screenshotRequested
      ? createPreviewScreenshot(root, { screenshotScope, target, viewportFallback }, frameWindow)
      : null
    const accessibility = accessibilityRequested
      ? serializePreviewAccessibility(root, frameWindow)
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
      ...(accessibility ? { accessibility } : {}),
      ...(screenshot ? { screenshot } : {}),
      captureMeta: {
        currentPageId,
        ...(screenshotRequested ? { screenshotScope } : {}),
        ...(screenshot?.targetDescription ? { targetDescription: screenshot.targetDescription } : {}),
        ...(interactionState ? { interactions: interactionState } : {}),
      },
    }
  } catch (error) {
    const code = isTaggedPreviewCaptureError(error) ? error.code : 'preview-unavailable'
    const message = getErrorMessage(error)
    return createPreviewCaptureFailure(
      code,
      code === 'preview-unavailable' ? `Preview evidence could not be captured: ${message}` : message,
      {
        ...(currentPageId !== null || interactionState
          ? {
              captureMeta: {
                ...(currentPageId !== null ? { currentPageId } : {}),
                ...(interactionState ? { interactions: interactionState } : {}),
              },
            }
          : {}),
      }
    )
  }
}

export const runPreviewInteractionSequence = async (
  root: Element,
  interactions: PreviewInteractionStep[],
  {
    currentPageId = null,
    getCurrentPageId,
    maxTotalTimeMs = MAX_PREVIEW_INTERACTION_TOTAL_TIME_MS,
  }: {
    currentPageId?: ArcadePageId | null
    getCurrentPageId?: () => ArcadePageId | null
    maxTotalTimeMs?: number
  } = {},
  frameWindow: Window = root.ownerDocument.defaultView ?? window
): Promise<PreviewInteractionSequenceResult> => {
  const requested = interactions.map(clonePreviewInteractionStep)
  const interactionState: PreviewInteractionState = {
    requested,
    executed: [],
  }

  if (requested.length === 0) {
    return {
      ok: true,
      interactionState,
    }
  }

  const deadline = Date.now() + Math.max(1, maxTotalTimeMs)

  for (const [index, step] of requested.entries()) {
    try {
      const targetDescription = await executePreviewInteractionStep(root, step, {
        deadline,
        frameWindow,
      })
      interactionState.executed.push({
        index,
        step,
        ...(targetDescription ? { targetDescription } : {}),
      })
    } catch (error) {
      const code = isTaggedPreviewCaptureError(error) ? error.code : 'invalid-capture-target'
      const reason = getErrorMessage(error)
      interactionState.failedStep = {
        index,
        step,
        reason,
      }
      return createPreviewCaptureFailure(code, reason, {
        captureMeta: {
          currentPageId: readCurrentPreviewInteractionPageId(currentPageId, getCurrentPageId),
          interactions: interactionState,
        },
      })
    }
  }

  return {
    ok: true,
    interactionState: {
      ...interactionState,
      requested,
      executed: [...interactionState.executed],
    },
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

const serializeAccessibilityNodes = (
  element: Element,
  frameWindow: Window,
  state: AccessibilitySerializationState
): PreviewEvidenceAccessibilityNode[] => {
  if (isExcludedElement(element) || isAccessibilityHidden(element, frameWindow) || state.truncated) {
    return []
  }

  const node = createAccessibilityNode(element)
  if (node) {
    if (state.nodeCount >= MAX_PREVIEW_EVIDENCE_ELEMENTS) {
      state.truncated = true
      return []
    }

    state.nodeCount += 1
  }

  const children: PreviewEvidenceAccessibilityNode[] = []
  for (const child of Array.from(element.children)) {
    if (state.truncated) {
      break
    }

    children.push(...serializeAccessibilityNodes(child, frameWindow, state))
  }

  if (!node) {
    return children
  }

  return [
    {
      ...node,
      ...(children.length > 0 ? { children } : {}),
    },
  ]
}

const createAccessibilityNode = (
  element: Element
): PreviewEvidenceAccessibilityNode | null => {
  const explicitlyNamed = hasExplicitAccessibleName(element)
  const name = getElementAccessibleName(element)
  const role = getElementAccessibilityRole(element, explicitlyNamed)
  const focusable = isElementFocusable(element)
  const level = getElementHeadingLevel(element)
  const states = getElementAccessibilityStates(element)

  if (!role && !focusable && level === undefined && states === undefined && !explicitlyNamed) {
    return null
  }

  return {
    role: role ?? 'generic',
    ...(name ? { name } : {}),
    ...(level !== undefined ? { level } : {}),
    ...(focusable ? { focusable: true } : {}),
    ...(states ? { states } : {}),
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
    const element = queryPreviewTargetSelector(root, target.selector)
    if (!element || isExcludedElement(element)) {
      throw createTaggedPreviewCaptureError(
        'invalid-capture-target',
        'Preview region selector target did not match a preview element.'
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

interface PreviewInteractionExecutionOptions {
  deadline: number
  frameWindow: Window
}

interface PreviewResolvedInteractionTarget {
  element: Element
  targetDescription: string
}

const executePreviewInteractionStep = async (
  root: Element,
  step: PreviewInteractionStep,
  { deadline, frameWindow }: PreviewInteractionExecutionOptions
): Promise<string | undefined> => {
  switch (step.action) {
    case 'click':
      return executePreviewClickInteraction(root, step, frameWindow)
    case 'fill':
      return executePreviewFillInteraction(root, step, frameWindow)
    case 'select':
      return executePreviewSelectInteraction(root, step, frameWindow)
    case 'press':
      return executePreviewPressInteraction(root, step, frameWindow)
    case 'scroll':
      return executePreviewScrollInteraction(root, step, frameWindow)
    case 'waitFor':
      return executePreviewWaitForInteraction(root, step, deadline, frameWindow)
  }
}

const executePreviewClickInteraction = async (
  root: Element,
  step: PreviewClickInteraction,
  frameWindow: Window
): Promise<string> => {
  const target = resolvePreviewInteractionTarget(root, step.target, 'click')
  assertPreviewInteractionNavigationAllowed(target.element)
  focusPreviewInteractionElement(target.element)
  triggerPreviewClick(target.element)
  await settleAfterPreviewInteraction(frameWindow)
  return target.targetDescription
}

const executePreviewFillInteraction = async (
  root: Element,
  step: PreviewFillInteraction,
  frameWindow: Window
): Promise<string> => {
  const target = resolvePreviewInteractionTarget(root, step.target, 'fill')
  const input = resolveFillInteractionElement(target.element)
  focusPreviewInteractionElement(input)
  setFormControlValue(input, step.value)
  dispatchInputEvents(input)
  await settleAfterPreviewInteraction(frameWindow)
  return target.targetDescription
}

const executePreviewSelectInteraction = async (
  root: Element,
  step: PreviewSelectInteraction,
  frameWindow: Window
): Promise<string> => {
  const target = resolvePreviewInteractionTarget(root, step.target, 'select')
  const control = resolveSelectableInteractionElement(target.element)

  if (control instanceof HTMLSelectElement) {
    if (typeof step.value !== 'string') {
      throw createTaggedPreviewCaptureError(
        'invalid-capture-target',
        'Select interactions targeting a combobox/select control require a string value.'
      )
    }

    const option = Array.from(control.options).find((candidate) => candidate.value === step.value)
    if (!option) {
      throw createTaggedPreviewCaptureError(
        'invalid-capture-target',
        'Select interaction value did not match an available option.'
      )
    }
    setFormControlValue(control, step.value)
    Array.from(control.options).forEach((candidate) => {
      candidate.selected = candidate.value === step.value
    })
    dispatchInputEvents(control)
    await settleAfterPreviewInteraction(frameWindow)
    return target.targetDescription
  }

  if (typeof step.checked !== 'boolean') {
    throw createTaggedPreviewCaptureError(
      'invalid-capture-target',
      'Select interactions targeting checkbox/radio controls require a checked boolean.'
    )
  }

  if (control instanceof HTMLInputElement && control.type === 'radio' && !step.checked) {
    throw createTaggedPreviewCaptureError(
      'invalid-capture-target',
      'Radio controls may only be selected with checked=true during Preview interactions.'
    )
  }

  setFormControlChecked(control, step.checked)
  dispatchInputEvents(control)
  await settleAfterPreviewInteraction(frameWindow)
  return target.targetDescription
}

const executePreviewPressInteraction = async (
  root: Element,
  step: PreviewPressInteraction,
  frameWindow: Window
): Promise<string | undefined> => {
  const normalizedKey = normalizePreviewInteractionKey(step.key)
  const target = step.target
    ? resolvePreviewInteractionTarget(root, step.target, 'press')
    : undefined
  const element = resolvePressInteractionElement(root, target?.element)

  if (!element) {
    throw createTaggedPreviewCaptureError(
      'invalid-capture-target',
      'Press interactions require a focusable Preview element target or an existing focused Preview element.'
    )
  }

  focusPreviewInteractionElement(element)
  dispatchKeyboardInteraction(element, normalizedKey, root, frameWindow)
  await settleAfterPreviewInteraction(frameWindow)
  return target?.targetDescription
}

const executePreviewScrollInteraction = async (
  root: Element,
  step: PreviewScrollInteraction,
  frameWindow: Window
): Promise<string | undefined> => {
  const deltaX = normalizePreviewInteractionNumber(step.x)
  const deltaY = normalizePreviewInteractionNumber(step.y)

  if (deltaX === 0 && deltaY === 0) {
    throw createTaggedPreviewCaptureError(
      'invalid-capture-target',
      'Scroll interactions require a non-zero x or y delta.'
    )
  }

  const target = step.target
    ? resolvePreviewInteractionTarget(root, step.target, 'scroll')
    : undefined

  if (target?.element instanceof HTMLElement) {
    target.element.scrollLeft += deltaX
    target.element.scrollTop += deltaY
    target.element.dispatchEvent(new Event('scroll', { bubbles: true }))
  } else if (typeof frameWindow.scrollTo === 'function') {
    frameWindow.scrollTo(frameWindow.scrollX + deltaX, frameWindow.scrollY + deltaY)
  }

  await settleAfterPreviewInteraction(frameWindow)
  return target?.targetDescription
}

const executePreviewWaitForInteraction = async (
  root: Element,
  step: PreviewWaitForInteraction,
  deadline: number,
  frameWindow: Window
): Promise<string | undefined> => {
  const timeoutMs = getPreviewInteractionWaitTimeout(step.timeoutMs, deadline)

  if (step.renderIdle) {
    await waitForPreviewRenderIdle(root, timeoutMs, frameWindow)
    return 'renderIdle'
  }

  if (typeof step.text === 'string') {
    const normalizedText = normalizeComparableText(step.text)
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
      if (normalizeComparableText(getElementVisibleText(root)).includes(normalizedText)) {
        return `text="${step.text}"`
      }
      await waitForPreviewInteractionTick(frameWindow)
    }
    throw createTaggedPreviewCaptureError(
      'render-timeout',
      'Preview waitFor text matcher timed out before the state appeared.'
    )
  }

  if (!step.target) {
    throw createTaggedPreviewCaptureError(
      'invalid-capture-target',
      'waitFor interactions require text, target, or renderIdle.'
    )
  }

  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const resolvedTarget = tryResolvePreviewInteractionTarget(root, step.target, 'waitFor')
    if (resolvedTarget) {
      return resolvedTarget.targetDescription
    }
    await waitForPreviewInteractionTick(frameWindow)
  }

  throw createTaggedPreviewCaptureError(
    'render-timeout',
    `Preview waitFor ${describePreviewCaptureTargetMatcher(step.target)} timed out before the state appeared.`
  )
}

const resolvePreviewInteractionTarget = (
  root: Element,
  target: PreviewEvidenceCaptureTarget,
  kind: 'click' | 'fill' | 'select' | 'press' | 'scroll' | 'waitFor'
): PreviewResolvedInteractionTarget => {
  const resolved = tryResolvePreviewInteractionTarget(root, target, kind)
  if (!resolved) {
    throw createTaggedPreviewCaptureError(
      'invalid-capture-target',
      `Preview interaction ${describePreviewCaptureTargetMatcher(target)} did not match a Preview element.`
    )
  }
  return resolved
}

const tryResolvePreviewInteractionTarget = (
  root: Element,
  target: PreviewEvidenceCaptureTarget,
  kind: 'click' | 'fill' | 'select' | 'press' | 'scroll' | 'waitFor'
): PreviewResolvedInteractionTarget | null => {
  if (target.selector) {
    const element = queryPreviewTargetSelector(root, target.selector)
    if (!element || isExcludedElement(element)) {
      return null
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

  const matchingCandidates = candidates
    .filter((candidate) =>
      matchesPreviewCaptureTargetCandidate(candidate, {
        normalizedRole,
        normalizedName,
        normalizedText,
        normalizedLabel,
      })
    )
    .sort((left, right) => {
      const scoreDifference =
        getPreviewInteractionTargetScore(right, kind) - getPreviewInteractionTargetScore(left, kind)
      if (scoreDifference !== 0) {
        return scoreDifference
      }
      return getPreviewTargetDepth(right) - getPreviewTargetDepth(left)
    })

  const matchingElement = matchingCandidates[0] ?? null
  if (!matchingElement) {
    return null
  }

  return {
    element: matchingElement,
    targetDescription: describePreviewCaptureTarget(target),
  }
}

const getPreviewInteractionTargetScore = (
  element: Element,
  kind: 'click' | 'fill' | 'select' | 'press' | 'scroll' | 'waitFor'
): number => {
  let score = getPreviewTargetDepth(element)
  if (element instanceof HTMLLabelElement) {
    score -= 20
  }

  const role = getElementRole(element)
  if (role !== 'generic') {
    score += 10
  }

  if (isElementFocusable(element)) {
    score += 25
  }

  switch (kind) {
    case 'click':
      if (isElementClickable(element)) score += 80
      break
    case 'fill':
      if (isFillableInteractionElement(element)) score += 120
      break
    case 'select':
      if (isSelectableInteractionElement(element)) score += 120
      break
    case 'press':
      if (isElementFocusable(element)) score += 80
      break
    case 'scroll':
      if (element instanceof HTMLElement) score += 20
      break
    case 'waitFor':
      if (role !== 'generic' || isElementFocusable(element)) score += 20
      break
  }

  return score
}

const getPreviewTargetDepth = (element: Element): number => {
  let depth = 0
  let current: Element | null = element
  while (current) {
    depth += 1
    current = current.parentElement
  }
  return depth
}

const queryPreviewTargetSelector = (root: Element, selector: string): Element | null => {
  try {
    return root.matches(selector) ? root : root.querySelector(selector)
  } catch {
    throw createTaggedPreviewCaptureError(
      'invalid-capture-target',
      'Preview selector target is not a valid CSS selector.'
    )
  }
}

const resolveFillInteractionElement = (element: Element): HTMLInputElement | HTMLTextAreaElement => {
  const control = resolveAssociatedInteractionControl(element)
  if (control && isFillableInteractionElement(control)) {
    return control
  }

  throw createTaggedPreviewCaptureError(
    'invalid-capture-target',
    'Fill interactions require a text input or textarea inside the Preview.'
  )
}

const resolveSelectableInteractionElement = (
  element: Element
): HTMLInputElement | HTMLSelectElement => {
  const control = resolveAssociatedInteractionControl(element)
  if (control && isSelectableInteractionElement(control)) {
    return control
  }

  throw createTaggedPreviewCaptureError(
    'invalid-capture-target',
    'Select interactions require a select, radio, or checkbox control inside the Preview.'
  )
}

const resolvePressInteractionElement = (
  root: Element,
  element?: Element
): HTMLElement | null => {
  const candidate =
    element ??
    (root.ownerDocument.activeElement instanceof HTMLElement &&
    root.contains(root.ownerDocument.activeElement)
      ? root.ownerDocument.activeElement
      : getFocusablePreviewElements(root)[0] ?? null)

  if (!candidate) {
    return null
  }

  const control = resolveAssociatedInteractionControl(candidate)
  return control instanceof HTMLElement ? control : candidate instanceof HTMLElement ? candidate : null
}

const resolveAssociatedInteractionControl = (
  element: Element
): Element | null => {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element
  }

  if (element instanceof HTMLSelectElement) {
    return element
  }

  if (element instanceof HTMLOptionElement) {
    return element.parentElement instanceof HTMLSelectElement ? element.parentElement : null
  }

  if (element instanceof HTMLLabelElement) {
    const labelControl = element.control
    if (labelControl) {
      return labelControl
    }
  }

  return (
    element.querySelector('input, textarea, select, [contenteditable="true"]') ??
    (element.closest('label') instanceof HTMLLabelElement ? element.closest('label')?.control : null) ??
    element
  )
}

const isFillableInteractionElement = (
  element: Element
): element is HTMLInputElement | HTMLTextAreaElement => {
  if (element instanceof HTMLTextAreaElement) {
    return !element.disabled && !element.readOnly
  }

  if (!(element instanceof HTMLInputElement)) {
    return false
  }

  return (
    !element.disabled &&
    !element.readOnly &&
    ['text', 'search', 'email', 'url', 'tel', 'password', 'number', ''].includes(element.type)
  )
}

const isSelectableInteractionElement = (
  element: Element
): element is HTMLInputElement | HTMLSelectElement => {
  if (element instanceof HTMLSelectElement) {
    return !element.disabled
  }

  return (
    element instanceof HTMLInputElement &&
    !element.disabled &&
    (element.type === 'checkbox' || element.type === 'radio')
  )
}

const isElementClickable = (element: Element): boolean =>
  element instanceof HTMLElement &&
  (typeof element.onclick === 'function' ||
    ['button', 'a', 'summary', 'label'].includes(element.tagName.toLowerCase()) ||
    element.getAttribute('role') === 'button')

const focusPreviewInteractionElement = (element: Element) => {
  if (element instanceof HTMLElement || element instanceof SVGElement) {
    element.focus()
  }
}

const triggerPreviewClick = (element: Element) => {
  if (element instanceof HTMLElement) {
    element.click()
    return
  }

  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
}

const dispatchKeyboardInteraction = (
  element: HTMLElement,
  key: string,
  root: Element,
  frameWindow: Window
) => {
  const keydownEvent = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  })
  const keydownAccepted = element.dispatchEvent(keydownEvent)

  if (keydownAccepted) {
    if (key === 'Tab') {
      movePreviewFocus(root, element)
    } else if (key === 'Enter' || key === ' ' || key === 'Space') {
      if (isElementClickable(element)) {
        assertPreviewInteractionNavigationAllowed(element)
        triggerPreviewClick(element)
      }
    } else if (PREVIEW_INTERACTION_PRINTABLE_KEY_PATTERN.test(key)) {
      if (isFillableInteractionElement(element)) {
        setFormControlValue(element, `${element.value}${key}`)
        dispatchInputEvents(element)
      }
    } else if (key === 'Backspace' && isFillableInteractionElement(element)) {
      setFormControlValue(element, element.value.slice(0, -1))
      dispatchInputEvents(element)
    }
  }

  element.dispatchEvent(
    new KeyboardEvent('keyup', {
      key,
      bubbles: true,
      cancelable: true,
    })
  )

  if (key === 'PageDown' || key === 'ArrowDown') {
    frameWindow.dispatchEvent(new Event('scroll'))
  }
}

const movePreviewFocus = (root: Element, currentElement: HTMLElement) => {
  const focusableElements = getFocusablePreviewElements(root)
  if (focusableElements.length === 0) {
    return
  }

  const currentIndex = focusableElements.indexOf(currentElement)
  const nextElement = focusableElements[(currentIndex + 1 + focusableElements.length) % focusableElements.length]
  nextElement.focus()
}

const getFocusablePreviewElements = (root: Element): HTMLElement[] =>
  [root, ...Array.from(root.querySelectorAll('*'))].filter(
    (candidate): candidate is HTMLElement =>
      candidate instanceof HTMLElement && isElementFocusable(candidate) && !isElementDisabled(candidate)
  )

const setFormControlValue = (
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
) => {
  const prototype = Object.getPrototypeOf(element) as Record<string, unknown>
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
  if (descriptor?.set) {
    descriptor.set.call(element, value)
  } else {
    element.value = value
  }
}

const setFormControlChecked = (element: HTMLInputElement, checked: boolean) => {
  const prototype = Object.getPrototypeOf(element) as Record<string, unknown>
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'checked')
  if (descriptor?.set) {
    descriptor.set.call(element, checked)
  } else {
    element.checked = checked
  }
}

const dispatchInputEvents = (element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
  element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
  element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
}

const normalizePreviewInteractionKey = (key: string): string => {
  const normalizedKey = key.trim()
  if (
    PREVIEW_INTERACTION_SUPPORTED_KEYS.has(normalizedKey) ||
    PREVIEW_INTERACTION_PRINTABLE_KEY_PATTERN.test(normalizedKey)
  ) {
    return normalizedKey
  }

  throw createTaggedPreviewCaptureError(
    'invalid-capture-target',
    'Preview press key is not supported for bounded Preview interactions.'
  )
}

const normalizePreviewInteractionNumber = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

const assertPreviewInteractionNavigationAllowed = (element: Element) => {
  const anchor = element.closest('a')
  if (!anchor) {
    return
  }

  const href = anchor.getAttribute('href')
  const to = anchor.getAttribute('to')
  const targetPageId = href ?? to
  if (targetPageId && /^page\d+$/.test(targetPageId)) {
    return
  }

  throw createTaggedPreviewCaptureError(
    'invalid-capture-target',
    'Preview interactions block browser/external navigation targets. Only in-prototype Arcade page references are allowed.'
  )
}

const waitForPreviewRenderIdle = async (
  root: Element,
  timeoutMs: number,
  frameWindow: Window
) => {
  const startedAt = Date.now()
  let lastMutationAt = startedAt
  const observer = new MutationObserver(() => {
    lastMutationAt = Date.now()
  })

  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  })

  try {
    while (Date.now() - startedAt < timeoutMs) {
      if (Date.now() - lastMutationAt >= PREVIEW_INTERACTION_RENDER_IDLE_MS) {
        return
      }
      await waitForPreviewInteractionTick(frameWindow)
    }
  } finally {
    observer.disconnect()
  }

  throw createTaggedPreviewCaptureError(
    'render-timeout',
    'Preview waitFor renderIdle timed out before the render settled.'
  )
}

const settleAfterPreviewInteraction = async (frameWindow: Window) => {
  for (let index = 0; index < PREVIEW_INTERACTION_SETTLE_FRAMES; index += 1) {
    await waitForPreviewInteractionTick(frameWindow)
  }
}

const waitForPreviewInteractionTick = (frameWindow: Window): Promise<void> =>
  new Promise((resolve) => {
    frameWindow.setTimeout(resolve, PREVIEW_INTERACTION_POLL_INTERVAL_MS)
  })

const getPreviewInteractionWaitTimeout = (
  timeoutMs: number | undefined,
  deadline: number
): number => {
  const remainingBudget = Math.max(1, deadline - Date.now())
  const requestedTimeout =
    typeof timeoutMs === 'number' && Number.isFinite(timeoutMs)
      ? Math.max(1, Math.min(timeoutMs, MAX_PREVIEW_INTERACTION_WAIT_TIMEOUT_MS))
      : DEFAULT_PREVIEW_INTERACTION_WAIT_TIMEOUT_MS

  return Math.max(1, Math.min(requestedTimeout, remainingBudget))
}

const readCurrentPreviewInteractionPageId = (
  currentPageId: ArcadePageId | null,
  getCurrentPageId?: () => ArcadePageId | null
): ArcadePageId | null => {
  if (!getCurrentPageId) {
    return currentPageId
  }

  try {
    return getCurrentPageId()
  } catch {
    return currentPageId
  }
}

const clonePreviewInteractionStep = (step: PreviewInteractionStep): PreviewInteractionStep => {
  const base = {
    ...step,
  } as PreviewInteractionStep

  if ('target' in step && step.target) {
    base.target = { ...step.target }
  }

  return base
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

  if (
    normalizedName &&
    !normalizeComparableText(getElementAccessibleName(candidate)).includes(normalizedName)
  ) {
    return false
  }

  if (
    normalizedText &&
    !normalizeComparableText(getElementVisibleText(candidate)).includes(normalizedText)
  ) {
    return false
  }

  if (
    normalizedLabel &&
    !normalizeComparableText(getElementLabelText(candidate)).includes(normalizedLabel)
  ) {
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

const describePreviewCaptureTargetMatcher = (target: PreviewEvidenceCaptureTarget): string => {
  if (target.selector) {
    return 'selector target'
  }

  const parts = [
    target.role ? 'role' : null,
    target.name ? 'name' : null,
    target.text ? 'text' : null,
    target.label ? 'label' : null,
  ].filter(Boolean)

  return parts.length > 0 ? `${parts.join('+')} target` : 'target'
}

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
    return normalizeWhitespace(ariaLabel)
  }

  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => {
        const referencedElement = element.ownerDocument.getElementById(id)
        return referencedElement ? getElementVisibleText(referencedElement) : ''
      })
      .join(' ')
    if (text.trim()) {
      return normalizeWhitespace(text)
    }
  }

  const altText = getElementAltText(element)
  if (altText) {
    return altText
  }

  const labelText = getElementLabelText(element)
  if (labelText) {
    return labelText
  }

  const title = element.getAttribute('title')
  if (title) {
    return normalizeWhitespace(title)
  }

  if (element instanceof HTMLInputElement && inputUsesValueAsAccessibleName(element) && element.value) {
    return normalizeWhitespace(element.value)
  }

  return elementUsesContentAsAccessibleName(element) ? getElementVisibleText(element) : ''
}

const hasExplicitAccessibleName = (element: Element): boolean =>
  element.hasAttribute('aria-label') ||
  element.hasAttribute('aria-labelledby') ||
  getElementAltText(element).length > 0 ||
  element.hasAttribute('title') ||
  getElementLabelText(element).length > 0 ||
  (element instanceof HTMLInputElement &&
    inputUsesValueAsAccessibleName(element) &&
    normalizeWhitespace(element.value).length > 0)

const getElementLabelText = (element: Element): string => {
  if (!(element instanceof HTMLElement)) {
    return ''
  }

  if (!isLabelableElement(element)) {
    return ''
  }

  const labels = Array.from(element.labels ?? [])
  if (labels.length > 0) {
    return normalizeWhitespace(labels.map((label) => getElementVisibleText(label)).join(' '))
  }

  if (element.id) {
    const label = Array.from(element.ownerDocument.querySelectorAll('label[for]')).find(
      (candidate) => candidate.getAttribute('for') === element.id
    )
    if (label) {
      return getElementVisibleText(label)
    }
  }

  const wrappingLabel = element.closest('label')
  return wrappingLabel ? getElementVisibleText(wrappingLabel) : ''
}

const getElementVisibleText = (element: Element): string =>
  normalizeWhitespace(getSanitizedSubtreeText(element))

const getSanitizedSubtreeText = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? ''
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element
    if (
      isExcludedElement(element) ||
      element.getAttribute('aria-hidden') === 'true' ||
      element.hasAttribute('hidden')
    ) {
      return ''
    }
  }

  return Array.from(node.childNodes)
    .map((child) => getSanitizedSubtreeText(child))
    .join(' ')
}

const getElementAltText = (element: Element): string => {
  if (element instanceof HTMLImageElement) {
    return normalizeWhitespace(element.getAttribute('alt') ?? '')
  }

  if (element instanceof HTMLInputElement && element.type === 'image') {
    return normalizeWhitespace(element.getAttribute('alt') ?? '')
  }

  return ''
}

const inputUsesValueAsAccessibleName = (input: HTMLInputElement): boolean =>
  input.type === 'button' || input.type === 'submit' || input.type === 'reset'

const elementUsesContentAsAccessibleName = (element: Element): boolean => {
  const explicitRole = element.getAttribute('role')?.trim().toLowerCase()
  if (explicitRole) {
    return (
      explicitRole === 'button' ||
      explicitRole === 'cell' ||
      explicitRole === 'checkbox' ||
      explicitRole === 'columnheader' ||
      explicitRole === 'gridcell' ||
      explicitRole === 'heading' ||
      explicitRole === 'link' ||
      explicitRole === 'menuitem' ||
      explicitRole === 'menuitemcheckbox' ||
      explicitRole === 'menuitemradio' ||
      explicitRole === 'option' ||
      explicitRole === 'radio' ||
      explicitRole === 'rowheader' ||
      explicitRole === 'switch' ||
      explicitRole === 'tab' ||
      explicitRole === 'tooltip' ||
      explicitRole === 'treeitem'
    )
  }

  const tagName = element.tagName.toLowerCase()
  if (/^h[1-6]$/.test(tagName)) {
    return true
  }

  if (tagName === 'button' || tagName === 'option' || tagName === 'summary') {
    return true
  }

  return tagName === 'a' && element.hasAttribute('href')
}

const normalizeComparableText = (value: string | undefined): string =>
  normalizeWhitespace(value ?? '').toLowerCase()

const getElementAccessibilityRole = (
  element: Element,
  explicitlyNamed: boolean
): string | undefined => {
  const explicitRole = element.getAttribute('role')?.trim().toLowerCase()
  if (explicitRole) {
    return explicitRole === 'none' || explicitRole === 'presentation' ? undefined : explicitRole
  }

  const tagName = element.tagName.toLowerCase()
  switch (tagName) {
    case 'a':
      return element.hasAttribute('href') ? 'link' : undefined
    case 'article':
      return 'article'
    case 'aside':
      return 'complementary'
    case 'button':
      return 'button'
    case 'dialog':
      return 'dialog'
    case 'footer':
      return 'contentinfo'
    case 'form':
      return explicitlyNamed ? 'form' : undefined
    case 'header':
      return 'banner'
    case 'img':
      return 'img'
    case 'li':
      return 'listitem'
    case 'main':
      return 'main'
    case 'meter':
      return 'meter'
    case 'nav':
      return 'navigation'
    case 'ol':
    case 'ul':
      return 'list'
    case 'option':
      return 'option'
    case 'progress':
      return 'progressbar'
    case 'section':
      return explicitlyNamed ? 'region' : undefined
    case 'select':
      return element instanceof HTMLSelectElement && (element.multiple || element.size > 1)
        ? 'listbox'
        : 'combobox'
    case 'summary':
      return 'button'
    case 'table':
      return 'table'
    case 'textarea':
      return 'textbox'
    case 'tr':
      return 'row'
  }

  if (/^h[1-6]$/.test(tagName)) {
    return 'heading'
  }

  if (tagName !== 'input') {
    return undefined
  }

  const input = element as HTMLInputElement
  switch (input.type) {
    case 'button':
    case 'submit':
    case 'reset':
      return 'button'
    case 'checkbox':
      return 'checkbox'
    case 'hidden':
      return undefined
    case 'number':
      return 'spinbutton'
    case 'radio':
      return 'radio'
    case 'range':
      return 'slider'
    case 'search':
      return 'searchbox'
    default:
      return 'textbox'
  }
}

const getElementHeadingLevel = (element: Element): number | undefined => {
  const tagName = element.tagName.toLowerCase()
  if (/^h[1-6]$/.test(tagName)) {
    return Number(tagName.slice(1))
  }

  const role = element.getAttribute('role')?.trim().toLowerCase()
  if (role !== 'heading') {
    return undefined
  }

  const ariaLevel = Number(element.getAttribute('aria-level'))
  return Number.isInteger(ariaLevel) && ariaLevel > 0 ? ariaLevel : undefined
}

const getElementAccessibilityStates = (
  element: Element
): PreviewEvidenceAccessibilityState | undefined => {
  const states = removeUndefinedAccessibilityStates({
    disabled: getElementDisabledState(element),
    selected: getElementSelectedState(element),
    expanded: getElementExpandedState(element),
    checked: getElementCheckedState(element),
    current: getElementCurrentState(element),
    pressed: getElementPressedState(element),
  })

  return Object.keys(states).length > 0 ? states : undefined
}

const getElementDisabledState = (element: Element): boolean | undefined => {
  const ariaDisabled = element.getAttribute('aria-disabled')
  if (ariaDisabled === 'true') {
    return true
  }

  return isElementDisabled(element) ? true : undefined
}

const getElementSelectedState = (element: Element): boolean | undefined => {
  const ariaSelected = element.getAttribute('aria-selected')
  if (ariaSelected === 'true' || ariaSelected === 'false') {
    return ariaSelected === 'true'
  }

  return element.tagName.toLowerCase() === 'option'
    ? (element as HTMLOptionElement).selected
    : undefined
}

const getElementExpandedState = (element: Element): boolean | undefined => {
  const ariaExpanded = element.getAttribute('aria-expanded')
  if (ariaExpanded === 'true' || ariaExpanded === 'false') {
    return ariaExpanded === 'true'
  }

  return element.tagName.toLowerCase() === 'details'
    ? (element as HTMLDetailsElement).open
    : undefined
}

const getElementCheckedState = (
  element: Element
): PreviewEvidenceAccessibilityState['checked'] | undefined => {
  const ariaChecked = element.getAttribute('aria-checked')
  if (ariaChecked === 'mixed') {
    return 'mixed'
  }

  if (ariaChecked === 'true' || ariaChecked === 'false') {
    return ariaChecked === 'true'
  }

  if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
    return element.indeterminate ? 'mixed' : element.checked
  }

  return undefined
}

const getElementCurrentState = (
  element: Element
): PreviewEvidenceAccessibilityState['current'] | undefined => {
  const ariaCurrent = element.getAttribute('aria-current')?.trim().toLowerCase()
  if (!ariaCurrent || ariaCurrent === 'false') {
    return undefined
  }

  return ariaCurrent === 'true' ? true : ariaCurrent
}

const getElementPressedState = (
  element: Element
): PreviewEvidenceAccessibilityState['pressed'] | undefined => {
  const ariaPressed = element.getAttribute('aria-pressed')
  if (ariaPressed === 'mixed') {
    return 'mixed'
  }

  if (ariaPressed === 'true' || ariaPressed === 'false') {
    return ariaPressed === 'true'
  }

  return undefined
}

const removeUndefinedAccessibilityStates = (
  states: PreviewEvidenceAccessibilityState
): PreviewEvidenceAccessibilityState =>
  Object.fromEntries(
    Object.entries(states).filter(([, value]) => value !== undefined)
  ) as PreviewEvidenceAccessibilityState

const isLabelableElement = (element: HTMLElement): element is LabelableElement => {
  const tagName = element.tagName.toLowerCase()
  return (
    tagName === 'button' ||
    tagName === 'input' ||
    tagName === 'meter' ||
    tagName === 'output' ||
    tagName === 'progress' ||
    tagName === 'select' ||
    tagName === 'textarea'
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
    overflowX: style.overflowX,
    overflowY: style.overflowY,
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

const isAccessibilityHidden = (element: Element, frameWindow: Window): boolean => {
  if (element.getAttribute('aria-hidden') === 'true' || element.hasAttribute('hidden')) {
    return true
  }

  if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
    return false
  }

  const computedStyle = frameWindow.getComputedStyle(element)
  return computedStyle.display === 'none' || computedStyle.visibility === 'hidden'
}

const isElementFocusable = (element: Element): boolean => {
  if (isElementDisabled(element)) {
    return false
  }

  if (element instanceof HTMLAnchorElement) {
    return element.hasAttribute('href')
  }

  if (element instanceof HTMLButtonElement) {
    return true
  }

  if (element instanceof HTMLInputElement) {
    return element.type !== 'hidden'
  }

  if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
    return true
  }

  if (element.tagName.toLowerCase() === 'summary') {
    return true
  }

  if (element instanceof HTMLElement || element instanceof SVGElement) {
    if (element.tabIndex >= 0) {
      return true
    }

    const contentEditable = element.getAttribute('contenteditable')
    return Boolean(contentEditable && contentEditable.toLowerCase() !== 'false')
  }

  return false
}

const isElementDisabled = (element: Element): boolean => {
  const tagName = element.tagName.toLowerCase()
  switch (tagName) {
    case 'button':
    case 'fieldset':
    case 'input':
    case 'optgroup':
    case 'option':
    case 'select':
    case 'textarea':
      return (element as
        | HTMLButtonElement
        | HTMLFieldSetElement
        | HTMLInputElement
        | HTMLOptGroupElement
        | HTMLOptionElement
        | HTMLSelectElement
        | HTMLTextAreaElement).disabled
    default:
      return false
  }
}

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
  message: string,
  extras: Omit<PreviewEvidenceCaptureFailure, 'ok' | 'error'> = {}
): PreviewEvidenceCaptureFailure => ({
  ok: false,
  error: {
    code,
    message,
  },
  ...extras,
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
