import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  Alert,
  BodyLong,
  Button,
  CopyButton,
  Detail,
  Dialog,
  Heading,
  HStack,
  Loader,
  Popover,
  Tag,
  VStack,
} from '@navikt/ds-react'
import { LinkIcon } from '@navikt/aksel-icons'
import { useSettings } from '@/contexts/SettingsContext'
import {
  useShareLink,
  type ShareLinkErrorCode,
  type UseShareLinkOptions,
} from '@/hooks/useShareLink'
import { useProject } from '@/hooks/useProject'
import { getStartPageSource } from '@/services/projectSource'
import { exportProject, getPortableArtifactWarning } from '@/services/storage'
import { SHARE_URL_CHAR_LIMIT } from '@/utils/shareEncoding'
import './SharePopoverButton.css'

interface SharePopoverButtonProps {
  ariaLabel: string
  note?: string
  ownerVisible?: boolean
  shareOptions?: UseShareLinkOptions
}

export const SharePopoverButton = ({
  ariaLabel,
  note,
  ownerVisible = true,
  shareOptions,
}: SharePopoverButtonProps) => {
  const { project } = useProject()
  const { theme } = useSettings()
  const shareButtonRef = useRef<HTMLButtonElement>(null)
  const clipboardBufferRef = useRef<HTMLTextAreaElement>(null)
  const lastGeneratedShareFingerprintRef = useRef<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false)
  const loadingDescriptionId = useId()
  const exportConfirmDialogId = useId()
  const slowDescriptionId = `${loadingDescriptionId}-delay`
  const portableArtifactWarning = getPortableArtifactWarning(project)
  const {
    state: shareState,
    generateShareLink,
    resetShareState,
    cancelShareGeneration,
    markCopyPending,
    markCopySuccess,
    markCopyFailure,
  } = useShareLink(shareOptions)

  const handleExport = useCallback(() => {
    setShareOpen(false)
    if (portableArtifactWarning) {
      setExportConfirmOpen(true)
      return
    }
    exportProject(project)
  }, [portableArtifactWarning, project])

  const handleConfirmExport = useCallback(() => {
    setExportConfirmOpen(false)
    exportProject(project)
  }, [project])

  const handleShareButtonClick = useCallback(() => {
    if (!ownerVisible) {
      return
    }

    if (shareOpen) {
      void generateShareLink(true)
      return
    }

    setShareOpen(true)
  }, [generateShareLink, ownerVisible, shareOpen])

  const handleShareClose = useCallback(() => {
    setShareOpen(false)
  }, [])

  useEffect(() => {
    if (ownerVisible) {
      return
    }

    setShareOpen(false)
    setExportConfirmOpen(false)
    lastGeneratedShareFingerprintRef.current = null
    resetShareState()
  }, [ownerVisible, resetShareState])

  useEffect(() => {
    return () => {
      cancelShareGeneration()
    }
  }, [cancelShareGeneration])

  const handleCopyClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!shareState.link) {
      event.preventDefault()
      return
    }

    markCopyPending()

    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable')
      }
      await navigator.clipboard.writeText(shareState.link)
      markCopySuccess()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to access clipboard'
      markCopyFailure(message)
      event.preventDefault()

      if (clipboardBufferRef.current) {
        clipboardBufferRef.current.readOnly = true
        clipboardBufferRef.current.focus()
        clipboardBufferRef.current.select()
      }
    }
  }

  const isGeneratingShare = shareState.status === 'generating' || shareState.status === 'warning'
  const shareableSource = getStartPageSource(project)
  const shareDependenciesFingerprint = useMemo(() => {
    const lastModified = project.lastModified ?? 'unknown'
    const jsxLength = shareableSource.jsx.length
    const hooksLength = shareableSource.hooks.length
    return `${lastModified}|${jsxLength}|${hooksLength}|${project.viewportSize}|${theme}`
  }, [
    project.lastModified,
    project.viewportSize,
    shareableSource.hooks.length,
    shareableSource.jsx.length,
    theme,
  ])
  const showOversizeMessage =
    shareState.status === 'oversize' || shareState.error?.code === 'oversize'
  const shareCharLimitLabel = SHARE_URL_CHAR_LIMIT.toLocaleString()
  const shareLengthChars = shareState.approxChars ?? shareState.estimatedChars
  const hasExactShareLength =
    typeof shareState.approxChars === 'number' && !Number.isNaN(shareState.approxChars)
  const shareLengthValue =
    typeof shareLengthChars === 'number' ? formatCharCount(shareLengthChars) : null
  const shareLengthLabel = hasExactShareLength ? 'Share URL length' : 'Estimated share length'
  const shareLengthTagText = shareLengthValue
    ? `${shareLengthLabel} ${shareLengthValue} / ${shareCharLimitLabel} chars`
    : null
  const shareLengthDetailText = shareLengthValue
    ? `${shareLengthLabel} ${shareLengthValue} / ${shareCharLimitLabel} characters`
    : null

  const shareLengthTag = shareLengthTagText ? (
    <Tag
      size="small"
      variant="moderate"
      data-color={
        showOversizeMessage ? 'danger' : shareState.warningThresholdHit ? 'warning' : 'info'
      }
      className="share-popover__estimate-tag"
    >
      {shareLengthTagText}
    </Tag>
  ) : null

  const statusMessage =
    shareState.clipboardStatus === 'copying'
      ? 'Copying link…'
      : shareState.clipboardStatus === 'error'
        ? 'Clipboard blocked. The link is selected—press Cmd/Ctrl+C to copy.'
        : null

  const shareMeta =
    !showOversizeMessage && shareLengthTag ? (
      <VStack gap="space-4" className="share-popover__meta">
        {shareLengthTag}
        {shareState.strategyId && (
          <Detail size="small" className="share-popover__estimate-copy">
            {`Strategy: ${shareState.strategyId}`}
          </Detail>
        )}
      </VStack>
    ) : null

  useEffect(() => {
    if (!ownerVisible || !shareOpen) {
      lastGeneratedShareFingerprintRef.current = null
      return
    }

    if (isGeneratingShare) {
      return
    }

    if (lastGeneratedShareFingerprintRef.current === shareDependenciesFingerprint) {
      return
    }

    lastGeneratedShareFingerprintRef.current = shareDependenciesFingerprint
    void generateShareLink()
  }, [ownerVisible, shareOpen, shareDependenciesFingerprint, isGeneratingShare, generateShareLink])

  return (
    <>
      <Button
        variant="tertiary"
        data-color="neutral"
        size="small"
        icon={<LinkIcon aria-hidden />}
        onClick={handleShareButtonClick}
        aria-label={ariaLabel}
        ref={shareButtonRef}
        aria-expanded={shareOpen}
      />
      {shareOpen && (
        <Popover
          open
          onClose={handleShareClose}
          anchorEl={shareButtonRef.current}
          placement="bottom-end"
        >
          <Popover.Content className="share-popover" data-testid="share-popover">
            <VStack gap="space-12">
              <Heading size="small" level="2">
                Share this prototype
              </Heading>
              <VStack gap="space-8">
                <BodyLong size="small">
                  Generate a Web share URL so teammates can load this project without downloading an
                  Arcade project package.
                </BodyLong>
                {note && (
                  <Detail size="small" className="share-popover__note">
                    {note}
                  </Detail>
                )}
              </VStack>
              {portableArtifactWarning && (
                <Alert variant="warning" size="small">
                  <BodyLong size="small">{portableArtifactWarning}</BodyLong>
                </Alert>
              )}
              {isGeneratingShare ? (
                <HStack gap="space-8" align="center" role="status" aria-live="polite">
                  <Loader size="xsmall" title="Generating Web share URL" />
                  <VStack gap="space-4">
                    <BodyLong size="small" id={loadingDescriptionId}>
                      Web share URL is being generated…
                    </BodyLong>
                    {shareState.showSlowGenerationNotice && (
                      <Detail
                        size="small"
                        id={slowDescriptionId}
                        className="share-popover__loader-apology"
                      >
                        This is taking longer than usual. Sorry for the wait!
                      </Detail>
                    )}
                    {shareState.warningThresholdHit && (
                      <Detail size="small" className="share-popover__loader-warning">
                        Estimated size {formatCharCount(shareState.estimatedChars)} /{' '}
                        {SHARE_URL_CHAR_LIMIT.toLocaleString()} characters.
                      </Detail>
                    )}
                  </VStack>
                </HStack>
              ) : (
                <VStack gap="space-12">
                  {shareState.status === 'error' && shareState.error && (
                    <Alert variant="warning" size="small">
                      <VStack gap="space-8">
                        <BodyLong size="small">
                          {getShareErrorMessage(shareState.error.code)}
                        </BodyLong>
                        <Button
                          size="xsmall"
                          variant="tertiary"
                          onClick={() => {
                            void generateShareLink()
                          }}
                          className="share-popover__retry"
                        >
                          Retry generation
                        </Button>
                      </VStack>
                    </Alert>
                  )}
                  {showOversizeMessage ? (
                    <Alert variant="warning" size="small" role="status">
                      <VStack gap="space-12">
                        <VStack gap="space-4">
                          <BodyLong size="small">
                            This project is too large for a Web share URL. Use Export instead.
                          </BodyLong>
                          {shareLengthDetailText && (
                            <Detail size="small" className="share-popover__oversize-details">
                              {shareLengthDetailText}
                            </Detail>
                          )}
                        </VStack>
                        <Button
                          size="xsmall"
                          variant="primary"
                          className="share-popover__oversize-cta"
                          onClick={handleExport}
                        >
                          Use Export instead
                        </Button>
                      </VStack>
                    </Alert>
                  ) : (
                    <CopyButton
                      copyText={shareState.link ?? ''}
                      text="Copy Web share URL"
                      activeText="Web share URL copied"
                      size="small"
                      variant="neutral"
                      disabled={shareState.status !== 'ready'}
                      onClick={handleCopyClick}
                    />
                  )}
                  {statusMessage && (
                    <Detail
                      size="small"
                      className="share-popover__status"
                      role="status"
                      aria-live="polite"
                    >
                      {statusMessage}
                    </Detail>
                  )}
                  {shareState.clipboardStatus === 'error' && (
                    <BodyLong size="small" className="share-popover__error">
                      {shareState.clipboardError ||
                        'Clipboard permissions prevented automatic copy.'}
                    </BodyLong>
                  )}
                </VStack>
              )}
              {shareMeta}
              <textarea
                ref={clipboardBufferRef}
                className="share-popover__clipboard-buffer"
                aria-hidden="true"
                tabIndex={-1}
                readOnly
                value={shareState.link ?? ''}
              />
            </VStack>
          </Popover.Content>
        </Popover>
      )}
      <Dialog open={exportConfirmOpen} onOpenChange={setExportConfirmOpen}>
        <Dialog.Popup
          id={exportConfirmDialogId}
          role="alertdialog"
          aria-label="Confirm export"
          closeOnOutsideClick={false}
        >
          <Dialog.Body>
            <VStack gap="space-12">
              <BodyLong>{portableArtifactWarning}</BodyLong>
              <Detail size="small">Continue with a Start-page-only export?</Detail>
            </VStack>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.CloseTrigger>
              <Button type="button" variant="secondary" data-color="neutral">
                Cancel
              </Button>
            </Dialog.CloseTrigger>
            <Button type="button" onClick={handleConfirmExport}>
              Export Start page only
            </Button>
          </Dialog.Footer>
        </Dialog.Popup>
      </Dialog>
    </>
  )
}

const getShareErrorMessage = (code: ShareLinkErrorCode): string => {
  switch (code) {
    case 'offline':
      return 'You appear to be offline. Reconnect to the internet and try again.'
    case 'storage-unavailable':
      return 'Browser storage is blocked, so we cannot package your project. Enable storage access and retry.'
    case 'oversize':
      return 'This project is too large for a Web share URL. Use Export instead.'
    default:
      return 'Something went wrong while generating the Web share URL. Please try again.'
  }
}

const formatCharCount = (value?: number): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—'
  }
  return value.toLocaleString()
}
