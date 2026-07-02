interface ElementRoleOptions {
  ignorePresentationalRole?: boolean
  treatSummaryAsButton?: boolean
}

interface ElementAccessibleNameOptions {
  includeImplicitLinkText?: boolean
}

type LabelableElement =
  | HTMLButtonElement
  | HTMLInputElement
  | HTMLMeterElement
  | HTMLOutputElement
  | HTMLProgressElement
  | HTMLSelectElement
  | HTMLTextAreaElement

export const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim()

export const isExcludedElement = (element: Element): boolean => {
  const tagName = element.tagName.toLowerCase()
  return (
    tagName === 'script' ||
    tagName === 'style' ||
    tagName === 'template' ||
    tagName === 'noscript' ||
    tagName === 'html' ||
    tagName === 'body'
  )
}

export const getVisibleText = (element: Element): string =>
  normalizeWhitespace(getSanitizedSubtreeText(element))

export const getElementRole = (
  element: Element,
  { ignorePresentationalRole = false, treatSummaryAsButton = false }: ElementRoleOptions = {}
): string => {
  const explicitRole = element.getAttribute('role')?.trim().toLowerCase()
  if (explicitRole) {
    if (
      ignorePresentationalRole &&
      (explicitRole === 'none' || explicitRole === 'presentation')
    ) {
      return ''
    }

    return explicitRole
  }

  const tagName = element.tagName.toLowerCase()
  if (tagName === 'button') return 'button'
  if (tagName === 'a' && element.hasAttribute('href')) return 'link'
  if (tagName === 'textarea') return 'textbox'
  if (tagName === 'select') return 'combobox'
  if (tagName === 'option') return 'option'
  if (tagName === 'img') return 'img'
  if (tagName === 'summary' && treatSummaryAsButton) return 'button'
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

export const getElementAccessibleName = (
  element: Element,
  { includeImplicitLinkText = true }: ElementAccessibleNameOptions = {}
): string => {
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
        return referencedElement ? getVisibleText(referencedElement) : ''
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

  return elementUsesContentAsAccessibleName(element, { includeImplicitLinkText })
    ? getVisibleText(element)
    : ''
}

export const hasExplicitAccessibleName = (element: Element): boolean =>
  element.hasAttribute('aria-label') ||
  element.hasAttribute('aria-labelledby') ||
  getElementAltText(element).length > 0 ||
  element.hasAttribute('title') ||
  getElementLabelText(element).length > 0 ||
  (element instanceof HTMLInputElement &&
    inputUsesValueAsAccessibleName(element) &&
    normalizeWhitespace(element.value).length > 0)

export const getElementLabelText = (element: Element): string => {
  if (!(element instanceof HTMLElement) || !isLabelableElement(element)) {
    return ''
  }

  const labels = Array.from(element.labels ?? [])
  if (labels.length > 0) {
    return normalizeWhitespace(labels.map((label) => getVisibleText(label)).join(' '))
  }

  if (element.id) {
    const label = Array.from(element.ownerDocument.querySelectorAll('label[for]')).find(
      (candidate) => candidate.getAttribute('for') === element.id
    )
    if (label) {
      return getVisibleText(label)
    }
  }

  const wrappingLabel = element.closest('label')
  return wrappingLabel ? getVisibleText(wrappingLabel) : ''
}

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

const elementUsesContentAsAccessibleName = (
  element: Element,
  { includeImplicitLinkText }: ElementAccessibleNameOptions
): boolean => {
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

  return Boolean(includeImplicitLinkText) && tagName === 'a' && element.hasAttribute('href')
}

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
