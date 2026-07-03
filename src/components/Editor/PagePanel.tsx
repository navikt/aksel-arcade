import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  ActionMenu,
  BodyShort,
  Box,
  Button,
  Detail,
  Dialog,
  HStack,
  TextField,
  VStack,
} from '@navikt/ds-react'
import {
  CheckmarkIcon,
  ExclamationmarkTriangleIcon,
  HouseIcon,
  LinkBrokenIcon,
  MenuElipsisVerticalIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@navikt/aksel-icons'
import type { DeletePageImpact } from '@/services/pageReferences'
import type { ArcadePage, ArcadePageId, SelectedEditTarget } from '@/types/project'
import './PagePanel.css'

const EMPTY_DELETE_PAGE_IMPACT: DeletePageImpact = {
  referenceCount: 0,
  pageCount: 0,
  globalConfigReferenceCount: 0,
}

const formatDeleteImpactLocations = ({
  pageCount,
  globalConfigReferenceCount,
}: DeletePageImpact): string => {
  const locations: string[] = []
  if (pageCount > 0) {
    locations.push(`${pageCount} page${pageCount === 1 ? '' : 's'}`)
  }
  if (globalConfigReferenceCount > 0) {
    locations.push('Global config')
  }

  return locations.join(' and ')
}

interface PagePanelProps {
  activePageId: ArcadePageId
  startPageId: ArcadePageId
  pages: ArcadePage[]
  annotationRecordCounts: Partial<Record<ArcadePageId, number>>
  brokenNavigationPageIds: ArcadePageId[]
  deletePageImpacts: Partial<Record<ArcadePageId, DeletePageImpact>>
  errorPageIds: ArcadePageId[]
  selectedEditTarget: SelectedEditTarget
  onAddPage: () => void
  onSelectGlobalConfig: () => void
  onSelectPage: (pageId: ArcadePageId) => void
  onRenamePage: (pageId: ArcadePageId, name: string) => void
  onDeletePage: (pageId: ArcadePageId) => void
  onSetStartPage: (pageId: ArcadePageId) => void
}

export const PagePanel = ({
  activePageId,
  startPageId,
  pages,
  annotationRecordCounts,
  brokenNavigationPageIds,
  deletePageImpacts,
  errorPageIds,
  selectedEditTarget,
  onAddPage,
  onSelectGlobalConfig,
  onSelectPage,
  onRenamePage,
  onDeletePage,
  onSetStartPage,
}: PagePanelProps) => {
  const [renamingPageId, setRenamingPageId] = useState<ArcadePageId | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [deletePageId, setDeletePageId] = useState<ArcadePageId | null>(null)
  const renameInputRef = useRef<HTMLInputElement | null>(null)
  const rowButtonRefs = useRef(new Map<ArcadePageId, HTMLButtonElement>())

  const deletePageCandidate = deletePageId
    ? (pages.find((page) => page.id === deletePageId) ?? null)
    : null
  const deletePageImpact = deletePageCandidate
    ? (deletePageImpacts[deletePageCandidate.id] ?? EMPTY_DELETE_PAGE_IMPACT)
    : EMPTY_DELETE_PAGE_IMPACT
  const deletePageAnnotationRecordCount = deletePageCandidate
    ? (annotationRecordCounts[deletePageCandidate.id] ?? 0)
    : 0

  useEffect(() => {
    if (renamingPageId && !pages.some((page) => page.id === renamingPageId)) {
      setRenamingPageId(null)
      setRenameDraft('')
      setRenameError(null)
    }

    if (deletePageId && !pages.some((page) => page.id === deletePageId)) {
      setDeletePageId(null)
    }
  }, [deletePageId, pages, renamingPageId])

  useEffect(() => {
    if (!renamingPageId) {
      return
    }

    renameInputRef.current?.focus()
    renameInputRef.current?.select()
  }, [renamingPageId])

  const focusPageRow = (pageId: ArcadePageId) => {
    window.setTimeout(() => {
      rowButtonRefs.current.get(pageId)?.focus()
    }, 0)
  }

  const registerRowButtonRef = (pageId: ArcadePageId) => (node: HTMLButtonElement | null) => {
    if (node) {
      rowButtonRefs.current.set(pageId, node)
      return
    }

    rowButtonRefs.current.delete(pageId)
  }

  const handleRenameStart = (page: ArcadePage) => {
    setRenamingPageId(page.id)
    setRenameDraft(page.name)
    setRenameError(null)
  }

  const handleRenameCancel = () => {
    if (!renamingPageId) {
      return
    }

    const pageId = renamingPageId
    setRenamingPageId(null)
    setRenameDraft('')
    setRenameError(null)
    focusPageRow(pageId)
  }

  const handleRenameSave = () => {
    if (!renamingPageId) {
      return
    }

    const normalizedName = renameDraft.trim()
    if (!normalizedName) {
      setRenameError('Page name must not be empty')
      return
    }

    const pageId = renamingPageId
    onRenamePage(pageId, normalizedName)
    setRenamingPageId(null)
    setRenameDraft('')
    setRenameError(null)
    focusPageRow(pageId)
  }

  const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleRenameSave()
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      handleRenameCancel()
    }
  }

  const handleDeleteConfirm = () => {
    if (!deletePageCandidate) {
      return
    }

    onDeletePage(deletePageCandidate.id)
    setDeletePageId(null)
  }
  const isGlobalConfigActive = selectedEditTarget === 'global-config'
  const isPageTargetActive = selectedEditTarget === 'page'

  return (
    <>
      <Box
        as="aside"
        id="page-panel"
        className="page-panel"
        borderWidth="0 1 0 0"
        borderColor="neutral-subtleA"
      >
        <VStack gap="space-24" className="page-panel__content">
          <section aria-label="Config">
            <Detail className="page-panel__section-label" size="small">
              Config
            </Detail>
            <button
              type="button"
              className="page-panel__row page-panel__row--config"
              data-active-page={isGlobalConfigActive}
              onClick={onSelectGlobalConfig}
            >
              <BodyShort size="small" weight="semibold" className="page-panel__title">
                Global config
              </BodyShort>
              <Detail size="small" className="page-panel__subtitle-text">
                Shared JSX and Hooks
              </Detail>
            </button>
          </section>

          <section aria-label="Pages">
            <Detail className="page-panel__section-label" size="small">
              Pages
            </Detail>
            <VStack gap="space-4">
              {pages.map((page) => {
                const isActivePage = isPageTargetActive && page.id === activePageId
                const isStartPage = page.id === startPageId
                const hasError = errorPageIds.includes(page.id)
                const hasBrokenNavigation = brokenNavigationPageIds.includes(page.id)
                const pageStatusIndicator = hasError ? (
                  <span
                    className="page-panel__indicator page-panel__indicator--danger"
                    aria-label="Page error"
                    role="img"
                  >
                    <ExclamationmarkTriangleIcon aria-hidden fontSize="1.25rem" />
                  </span>
                ) : hasBrokenNavigation ? (
                  <span
                    className="page-panel__indicator page-panel__indicator--danger"
                    aria-label="Broken page navigation"
                    role="img"
                  >
                    <LinkBrokenIcon aria-hidden fontSize="1.25rem" />
                  </span>
                ) : null

                return (
                  <div key={page.id} className="page-panel__item" data-active-page={isActivePage}>
                    {renamingPageId === page.id ? (
                      <div className="page-panel__row page-panel__row--page page-panel__rename">
                        <div className="page-panel__rename-fields">
                          <TextField
                            ref={renameInputRef}
                            label={`Rename ${page.name}`}
                            hideLabel
                            size="small"
                            className="page-panel__rename-input"
                            value={renameDraft}
                            onChange={(event) => {
                              setRenameDraft(event.target.value)
                              if (renameError) {
                                setRenameError(null)
                              }
                            }}
                            onKeyDown={handleRenameKeyDown}
                            error={renameError ?? undefined}
                          />
                        </div>
                        <HStack gap="space-4" className="page-panel__rename-actions">
                          <Button
                            icon={<CheckmarkIcon aria-hidden />}
                            variant="tertiary"
                            data-color="success"
                            size="xsmall"
                            aria-label={`Save name for ${page.name}`}
                            onClick={handleRenameSave}
                            disabled={renameDraft.trim().length === 0}
                          />
                          <Button
                            icon={<XMarkIcon aria-hidden />}
                            variant="tertiary"
                            data-color="danger"
                            size="xsmall"
                            aria-label={`Cancel rename for ${page.name}`}
                            onClick={handleRenameCancel}
                          />
                        </HStack>
                      </div>
                    ) : (
                      <>
                        <button
                          ref={registerRowButtonRef(page.id)}
                          type="button"
                          className="page-panel__row page-panel__row--page"
                          data-active-page={isActivePage}
                          aria-current={isActivePage ? 'page' : undefined}
                          onClick={() => onSelectPage(page.id)}
                        >
                          <div className="page-panel__row-header">
                            <BodyShort size="small" weight="semibold" className="page-panel__title">
                              {page.name}
                            </BodyShort>
                            {pageStatusIndicator}
                          </div>
                          <div className="page-panel__row-subtitle">
                            {isStartPage && (
                              <span
                                className="page-panel__indicator page-panel__indicator--home"
                                aria-label="Home page"
                                role="img"
                              >
                                <HouseIcon aria-hidden fontSize="1rem" />
                              </span>
                            )}
                            <Detail size="small" className="page-panel__subtitle-text">
                              {page.id}
                            </Detail>
                          </div>
                        </button>
                        <div className="page-panel__actions">
                          <ActionMenu>
                            <ActionMenu.Trigger>
                              <Button
                                variant="tertiary"
                                data-color="neutral"
                                size="xsmall"
                                className="page-panel__actions-trigger"
                                aria-label={`Page actions for ${page.name}`}
                                icon={<MenuElipsisVerticalIcon aria-hidden />}
                              />
                            </ActionMenu.Trigger>
                            <ActionMenu.Content>
                              <ActionMenu.Label>Actions</ActionMenu.Label>
                              <ActionMenu.Item
                                icon={<HouseIcon aria-hidden />}
                                disabled={isStartPage}
                                onSelect={() => onSetStartPage(page.id)}
                              >
                                Set as start page
                              </ActionMenu.Item>
                              <ActionMenu.Item
                                icon={<PencilIcon aria-hidden />}
                                onSelect={() => handleRenameStart(page)}
                              >
                                Rename
                              </ActionMenu.Item>
                              <ActionMenu.Divider />
                              <ActionMenu.Item
                                variant="danger"
                                icon={<TrashIcon aria-hidden />}
                                disabled={pages.length <= 1}
                                onSelect={() => setDeletePageId(page.id)}
                              >
                                Delete page
                              </ActionMenu.Item>
                            </ActionMenu.Content>
                          </ActionMenu>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </VStack>
          </section>
        </VStack>

        <div className="page-panel__footer">
          <Button
            variant="secondary"
            data-color="neutral"
            size="small"
            icon={<PlusIcon aria-hidden />}
            className="page-panel__add-button"
            onClick={onAddPage}
          >
            Add page
          </Button>
        </div>
      </Box>

      <Dialog
        open={Boolean(deletePageCandidate)}
        onOpenChange={(open) => !open && setDeletePageId(null)}
      >
        <Dialog.Popup role="alertdialog" aria-label="Delete page" closeOnOutsideClick={false}>
          <Dialog.Body>
            <VStack gap="space-12">
              <BodyShort>
                Delete <strong>{deletePageCandidate?.name}</strong>? This removes page id{' '}
                <strong>{deletePageCandidate?.id}</strong> from this working copy.
              </BodyShort>
              {deletePageCandidate?.id === startPageId && (
                <BodyShort size="small">
                  This page is currently the Start page. The first remaining page will become the
                  new Start page.
                </BodyShort>
              )}
              {deletePageImpact.referenceCount > 0 ? (
                <BodyShort size="small">
                  Deleting this page will leave{' '}
                  <strong>
                    {deletePageImpact.referenceCount} stale page reference
                    {deletePageImpact.referenceCount === 1 ? '' : 's'}
                  </strong>{' '}
                  across <strong>{formatDeleteImpactLocations(deletePageImpact)}</strong>.
                </BodyShort>
              ) : (
                <BodyShort size="small">
                  No existing page navigation references currently point to this page.
                </BodyShort>
              )}
              {deletePageAnnotationRecordCount > 0 && (
                <BodyShort size="small">
                  Deleting this page will also delete{' '}
                  <strong>
                    {deletePageAnnotationRecordCount} annotation record
                    {deletePageAnnotationRecordCount === 1 ? '' : 's'}
                  </strong>{' '}
                  attached to it.
                </BodyShort>
              )}
            </VStack>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.CloseTrigger>
              <Button type="button" variant="secondary" data-color="neutral">
                Cancel
              </Button>
            </Dialog.CloseTrigger>
            <Button
              type="button"
              variant="primary"
              data-color="danger"
              onClick={handleDeleteConfirm}
            >
              Delete page
            </Button>
          </Dialog.Footer>
        </Dialog.Popup>
      </Dialog>
    </>
  )
}
