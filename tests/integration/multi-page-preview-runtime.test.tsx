import React, { forwardRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  createArcadePage,
  createArcadeSourceFile,
  FIRST_PAGE_ID,
} from '@/services/projectSource'
import { transpileProjectSource } from '@/services/transpiler'
import type { ProjectSource } from '@/types/project'

const Link = forwardRef<HTMLAnchorElement, React.ComponentProps<'a'>>(
  ({ children, ...props }, ref) => (
    <a ref={ref} {...props}>
      {children}
    </a>
  )
)

Link.displayName = 'Link'

const createProjectSource = ({
  globalConfigJsx = '',
  globalConfigHooks = '',
  pages = [
    createArcadePage(
      FIRST_PAGE_ID,
      'Page 1',
      createArcadeSourceFile(
        `export default function PageOne() {
  return <div data-testid="page-id">{currentPageId}</div>
}`,
        ''
      )
    ),
  ],
  startPageId = pages[0]?.id ?? FIRST_PAGE_ID,
}: {
  globalConfigJsx?: string
  globalConfigHooks?: string
  pages?: ProjectSource['pages']
  startPageId?: ProjectSource['startPageId']
} = {}): ProjectSource => ({
  globalConfig: createArcadeSourceFile(globalConfigJsx, globalConfigHooks),
  pages,
  startPageId,
  nextPageNumber: pages.length + 1,
})

const createRuntimeApp = (code: string): React.ComponentType => {
  const runtimeFactory = new Function(
    'React',
    'Link',
    `
const {
  Fragment,
  useState,
  useEffect,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useRef,
  useImperativeHandle,
  useLayoutEffect,
  useDebugValue,
  useId,
  useTransition,
  useDeferredValue,
  useSyncExternalStore,
  useInsertionEffect,
  useActionState,
  useOptimistic,
} = React;

${code}

return App;
`
  ) as (ReactRuntime: typeof React, LinkComponent: typeof Link) => React.ComponentType

  return runtimeFactory(React, Link)
}

const renderProjectPreview = async (source: ProjectSource) => {
  const result = await transpileProjectSource(source)

  expect(result.success).toBe(true)
  expect(result.code).toBeTruthy()

  const App = createRuntimeApp(result.code!)
  const container = document.createElement('div')
  container.id = 'root'
  document.body.appendChild(container)

  return render(<App />, { container })
}

describe('Multi-page preview runtime', () => {
  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it('opens on the configured start page', async () => {
    await renderProjectPreview(
      createProjectSource({
        startPageId: 'page02',
        pages: [
          createArcadePage(
            'page01',
            'Intro',
            createArcadeSourceFile(
              `export default function IntroPage() {
  return <div data-testid="page-id">page01</div>
}`,
              ''
            )
          ),
          createArcadePage(
            'page02',
            'Details',
            createArcadeSourceFile(
              `export default function DetailsPage() {
  return <div data-testid="page-id">page02</div>
}`,
              ''
            )
          ),
        ],
      })
    )

    expect((await screen.findByTestId('page-id')).textContent).toBe('page02')
    expect(screen.queryByText('page01')).toBeNull()
  })

  it('keeps global config scope shared across pages while remounting page-local state', async () => {
    const user = userEvent.setup()

    await renderProjectPreview(
      createProjectSource({
        globalConfigHooks: `let sharedVisits = 0

export const recordVisit = () => {
  sharedVisits += 1
}

export const getSharedVisits = () => sharedVisits`,
        globalConfigJsx: `export const SharedBanner = ({ title }) => (
  <div data-testid="shared-banner">{title}</div>
)`,
        pages: [
          createArcadePage(
            'page01',
            'Intro',
            createArcadeSourceFile(
              `export default function IntroPage() {
  return (
    <div>
      <SharedBanner title="Intro" />
      <div data-testid="page-id">{currentPageId}</div>
      <div data-testid="shared-visits">{String(getSharedVisits())}</div>
      <button
        type="button"
        onClick={() => {
          recordVisit()
          goToPage('page02')
        }}
      >
        Go details
      </button>
    </div>
  )
}`,
              ''
            )
          ),
          createArcadePage(
            'page02',
            'Details',
            createArcadeSourceFile(
              `export default function DetailsPage() {
  const [localCount, setLocalCount] = useState(0)

  return (
    <div>
      <SharedBanner title="Details" />
      <div data-testid="page-id">{currentPageId}</div>
      <div data-testid="shared-visits">{String(getSharedVisits())}</div>
      <div data-testid="local-count">{String(localCount)}</div>
      <button type="button" onClick={() => setLocalCount((value) => value + 1)}>
        Increment local
      </button>
      <button type="button" onClick={() => goToPage('page01')}>
        Back
      </button>
    </div>
  )
}`,
              ''
            )
          ),
        ],
      })
    )

    expect((await screen.findByTestId('page-id')).textContent).toBe('page01')
    expect(screen.getByTestId('shared-banner').textContent).toBe('Intro')
    expect(screen.getByTestId('shared-visits').textContent).toBe('0')

    await user.click(screen.getByRole('button', { name: /go details/i }))

    expect((await screen.findByTestId('page-id')).textContent).toBe('page02')
    expect(screen.getByTestId('shared-banner').textContent).toBe('Details')
    expect(screen.getByTestId('shared-visits').textContent).toBe('1')
    expect(screen.getByTestId('local-count').textContent).toBe('0')

    await user.click(screen.getByRole('button', { name: /increment local/i }))
    expect(screen.getByTestId('local-count').textContent).toBe('1')

    await user.click(screen.getByRole('button', { name: /^back$/i }))

    expect((await screen.findByTestId('page-id')).textContent).toBe('page01')
    expect(screen.getByTestId('shared-visits').textContent).toBe('1')

    await user.click(screen.getByRole('button', { name: /go details/i }))

    expect((await screen.findByTestId('page-id')).textContent).toBe('page02')
    expect(screen.getByTestId('shared-visits').textContent).toBe('2')
    expect(screen.getByTestId('local-count').textContent).toBe('0')
  })

  it('navigates page-id anchors rendered by Aksel-style links', async () => {
    const user = userEvent.setup()

    await renderProjectPreview(
      createProjectSource({
        pages: [
          createArcadePage(
            'page01',
            'Intro',
            createArcadeSourceFile(
              `export default function IntroPage() {
  return (
    <div>
      <div data-testid="page-id">{currentPageId}</div>
      <Link to="page02">
        <span>Open details</span>
      </Link>
    </div>
  )
}`,
              ''
            )
          ),
          createArcadePage(
            'page02',
            'Details',
            createArcadeSourceFile(
              `export default function DetailsPage() {
  return <div data-testid="page-id">{currentPageId}</div>
}`,
              ''
            )
          ),
        ],
      })
    )

    expect((await screen.findByTestId('page-id')).textContent).toBe('page01')

    await user.click(screen.getByText('Open details'))

    expect((await screen.findByTestId('page-id')).textContent).toBe('page02')
  })

  it('rejects bare global config JSX because it is shared scope, not a screen', async () => {
    const result = await transpileProjectSource(
      createProjectSource({
        globalConfigJsx: `<div>Not allowed as bare global config JSX</div>`,
      })
    )

    expect(result.success).toBe(false)
    expect(result.error?.message).toContain('Global config JSX')
  })
})
