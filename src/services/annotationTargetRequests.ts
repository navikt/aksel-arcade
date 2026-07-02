import type { ArcadeAnnotation, AnnotationTargetIdentity } from '@/types/annotations'
import { createAnnotationTargetIdentitySignature } from './annotationTargets'
import type { AnnotationTargetResolutionRequest } from './annotationTargets'

const extractQuotedText = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined
  }

  const match = value.match(/"([^"]+)"/)
  return match?.[1]?.trim() || undefined
}

const extractAccessibilityField = (
  accessibility: string | undefined,
  key: 'role' | 'name'
): string | undefined => {
  if (!accessibility) {
    return undefined
  }

  if (key === 'role') {
    return accessibility.match(/role=([^\s]+)/)?.[1]
  }

  return accessibility.match(/name="([^"]+)"/)?.[1]
}

const inferTagName = (annotation: ArcadeAnnotation): string | undefined => {
  const [fromElement] = annotation.element.trim().split(/\s+/, 1)
  if (fromElement) {
    return fromElement.toLowerCase().replace(/[^a-z0-9-]/g, '') || undefined
  }

  const [fromPath] = annotation.elementPath.trim().split(/[\s>.#:]/, 1)
  return fromPath?.toLowerCase() || undefined
}

const createLegacyTargetIdentity = (
  annotation: ArcadeAnnotation
): AnnotationTargetIdentity | null => {
  const tagName = inferTagName(annotation)
  if (!tagName) {
    return null
  }

  const role = extractAccessibilityField(annotation.accessibility, 'role')
  const accessibleName =
    extractAccessibilityField(annotation.accessibility, 'name') ?? extractQuotedText(annotation.element)
  const text = annotation.selectedText ?? annotation.nearbyText ?? extractQuotedText(annotation.element)
  const cssClasses = annotation.cssClasses

  return {
    signature: createAnnotationTargetIdentitySignature({
      tagName,
      role,
      accessibleName,
      text,
      cssClasses,
    }),
    tagName,
    ...(role ? { role } : {}),
    ...(accessibleName ? { accessibleName } : {}),
    ...(text ? { text } : {}),
    ...(cssClasses ? { cssClasses } : {}),
    elementPath: annotation.elementPath,
    fullPath: annotation.fullPath ?? '',
  }
}

export const getStoredAnnotationTargetIdentities = (
  annotation: ArcadeAnnotation
): AnnotationTargetIdentity[] => {
  if (annotation.targetIdentities && annotation.targetIdentities.length > 0) {
    return annotation.targetIdentities.map((identity) => ({ ...identity }))
  }

  const legacyIdentity = createLegacyTargetIdentity(annotation)
  return legacyIdentity ? [legacyIdentity] : []
}

export const buildAnnotationTargetResolutionRequest = (
  annotation: ArcadeAnnotation
): AnnotationTargetResolutionRequest | null => {
  const identities = getStoredAnnotationTargetIdentities(annotation)
  if (identities.length === 0) {
    return null
  }

  if (identities.length === 1) {
    return {
      mode: 'identity',
      identity: identities[0],
    }
  }

  return {
    mode: 'group',
    identities,
  }
}
