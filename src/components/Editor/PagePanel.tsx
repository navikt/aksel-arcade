import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  ActionMenu,
  BodyShort,
  Box,
  Button,
  Detail,
  Dialog,
  HStack,
  VStack,
} from '@navikt/ds-react'
import { CheckmarkIcon, PlusIcon, XMarkIcon } from '@navikt/aksel-icons'
import type { ArcadePage, ArcadePageId, SelectedEditTarget } from '@/types/project'
import './PagePanel.css'

interface PagePanelProps {
  activePageId: ArcadePageId
  startPageId: ArcadePageId
  pages: ArcadePage[]
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
    ? pages.find((page) => page.id === deletePageId) ?? null
    : null

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

  const registerRowButtonRef =
    (pageId: ArcadePageId) => (node: HTMLButtonElement | null) => {
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

  return (
    <>
      <Box
        as="aside"
        className="page-panel"
        borderWidth="0 1 0 0"
        borderColor="neutral-subtleA"
        paddingInline="space-12"
        paddingBlock="space-16"
      >
        <VStack gap="space-24" className="page-panel__content">
          <section aria-label="Config">
            <Detail className="page-panel__section-label" size="small">
              Config
            </Detail>
            <button
              type="button"
              className="page-panel__row"
              data-editing={selectedEditTarget === 'global-config'}
              onClick={onSelectGlobalConfig}
            >
              <BodyShort weight="semibold">Global config</BodyShort>
              <Detail size="small">Shared JSX and Hooks</Detail>
            </button>
          </section>

          <section aria-label="Pages">
            <Detail className="page-panel__section-label" size="small">
              Pages
            </Detail>
            <VStack gap="space-8">
              {pages.map((page) => {
                const isActivePage = page.id === activePageId
                const isEditing = selectedEditTarget === 'page' && isActivePage
                const isStartPage = page.id === startPageId
                const statusLabels = [
                  ...(isActivePage ? ['Active page'] : []),
                  ...(isStartPage ? ['Start page'] : []),
                ]

                return (
                  <div key={page.id} className="page-panel__item">
                    {renamingPageId === page.id ? (
                      <div
                        className="page-panel__row page-panel__rename"
                        data-active-page={isActivePage}
                        data-editing={isEditing}
                      >
                        <div className="page-panel__rename-fields">
                          <input
                            ref={renameInputRef}
                            className="page-panel__rename-input"
                            aria-label={`Rename ${page.name}`}
                            value={renameDraft}
                            onChange={(event) => {
                              setRenameDraft(event.target.value)
                              if (renameError) {
                                setRenameError(null)
                              }
                            }}
                            onKeyDown={handleRenameKeyDown}
                          />
                          <Detail size="small">{page.id}</Detail>
                          {renameError && (
                            <Detail size="small" className="page-panel__rename-error" role="alert">
                              {renameError}
                            </Detail>
                          )}
                        </div>
                        <HStack gap="space-8" className="page-panel__rename-actions">
                          <Button
                            icon={<CheckmarkIcon aria-hidden />}
                            variant="secondary"
                            data-color="success"
                            size="xsmall"
                            aria-label={`Save name for ${page.name}`}
                            onClick={handleRenameSave}
                            disabled={renameDraft.trim().length === 0}
                          />
                          <Button
                            icon={<XMarkIcon aria-hidden />}
                            variant="secondary"
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
                          className="page-panel__row"
                          data-active-page={isActivePage}
                          data-editing={isEditing}
                          aria-current={isActivePage ? 'page' : undefined}
                          onClick={() => onSelectPage(page.id)}
                        >
                          <div className="page-panel__row-header">
                            <BodyShort weight="semibold">{page.name}</BodyShort>
                            {statusLabels.length > 0 && (
                              <Detail size="small" className="page-panel__status">
                                {statusLabels.join(' · ')}
                              </Detail>
                            )}
                          </div>
                          <Detail size="small">{page.id}</Detail>
                        </button>
                        <ActionMenu>
                          <ActionMenu.Trigger>
                            <Button
                              variant="tertiary"
                              data-color="neutral"
                              size="xsmall"
                              className="page-panel__actions-trigger"
                              aria-label={`Page actions for ${page.name}`}
                            >
                              ...
                            </Button>
                          </ActionMenu.Trigger>
                          <ActionMenu.Content>
                            <ActionMenu.Item
                              disabled={isStartPage}
                              onSelect={() => onSetStartPage(page.id)}
                            >
                              Set as start page
                            </ActionMenu.Item>
                            <ActionMenu.Item onSelect={() => handleRenameStart(page)}>
                              Rename
                            </ActionMenu.Item>
                            <ActionMenu.Item
                              disabled={pages.length <= 1}
                              onSelect={() => setDeletePageId(page.id)}
                            >
                              Delete page
                            </ActionMenu.Item>
                          </ActionMenu.Content>
                        </ActionMenu>
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
            onClick={onAddPage}
          >
            Add page
          </Button>
        </div>
      </Box>

      <Dialog open={Boolean(deletePageCandidate)} onOpenChange={(open) => !open && setDeletePageId(null)}>
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
            </VStack>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.CloseTrigger>
              <Button type="button" variant="secondary" data-color="neutral">
                Cancel
              </Button>
            </Dialog.CloseTrigger>
            <Button type="button" variant="primary" data-color="danger" onClick={handleDeleteConfirm}>
              Delete page
            </Button>
          </Dialog.Footer>
        </Dialog.Popup>
      </Dialog>
    </>
  )
}
