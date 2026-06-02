import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  Heading,
  Detail,
  Button,
  HStack,
  VStack,
  Box,
  ActionMenu,
  BodyLong,
  CopyButton,
  Loader,
  Popover,
  Alert,
  Tag,
  Dialog,
  TextField,
} from '@navikt/ds-react'
import {
  PencilIcon,
  CheckmarkIcon,
  FileExportIcon,
  FileImportIcon,
  CogIcon,
  MoonIcon,
  SunIcon,
  ArrowsSquarepathIcon,
  ArrowUndoIcon,
  LinkIcon,
  XMarkIcon,
} from '@navikt/aksel-icons'
import { SaveStatusIndicator } from './SaveStatusIndicator'
import { ProjectSizeIndicator } from './ProjectSizeIndicator'
import { useSettings } from '@/contexts/SettingsContext'
import type { Project } from '@/types/project'
import type { SaveStatus } from '@/hooks/useAutoSave'
import { ARCADE_PROJECT_IMPORT_ACCEPT, exportProject, importProject } from '@/services/storage'
import {
  useShareLink,
  type ShareLinkErrorCode,
  type UseShareLinkOptions,
} from '@/hooks/useShareLink'
import { SHARE_URL_CHAR_LIMIT } from '@/utils/shareEncoding'
import { WEB_ARCADE_CAPABILITIES, type ShellCapabilities } from '@/services/shellCapabilities'
import './AppHeader.css'

const AgentSessionMenu = lazy(() =>
  import('./AgentSessionMenu').then((module) => ({ default: module.AgentSessionMenu }))
)

// Aksel Logo Mark SVG - 24x24px with brand-blue color
const AkselLogoMark = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ color: 'var(--ax-text-brand-blue-subtle)' }}
  >
    <path
      d="M9.54297 13.043C9.93349 12.6524 10.5665 12.6524 10.957 13.043C11.3476 13.4335 11.3476 14.0665 10.957 14.457L1.70703 23.707C1.31651 24.0976 0.683493 24.0976 0.292969 23.707C-0.0975555 23.3165 -0.0975555 22.6835 0.292969 22.293L9.54297 13.043ZM20.5 0C22.433 3.86553e-07 24 1.567 24 3.5V15.9648C23.9999 16.893 23.6309 17.7832 22.9746 18.4395L17.707 23.707C17.658 23.756 17.6055 23.7992 17.5498 23.8359C17.4669 23.8906 17.3776 23.9316 17.2852 23.959C17.0994 24.0141 16.9006 24.014 16.7148 23.959C16.6224 23.9316 16.5331 23.8906 16.4502 23.8359C16.3945 23.7992 16.342 23.756 16.293 23.707C16.0977 23.5118 16 23.2559 16 23C16 22.9362 16.0064 22.8724 16.0186 22.8096C16.0246 22.7781 16.0319 22.7467 16.041 22.7158C16.0868 22.5611 16.1709 22.4151 16.293 22.293L21.5254 17.0605C22.111 16.4747 22.1111 15.5242 21.5254 14.9385L9.06055 2.47461C8.47481 1.88908 7.52519 1.88907 6.93945 2.47461L1.70703 7.70703C1.65804 7.75602 1.60547 7.79924 1.5498 7.83594C1.4669 7.89058 1.37759 7.9316 1.28516 7.95898C1.0994 8.01405 0.900597 8.01405 0.714844 7.95898C0.622409 7.9316 0.5331 7.89058 0.450195 7.83594C0.394528 7.79924 0.341961 7.75602 0.292969 7.70703C0.0977065 7.51177 -6.01579e-08 7.25588 0 7C2.96676e-05 6.9362 0.00639249 6.87243 0.0185547 6.80957C0.024638 6.77807 0.0318843 6.74673 0.0410156 6.71582C0.0867591 6.56115 0.170941 6.41506 0.292969 6.29297L5.56055 1.02539C6.21684 0.369103 7.10704 0.000100001 8.03516 0H20.5ZM22 12.585V3.5C22 2.67157 21.3284 2 20.5 2H11.4141L22 12.585Z"
      fill="currentColor"
    />
  </svg>
)

interface AppHeaderProps {
  projectName: string
  onProjectNameChange: (name: string) => void
  currentProject: Project
  onProjectImported: (project: Project) => void
  saveStatus: SaveStatus
  projectSizeBytes: number
  onResetToIntro: () => void
  onLoadFormSummaryTemplate: () => void
  onLoadHooksDemo: () => void
  shareOptions?: UseShareLinkOptions
  shellCapabilities?: ShellCapabilities
}

export const AppHeader = ({
  projectName,
  onProjectNameChange,
  currentProject,
  onProjectImported,
  saveStatus,
  projectSizeBytes,
  onResetToIntro,
  onLoadFormSummaryTemplate,
  onLoadHooksDemo,
  shareOptions,
  shellCapabilities = WEB_ARCADE_CAPABILITIES,
}: AppHeaderProps) => {
  const MAX_PROJECT_SIZE = 5 * 1024 * 1024 // 5MB
  const fileInputRef = useRef<HTMLInputElement>(null)
  const shareButtonRef = useRef<HTMLButtonElement>(null)
  const clipboardBufferRef = useRef<HTMLTextAreaElement>(null)
  const lastGeneratedShareFingerprintRef = useRef<string | null>(null)
  const projectNameInputRef = useRef<HTMLInputElement>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [importConfirmOpen, setImportConfirmOpen] = useState(false)
  const [isEditingProjectName, setIsEditingProjectName] = useState(false)
  const [projectNameDraft, setProjectNameDraft] = useState(projectName)
  const loadingDescriptionId = useId()
  const importConfirmDialogId = useId()
  const slowDescriptionId = `${loadingDescriptionId}-delay`
  const { theme, toggleTheme, togglePanelOrder } = useSettings()
  const {
    state: shareState,
    generateShareLink,
    resetShareState,
    markCopyPending,
    markCopySuccess,
    markCopyFailure,
  } = useShareLink(shareOptions)
  const canUseShareUrl = shellCapabilities.shareUrl.enabled
  const canUseAgentSessions = shellCapabilities.agentSessions.enabled

  const handleExport = () => {
    exportProject(currentProject)
  }

  const handleImportClick = () => {
    const hasUnsavedChanges = saveStatus === 'saving' || saveStatus === 'idle'
    if (hasUnsavedChanges) {
      setImportConfirmOpen(true)
      return
    }
    fileInputRef.current?.click()
  }

  const handleConfirmImport = () => {
    setImportConfirmOpen(false)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const result = await importProject(file)

    if (result.success && result.project) {
      onProjectImported(result.project)
    } else {
      alert(`Import failed: ${result.error}`)
      console.error('❌ Import failed:', result.error)
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleShareButtonClick = () => {
    if (!canUseShareUrl) {
      return
    }

    if (shareOpen) {
      generateShareLink(true)
      return
    }

    setShareOpen(true)
  }

  const handleStartProjectNameEdit = () => {
    setProjectNameDraft(projectName)
    setIsEditingProjectName(true)
  }

  const handleCancelProjectNameEdit = () => {
    setProjectNameDraft(projectName)
    setIsEditingProjectName(false)
  }

  const normalizedProjectName = projectNameDraft.trim()
  const canSaveProjectName = normalizedProjectName.length > 0

  const handleSaveProjectName = () => {
    if (!canSaveProjectName) {
      return
    }

    if (normalizedProjectName !== projectName) {
      onProjectNameChange(normalizedProjectName)
    }

    setProjectNameDraft(normalizedProjectName)
    setIsEditingProjectName(false)
  }

  const handleProjectNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleSaveProjectName()
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      handleCancelProjectNameEdit()
    }
  }

  const handleShareClose = useCallback(() => {
    setShareOpen(false)
  }, [])

  useEffect(() => {
    if (!isEditingProjectName) {
      setProjectNameDraft(projectName)
      return
    }

    projectNameInputRef.current?.focus()
    projectNameInputRef.current?.select()
  }, [isEditingProjectName, projectName])

  useEffect(() => {
    setProjectNameDraft(projectName)
    setIsEditingProjectName(false)
  }, [currentProject.id, projectName])

  useEffect(() => {
    if (!canUseShareUrl) {
      return
    }

    return () => {
      resetShareState()
    }
  }, [canUseShareUrl, resetShareState])

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
  const shareDependenciesFingerprint = useMemo(() => {
    const lastModified = currentProject.lastModified ?? 'unknown'
    const jsxLength = currentProject.jsxCode.length
    const hooksLength = currentProject.hooksCode.length
    return `${lastModified}|${jsxLength}|${hooksLength}|${currentProject.viewportSize}|${theme}`
  }, [
    currentProject.hooksCode.length,
    currentProject.jsxCode.length,
    currentProject.lastModified,
    currentProject.viewportSize,
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
    if (!canUseShareUrl || !shareOpen) {
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
    generateShareLink()
  }, [
    canUseShareUrl,
    shareOpen,
    shareDependenciesFingerprint,
    isGeneratingShare,
    generateShareLink,
  ])

  return (
    <Box
      data-name="Header"
      background="default"
      borderWidth="0 0 1 0"
      borderColor="neutral-subtleA"
      paddingInline={{ xs: 'space-12', md: 'space-20' }}
      paddingBlock="space-8"
      as="header"
      className="app-header"
    >
      <HStack
        data-name="Header layout"
        justify="space-between"
        align="center"
        gap="space-16"
        className="app-header__layout"
      >
        <HStack
          data-name="Project info wrapper"
          gap={{ xs: 'space-16', md: 'space-32' }}
          align="center"
          className="app-header__project"
        >
          <HStack data-name="Title wrapper" gap="space-8" align="center">
            <AkselLogoMark />
            <Heading size="medium" level="1" className="app-header__title">
              Aksel Arcade
            </Heading>
          </HStack>
          <HStack
            data-name="Arcade name wrapper"
            gap="space-8"
            align="center"
            className="app-header__project-name-wrapper"
          >
            {isEditingProjectName ? (
              <HStack
                gap="space-16"
                align="center"
                className="app-header__project-name-editor"
              >
                <TextField
                  ref={projectNameInputRef}
                  label="Prosjektnavn"
                  hideLabel
                  size="small"
                  value={projectNameDraft}
                  onChange={(event) => setProjectNameDraft(event.target.value)}
                  onKeyDown={handleProjectNameKeyDown}
                  className="app-header__project-name-input"
                  maxLength={100}
                />

                <HStack gap="space-8" align="center" className="app-header__project-name-actions">
                  <Button
                    icon={<CheckmarkIcon title="Lagre" />}
                    variant="secondary"
                    data-color="success"
                    size="xsmall"
                    aria-label="Lagre prosjektnavn"
                    onClick={handleSaveProjectName}
                    disabled={!canSaveProjectName}
                  />
                  <Button
                    icon={<XMarkIcon title="Avbryt" />}
                    variant="secondary"
                    data-color="danger"
                    size="xsmall"
                    aria-label="Avbryt redigering av prosjektnavn"
                    onClick={handleCancelProjectNameEdit}
                  />
                </HStack>
              </HStack>
            ) : (
              <>
                <Detail className="app-header__project-name">
                  {projectName || 'My arcade file name'}
                </Detail>
                <Button
                  variant="tertiary"
                  data-color="neutral"
                  size="small"
                  icon={<PencilIcon title="Rediger prosjektnavn" />}
                  aria-label="Rediger prosjektnavn"
                  onClick={handleStartProjectNameEdit}
                />
              </>
            )}
          </HStack>
        </HStack>
        <HStack
          data-name="Button group"
          gap="space-12"
          align="center"
          className="app-header__controls"
        >
          <ProjectSizeIndicator sizeBytes={projectSizeBytes} maxSizeBytes={MAX_PROJECT_SIZE} />
          <SaveStatusIndicator status={saveStatus} />
          <Button
            variant="tertiary"
            data-color="neutral"
            size="small"
            icon={<FileExportIcon aria-hidden />}
            onClick={handleExport}
          >
            Export
          </Button>
          <Button
            variant="tertiary"
            data-color="neutral"
            size="small"
            icon={<FileImportIcon aria-hidden />}
            onClick={handleImportClick}
            aria-haspopup="dialog"
            aria-controls={importConfirmOpen ? importConfirmDialogId : undefined}
          >
            Import
          </Button>
          {canUseShareUrl && (
            <>
              <Button
                variant="tertiary"
                data-color="neutral"
                size="small"
                icon={<LinkIcon aria-hidden />}
                onClick={handleShareButtonClick}
                aria-label="Share project"
                ref={shareButtonRef}
                aria-expanded={shareOpen}
              />
              <Popover
                open={shareOpen}
                onClose={handleShareClose}
                anchorEl={shareButtonRef.current}
                placement="bottom-end"
              >
                <Popover.Content className="share-popover" data-testid="share-popover">
                  <VStack gap="space-12">
                    <Heading size="small" level="2">
                      Share this prototype
                    </Heading>
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
                      <>
                        <BodyLong size="small">
                          Generate a Web share URL so teammates can load this project without
                          downloading an Arcade project package.
                        </BodyLong>
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
                                    This project is too large for a Web share URL. Use Export
                                    instead.
                                  </BodyLong>
                                  {shareLengthDetailText && (
                                    <Detail
                                      size="small"
                                      className="share-popover__oversize-details"
                                    >
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
                        {shareMeta}
                        <textarea
                          ref={clipboardBufferRef}
                          className="share-popover__clipboard-buffer"
                          aria-hidden="true"
                          tabIndex={-1}
                          readOnly
                          value={shareState.link ?? ''}
                        />
                      </>
                    )}
                  </VStack>
                </Popover.Content>
              </Popover>
            </>
          )}
          {canUseAgentSessions && (
            <Suspense fallback={null}>
              <AgentSessionMenu />
            </Suspense>
          )}
          <ActionMenu>
            <ActionMenu.Trigger>
              <Button
                variant="tertiary"
                data-color="neutral"
                size="small"
                icon={<CogIcon title="Settings" />}
                aria-label="Settings"
                data-testid="project-controls-settings"
              />
            </ActionMenu.Trigger>
            <ActionMenu.Content>
              <ActionMenu.Group label="Theme">
                <ActionMenu.Item
                  icon={theme === 'dark' ? <SunIcon aria-hidden /> : <MoonIcon aria-hidden />}
                  onSelect={toggleTheme}
                >
                  Switch to {theme === 'dark' ? 'light' : 'dark'} theme
                </ActionMenu.Item>
              </ActionMenu.Group>
              <ActionMenu.Divider />
              <ActionMenu.Group label="Templates">
                <ActionMenu.Item onSelect={onLoadFormSummaryTemplate}>
                  Oppsummeringsside for søknadsdialoger
                </ActionMenu.Item>
                <ActionMenu.Item onSelect={onLoadHooksDemo}>Hooks demo</ActionMenu.Item>
              </ActionMenu.Group>
              <ActionMenu.Divider />
              <ActionMenu.Group label="Editor">
                <Detail as="p" style={{ padding: '0.25rem 0.75rem', opacity: 0.6 }}>
                  Aksel Arcade v{__APP_VERSION__}
                </Detail>
                <ActionMenu.Item
                  icon={<ArrowsSquarepathIcon aria-hidden />}
                  onSelect={togglePanelOrder}
                >
                  Swap panel order
                </ActionMenu.Item>
                <ActionMenu.Item icon={<ArrowUndoIcon aria-hidden />} onSelect={onResetToIntro}>
                  Reset editor
                </ActionMenu.Item>
              </ActionMenu.Group>
            </ActionMenu.Content>
          </ActionMenu>
        </HStack>

        <input
          ref={fileInputRef}
          type="file"
          accept={ARCADE_PROJECT_IMPORT_ACCEPT}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          aria-label="Import .akselarcade Arcade project package"
        />
        <Dialog open={importConfirmOpen} onOpenChange={(open) => setImportConfirmOpen(open)}>
          <Dialog.Popup
            id={importConfirmDialogId}
            role="alertdialog"
            aria-label="Bekreft import"
            closeOnOutsideClick={false}
          >
            <Dialog.Body>
              <BodyLong>
                Importing this Arcade project package replaces only this Web Arcade working copy.
                Continue?
              </BodyLong>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.CloseTrigger>
                <Button type="button" variant="secondary" data-color="neutral">
                  Avbryt
                </Button>
              </Dialog.CloseTrigger>
              <Button type="button" onClick={handleConfirmImport}>
                Importer
              </Button>
            </Dialog.Footer>
          </Dialog.Popup>
        </Dialog>
      </HStack>
    </Box>
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
