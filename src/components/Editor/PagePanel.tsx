import { BodyShort, Box, Detail, VStack } from '@navikt/ds-react'
import type { ArcadePage, ArcadePageId, SelectedEditTarget } from '@/types/project'
import './PagePanel.css'

interface PagePanelProps {
  activePageId: ArcadePageId
  pages: ArcadePage[]
  selectedEditTarget: SelectedEditTarget
  onSelectGlobalConfig: () => void
  onSelectPage: (pageId: ArcadePageId) => void
}

export const PagePanel = ({
  activePageId,
  pages,
  selectedEditTarget,
  onSelectGlobalConfig,
  onSelectPage,
}: PagePanelProps) => {
  return (
    <Box
      as="aside"
      className="page-panel"
      borderWidth="0 1 0 0"
      borderColor="neutral-subtleA"
      paddingInline="space-12"
      paddingBlock="space-16"
    >
      <VStack gap="space-24">
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

              return (
                <button
                  key={page.id}
                  type="button"
                  className="page-panel__row"
                  data-active-page={isActivePage}
                  data-editing={isEditing}
                  aria-current={isActivePage ? 'page' : undefined}
                  onClick={() => onSelectPage(page.id)}
                >
                  <div className="page-panel__row-header">
                    <BodyShort weight="semibold">{page.name}</BodyShort>
                    {isActivePage && (
                      <Detail size="small" className="page-panel__status">
                        Active page
                      </Detail>
                    )}
                  </div>
                  <Detail size="small">{page.id}</Detail>
                </button>
              )
            })}
          </VStack>
        </section>
      </VStack>
    </Box>
  )
}
