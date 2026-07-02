import type { AnnotationTargetSnapshot } from '@/services/annotations'
import type { AnnotationTargetIdentity } from '@/types/annotations'
import {
  getElementAccessibleName as getSharedElementAccessibleName,
  getElementRole as getSharedElementRole,
  getVisibleText,
  isExcludedElement,
  normalizeWhitespace,
} from './domAccessibility'

export type AnnotationTargetResolutionStatus = 'resolved' | 'hidden' | 'dead' | 'no-target'
export type AnnotationTargetRequestMode = 'point' | 'rect' | 'identity' | 'group'

export interface AnnotationTargetRect {
  x: number
  y: number
  width: number
  height: number
}

export interface AnnotationTargetPointRequest {
  mode: 'point'
  x: number
  y: number
  selectedText?: string
}

export interface AnnotationTargetRectRequest {
  mode: 'rect'
  rect: AnnotationTargetRect
}

export interface AnnotationTargetIdentityRequest {
  mode: 'identity'
  identity: AnnotationTargetIdentity
}

export interface AnnotationTargetGroupRequest {
  mode: 'group'
  identities: AnnotationTargetIdentity[]
}

export type AnnotationTargetResolutionRequest =
  | AnnotationTargetPointRequest
  | AnnotationTargetRectRequest
  | AnnotationTargetIdentityRequest
  | AnnotationTargetGroupRequest

export interface ResolvedAnnotationTarget {
  identity: AnnotationTargetIdentity
  snapshot: AnnotationTargetSnapshot
  visibility: 'visible' | 'hidden'
}

export interface AnnotationTargetResolutionResult {
  status: AnnotationTargetResolutionStatus
  target?: ResolvedAnnotationTarget
  targets?: ResolvedAnnotationTarget[]
  reason?: 'empty-selection' | 'no-match' | 'ambiguous-match' | 'partial-group'
  matchCount?: number
}

export const isAnnotationTargetResolutionRequest = (
  value: unknown
): value is AnnotationTargetResolutionRequest => {
  if (!isRecord(value) || typeof value.mode !== 'string') {
    return false
  }

  switch (value.mode) {
    case 'point':
      return (
        isFiniteNumber(value.x) &&
        isFiniteNumber(value.y) &&
        optionalString(value.selectedText)
      )
    case 'rect':
      return isAnnotationTargetRect(value.rect)
    case 'identity':
      return isAnnotationTargetIdentity(value.identity)
    case 'group':
      return Array.isArray(value.identities) && value.identities.every(isAnnotationTargetIdentity)
    default:
      return false
  }
}

const INTERACTIVE_TARGET_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'textarea',
  'select',
  'option',
  'label',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[onclick]',
].join(',')
const COMPONENT_INTERNAL_TARGET_SELECTOR = [
  '.aksel-inline-message__icon',
  '.aksel-inline-message__icon *',
].join(',')
const MAX_TEXT_LENGTH = 500

export const resolveAnnotationTarget = (
  root: Element,
  request: AnnotationTargetResolutionRequest,
  frameWindow: Window = root.ownerDocument.defaultView ?? window
): AnnotationTargetResolutionResult => {
  switch (request.mode) {
    case 'point':
      return resolveAnnotationTargetAtPoint(root, request, frameWindow)
    case 'rect':
      return resolveAnnotationTargetsInRect(root, request.rect, frameWindow)
    case 'identity':
      return resolveAnnotationTargetIdentity(root, request.identity, frameWindow)
    case 'group':
      return resolveAnnotationTargetGroup(root, request.identities, frameWindow)
  }
}

export const resolveAnnotationTargetAtPoint = (
  root: Element,
  request: AnnotationTargetPointRequest,
  frameWindow: Window = root.ownerDocument.defaultView ?? window
): AnnotationTargetResolutionResult => {
  const selectionTarget = resolveSelectedTextTarget(root, request.selectedText, frameWindow)
  if (selectionTarget) {
    return createResolvedResult(root, selectionTarget.element, frameWindow, {
      x: request.x,
      y: request.y,
      selectedText: selectionTarget.selectedText,
    })
  }

  const rawElement = deepElementFromPoint(root, request.x, request.y)
  const element = rawElement ? normalizeAnnotationElement(root, rawElement, frameWindow) : null
  if (!element) {
    return {
      status: 'no-target',
      reason: 'no-match',
      matchCount: 0,
    }
  }

  return createResolvedResult(root, element, frameWindow, {
    x: request.x,
    y: request.y,
    selectedText: request.selectedText,
  })
}

export const resolveAnnotationTargetsInRect = (
  root: Element,
  rect: AnnotationTargetRect,
  frameWindow: Window = root.ownerDocument.defaultView ?? window
): AnnotationTargetResolutionResult => {
  const normalizedRect = normalizeSelectionRect(rect)
  if (!normalizedRect || normalizedRect.width === 0 || normalizedRect.height === 0) {
    return {
      status: 'no-target',
      reason: 'empty-selection',
      matchCount: 0,
    }
  }

  const matchingElements = filterContainedElements(
    getAnnotatableCandidates(root, frameWindow).filter((element) => {
      const elementRect = element.getBoundingClientRect()
      return (
        hasUsableGeometry(elementRect) &&
        rectsIntersect(elementRect, normalizedRect) &&
        !isPreviewChromeElement(element)
      )
    })
  )

  if (matchingElements.length === 0) {
    return {
      status: 'no-target',
      reason: 'empty-selection',
      matchCount: 0,
    }
  }

  if (matchingElements.length === 1) {
    return createResolvedResult(root, matchingElements[0], frameWindow, {
      x: normalizedRect.x + normalizedRect.width,
      y: normalizedRect.y + normalizedRect.height,
    })
  }

  return combineResolvedAnnotationTargets(
    matchingElements.map((element) =>
      createResolvedTarget(root, element, frameWindow, {
        x: normalizedRect.x + normalizedRect.width,
        y: normalizedRect.y + normalizedRect.height,
        isMultiSelect: true,
      })
    )
  )
}

export const resolveAnnotationTargetIdentity = (
  root: Element,
  identity: AnnotationTargetIdentity,
  frameWindow: Window = root.ownerDocument.defaultView ?? window
): AnnotationTargetResolutionResult => {
  const pathMatch = queryFullPath(root, identity.fullPath)
  if (
    pathMatch &&
    isAnnotatableElement(pathMatch, frameWindow) &&
    getAnnotationTargetIdentity(root, pathMatch, frameWindow).signature === identity.signature
  ) {
    const target = createResolvedTarget(root, pathMatch, frameWindow)
    return {
      status: target.visibility === 'visible' ? 'resolved' : 'hidden',
      target,
      matchCount: 1,
    }
  }

  const matches = getAnnotatableCandidates(root, frameWindow).filter(
    (candidate) => getAnnotationTargetIdentity(root, candidate, frameWindow).signature === identity.signature
  )

  if (matches.length === 0) {
    return {
      status: 'dead',
      reason: 'no-match',
      matchCount: 0,
    }
  }

  if (matches.length > 1) {
    return {
      status: 'dead',
      reason: 'ambiguous-match',
      matchCount: matches.length,
    }
  }

  const target = createResolvedTarget(root, matches[0], frameWindow)
  return {
    status: target.visibility === 'visible' ? 'resolved' : 'hidden',
    target,
    matchCount: 1,
  }
}

export const resolveAnnotationTargetGroup = (
  root: Element,
  identities: readonly AnnotationTargetIdentity[],
  frameWindow: Window = root.ownerDocument.defaultView ?? window
): AnnotationTargetResolutionResult => {
  if (identities.length === 0) {
    return {
      status: 'no-target',
      reason: 'empty-selection',
      matchCount: 0,
    }
  }

  const resolvedTargets: ResolvedAnnotationTarget[] = []
  for (const identity of identities) {
    const result = resolveAnnotationTargetIdentity(root, identity, frameWindow)
    if (!result.target || (result.status !== 'resolved' && result.status !== 'hidden')) {
      return {
        status: 'dead',
        reason: 'partial-group',
        matchCount: resolvedTargets.length,
      }
    }
    resolvedTargets.push(result.target)
  }

  return combineResolvedAnnotationTargets(resolvedTargets)
}

export const combineResolvedAnnotationTargets = (
  targets: readonly ResolvedAnnotationTarget[]
): AnnotationTargetResolutionResult => {
  if (targets.length === 0) {
    return {
      status: 'no-target',
      reason: 'empty-selection',
      matchCount: 0,
    }
  }

  if (targets.length === 1) {
    const [target] = targets
    return {
      status: target.visibility === 'visible' ? 'resolved' : 'hidden',
      target,
      targets: [target],
      matchCount: 1,
    }
  }

  const visibleTargets = targets.filter((target) => target.visibility === 'visible')
  const boxes = visibleTargets
    .map((target) => target.snapshot.boundingBox)
    .filter((box): box is AnnotationTargetRect => Boolean(box))
  const unionBox = unionRects(boxes)
  const primaryTarget = targets[0]

  return {
    status: visibleTargets.length > 0 ? 'resolved' : 'hidden',
    targets: targets.map((target) => ({
      ...target,
      identity: { ...target.identity },
      snapshot: {
        ...target.snapshot,
        ...(target.snapshot.boundingBox ? { boundingBox: { ...target.snapshot.boundingBox } } : {}),
      },
    })),
    target: {
      ...primaryTarget,
      identity: { ...primaryTarget.identity },
      snapshot: {
        ...primaryTarget.snapshot,
        element: targets.map((target) => target.snapshot.element).join(', '),
        elementPath: targets.map((target) => target.identity.elementPath).join(' | '),
        fullPath: targets.map((target) => target.identity.fullPath).join(' | '),
        targetIdentities: targets.map((target) => ({ ...target.identity })),
        isMultiSelect: true,
        ...(unionBox ? { boundingBox: unionBox } : {}),
        elementBoundingBoxes: boxes,
      },
    },
    matchCount: targets.length,
  }
}

export const getAnnotationTargetIdentity = (
  root: Element,
  element: Element,
  frameWindow: Window = root.ownerDocument.defaultView ?? window
): AnnotationTargetIdentity => {
  const tagName = element.tagName.toLowerCase()
  const role = getElementRole(element)
  const accessibleName = getElementAccessibleName(element)
  const text = getVisibleText(element)
  const cssClasses = getElementClasses(element)
  const elementPath = getReadableElementPath(root, element)
  const fullPath = getFullElementPath(root, element)
  const signature = createAnnotationTargetIdentitySignature({
    tagName,
    role,
    accessibleName,
    text,
    cssClasses,
  })

  void frameWindow

  return {
    signature,
    tagName,
    ...(role ? { role } : {}),
    ...(accessibleName ? { accessibleName } : {}),
    ...(text ? { text: truncateText(text, MAX_TEXT_LENGTH) } : {}),
    ...(cssClasses ? { cssClasses } : {}),
    elementPath,
    fullPath,
  }
}

const createResolvedResult = (
  root: Element,
  element: Element,
  frameWindow: Window,
  options: {
    x?: number
    y?: number
    selectedText?: string
    isMultiSelect?: boolean
  } = {}
): AnnotationTargetResolutionResult => {
  const target = createResolvedTarget(root, element, frameWindow, options)
  return {
    status: target.visibility === 'visible' ? 'resolved' : 'hidden',
    target,
    matchCount: 1,
  }
}

const createResolvedTarget = (
  root: Element,
  element: Element,
  frameWindow: Window,
  options: {
    x?: number
    y?: number
    selectedText?: string
    isMultiSelect?: boolean
  } = {}
): ResolvedAnnotationTarget => {
  const identity = getAnnotationTargetIdentity(root, element, frameWindow)
  const rect = element.getBoundingClientRect()
  const isFixed = frameWindow.getComputedStyle(element).position === 'fixed'
  const pageX = typeof options.x === 'number' ? options.x : rect.left + rect.width / 2
  const pageY = typeof options.y === 'number' ? options.y : rect.top + rect.height / 2
  const snapshot: AnnotationTargetSnapshot = {
    x: frameWindow.innerWidth > 0 ? (pageX / frameWindow.innerWidth) * 100 : pageX,
    y: isFixed ? pageY : pageY + frameWindow.scrollY,
    element: describeElement(element),
    elementPath: identity.elementPath,
    targetIdentities: [{ ...identity }],
    boundingBox: {
      x: rect.left,
      y: isFixed ? rect.top : rect.top + frameWindow.scrollY,
      width: rect.width,
      height: rect.height,
    },
    nearbyText: getNearbyText(element),
    cssClasses: identity.cssClasses,
    computedStyles: getComputedStyleSummary(element, frameWindow),
    fullPath: identity.fullPath,
    accessibility: getAccessibilitySummary(element),
    isFixed,
    ...(options.isMultiSelect ? { isMultiSelect: true } : {}),
    ...(options.selectedText ? { selectedText: truncateText(options.selectedText, MAX_TEXT_LENGTH) } : {}),
  }

  return {
    identity,
    snapshot,
    visibility: isElementVisibleInViewport(element, frameWindow) ? 'visible' : 'hidden',
  }
}

export const createAnnotationTargetIdentitySignature = ({
  tagName,
  role,
  accessibleName,
  text,
  cssClasses,
}: {
  tagName: string
  role?: string
  accessibleName?: string
  text?: string
  cssClasses?: string
}): string =>
  stableStringify({
    tagName,
    role,
    accessibleName: normalizeComparableText(accessibleName),
    text: normalizeComparableText(text),
    cssClasses: normalizeComparableText(cssClasses),
  })

const deepElementFromPoint = (
  root: Element,
  x: number,
  y: number
): Element | null => {
  if (typeof root.ownerDocument.elementFromPoint !== 'function') {
    return null
  }

  let element = root.ownerDocument.elementFromPoint(x, y)
  while (element?.shadowRoot) {
    const nested = element.shadowRoot.elementFromPoint(x, y)
    if (!nested || nested === element) {
      break
    }
    element = nested
  }

  return element && root.contains(element) ? element : null
}

const normalizeAnnotationElement = (
  root: Element,
  element: Element,
  frameWindow: Window
): Element | null => {
  if (isExcludedElement(element) || isPreviewChromeElement(element)) {
    return null
  }

  const componentRoot = getComponentRootForInternalElement(element, root)
  if (componentRoot && isAnnotatableElement(componentRoot, frameWindow)) {
    return componentRoot
  }

  const interactive = closestWithinRoot(element, root, INTERACTIVE_TARGET_SELECTOR)
  if (interactive && isAnnotatableElement(interactive, frameWindow)) {
    return interactive
  }

  let current: Element | null = element
  while (current && current !== root && current !== root.ownerDocument.body) {
    if (isAnnotatableElement(current, frameWindow)) {
      return current
    }
    current = current.parentElement
  }

  return isAnnotatableElement(root, frameWindow) ? root : null
}

const getComponentRootForInternalElement = (element: Element, root: Element): Element | null => {
  const inlineMessageInternal = closestWithinRoot(element, root, COMPONENT_INTERNAL_TARGET_SELECTOR)
  return inlineMessageInternal
    ? closestWithinRoot(inlineMessageInternal, root, '.aksel-inline-message')
    : null
}

const getAnnotatableCandidates = (root: Element, frameWindow: Window): Element[] =>
  [root, ...Array.from(root.querySelectorAll('*'))]
    .filter((candidate) => root.contains(candidate))
    .map((candidate) => normalizeAnnotationElement(root, candidate, frameWindow))
    .filter((candidate): candidate is Element => Boolean(candidate))
    .filter((candidate, index, candidates) => candidates.indexOf(candidate) === index)

const filterContainedElements = (elements: Element[]): Element[] =>
  elements.filter(
    (element) => !elements.some((otherElement) => otherElement !== element && element.contains(otherElement))
  )

const isAnnotatableElement = (element: Element, frameWindow: Window): boolean => {
  if (isExcludedElement(element) || isPreviewChromeElement(element)) {
    return false
  }

  const tagName = element.tagName.toLowerCase()
  if (tagName === 'html' || tagName === 'body') {
    return false
  }

  const style = frameWindow.getComputedStyle(element)
  return (
    style.display !== 'none' &&
    style.display !== 'contents' &&
    style.visibility !== 'hidden' &&
    style.visibility !== 'collapse'
  )
}

const isPreviewChromeElement = (element: Element): boolean =>
  Boolean(
    element.closest(
      '[data-annotation-marker], [data-annotation-popup], [data-feedback-toolbar], [data-inspect-overlay]'
    )
  )

const resolveSelectedTextTarget = (
  root: Element,
  explicitSelectedText: string | undefined,
  frameWindow: Window
): { element: Element; selectedText: string } | null => {
  const selection = frameWindow.getSelection?.()
  const selectedText = truncateText(
    normalizeWhitespace(explicitSelectedText ?? selection?.toString() ?? ''),
    MAX_TEXT_LENGTH
  )
  if (!selectedText || !selection || selection.rangeCount === 0) {
    return null
  }

  const range = selection.getRangeAt(0)
  const commonAncestor =
    range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? (range.commonAncestorContainer as Element)
      : range.commonAncestorContainer.parentElement
  const element = commonAncestor ? normalizeAnnotationElement(root, commonAncestor, frameWindow) : null
  return element ? { element, selectedText } : null
}

const queryFullPath = (root: Element, fullPath: string): Element | null => {
  if (!fullPath) {
    return null
  }

  try {
    return fullPath === ':scope' ? root : root.querySelector(fullPath)
  } catch (error) {
    if (error instanceof DOMException) {
      console.warn('Invalid annotation target selector path:', {
        fullPath,
        message: error.message,
      })
      return null
    }

    throw error
  }
}

const getReadableElementPath = (root: Element, element: Element, maxDepth = 4): string => {
  const parts: string[] = []
  let current: Element | null = element
  let depth = 0

  while (current && current !== root && depth < maxDepth) {
    parts.unshift(getReadableElementIdentifier(current))
    current = current.parentElement
    depth += 1
  }

  return parts.join(' > ') || getReadableElementIdentifier(element)
}

const getReadableElementIdentifier = (element: Element): string => {
  const tagName = element.tagName.toLowerCase()
  const name = getElementAccessibleName(element) || getVisibleText(element)
  if (name) {
    return `${tagName} "${truncateText(name, 35)}"`
  }
  const classes = getTargetClassNames(element).slice(0, 1)
  return classes.length > 0 ? `${tagName}.${classes[0]}` : tagName
}

const getFullElementPath = (root: Element, element: Element): string => {
  if (element === root) {
    return ':scope'
  }

  const parts: string[] = []
  let current: Element | null = element
  while (current && current !== root) {
    const tagName = current.tagName.toLowerCase()
    const siblings = current.parentElement
      ? Array.from(current.parentElement.children).filter(
          (sibling) => sibling.tagName.toLowerCase() === tagName
        )
      : []
    const index = Math.max(1, siblings.indexOf(current) + 1)
    parts.unshift(`${tagName}:nth-of-type(${index})`)
    current = current.parentElement
  }

  return parts.join(' > ')
}

const describeElement = (element: Element): string => {
  const role = getElementRole(element)
  const name = getElementAccessibleName(element) || getVisibleText(element)
  if (role && name) {
    return `${role} "${truncateText(name, 40)}"`
  }
  if (name) {
    return `${element.tagName.toLowerCase()} "${truncateText(name, 40)}"`
  }
  return role || element.tagName.toLowerCase()
}

const getElementRole = (element: Element): string =>
  getSharedElementRole(element, {
    ignorePresentationalRole: true,
    treatSummaryAsButton: true,
  })

const getElementAccessibleName = (element: Element): string =>
  getSharedElementAccessibleName(element, {
    includeImplicitLinkText: false,
  })

const getNearbyText = (element: Element): string => {
  const texts = [
    element.previousElementSibling ? getVisibleText(element.previousElementSibling) : '',
    getVisibleText(element),
    element.nextElementSibling ? getVisibleText(element.nextElementSibling) : '',
  ]
    .map((text) => truncateText(text, 80))
    .filter(Boolean)

  return texts.join(' ')
}

const getElementClasses = (element: Element): string | undefined => {
  const classes = getTargetClassNames(element)
  return classes.length > 0 ? classes.join(' ') : undefined
}

const getTargetClassNames = (element: Element): string[] =>
  Array.from(element.classList ?? [])
    .filter((className) => className.length > 1 && !/^[a-z]{1,2}$/.test(className))
    .slice(0, 12)

const getComputedStyleSummary = (element: Element, frameWindow: Window): string => {
  const style = frameWindow.getComputedStyle(element)
  const entries = [
    ['display', style.display],
    ['position', style.position],
    ['color', style.color],
    ['backgroundColor', style.backgroundColor],
    ['fontSize', style.fontSize],
    ['fontWeight', style.fontWeight],
  ].filter(([, value]) => value)

  return entries.map(([key, value]) => `${key}: ${value}`).join('; ')
}

const getAccessibilitySummary = (element: Element): string | undefined => {
  const role = getElementRole(element)
  const name = getElementAccessibleName(element)
  if (!role && !name) {
    return undefined
  }
  return [role ? `role=${role}` : null, name ? `name="${name}"` : null].filter(Boolean).join(' ')
}

const closestWithinRoot = (element: Element, root: Element, selector: string): Element | null => {
  const closest = element.closest(selector)
  return closest && root.contains(closest) ? closest : null
}

const isElementVisibleInViewport = (element: Element, frameWindow: Window): boolean => {
  const style = frameWindow.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
    return false
  }

  const rect = element.getBoundingClientRect()
  return (
    hasUsableGeometry(rect) &&
    rect.right > 0 &&
    rect.bottom > 0 &&
    rect.left < frameWindow.innerWidth &&
    rect.top < frameWindow.innerHeight
  )
}

const normalizeSelectionRect = (rect: AnnotationTargetRect): AnnotationTargetRect | null => {
  const left = Math.min(rect.x, rect.x + rect.width)
  const top = Math.min(rect.y, rect.y + rect.height)
  const width = Math.abs(rect.width)
  const height = Math.abs(rect.height)
  if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null
  }

  return {
    x: left,
    y: top,
    width,
    height,
  }
}

const rectsIntersect = (left: DOMRect, right: AnnotationTargetRect): boolean =>
  left.left < right.x + right.width &&
  left.right > right.x &&
  left.top < right.y + right.height &&
  left.bottom > right.y

const hasUsableGeometry = (rect: DOMRect | AnnotationTargetRect): boolean =>
  rect.width >= 1 && rect.height >= 1

const unionRects = (rects: readonly AnnotationTargetRect[]): AnnotationTargetRect | null => {
  if (rects.length === 0) {
    return null
  }

  const bounds = rects.reduce(
    (acc, rect) => ({
      left: Math.min(acc.left, rect.x),
      top: Math.min(acc.top, rect.y),
      right: Math.max(acc.right, rect.x + rect.width),
      bottom: Math.max(acc.bottom, rect.y + rect.height),
    }),
    {
      left: Infinity,
      top: Infinity,
      right: -Infinity,
      bottom: -Infinity,
    }
  )

  return {
    x: bounds.left,
    y: bounds.top,
    width: bounds.right - bounds.left,
    height: bounds.bottom - bounds.top,
  }
}

const normalizeComparableText = (value: string | undefined): string =>
  normalizeWhitespace(value ?? '').toLowerCase()

const truncateText = (value: string, maxLength: number): string =>
  value.length > maxLength ? value.slice(0, maxLength) : value

const stableStringify = (value: Record<string, string | undefined>): string =>
  JSON.stringify(
    Object.keys(value)
      .sort()
      .reduce<Record<string, string>>((acc, key) => {
        const item = value[key]
        if (item) {
          acc[key] = item
        }
        return acc
      }, {})
  )

const isAnnotationTargetRect = (value: unknown): value is AnnotationTargetRect =>
  isRecord(value) &&
  isFiniteNumber(value.x) &&
  isFiniteNumber(value.y) &&
  isFiniteNumber(value.width) &&
  isFiniteNumber(value.height)

const isAnnotationTargetIdentity = (value: unknown): value is AnnotationTargetIdentity =>
  isRecord(value) &&
  typeof value.signature === 'string' &&
  typeof value.tagName === 'string' &&
  typeof value.elementPath === 'string' &&
  typeof value.fullPath === 'string' &&
  optionalString(value.role) &&
  optionalString(value.accessibleName) &&
  optionalString(value.text) &&
  optionalString(value.cssClasses)

const optionalString = (value: unknown): boolean => value === undefined || typeof value === 'string'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
