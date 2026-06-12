import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Box, Process, Tabs, Timeline } from '@navikt/ds-react'

function TabsExample() {
  const [selectedTab, setSelectedTab] = useState('overview')

  return (
    <Tabs value={selectedTab} onChange={setSelectedTab}>
      <Tabs.List>
        <Tabs.Tab value="overview" label="Overview" />
        <Tabs.Tab value="timeline" label="Timeline" />
        <Tabs.Tab value="documents" label="Documents" />
      </Tabs.List>
      <Tabs.Panel value="overview">Overview of the application.</Tabs.Panel>
      <Tabs.Panel value="timeline">Timeline of the case.</Tabs.Panel>
      <Tabs.Panel value="documents">Attachments and letters.</Tabs.Panel>
    </Tabs>
  )
}

function ProcessExample() {
  return (
    <Process>
      <Process.Event status="completed" title="Application received" timestamp="10 June 2026">
        We have received your application and attachments.
      </Process.Event>
      <Process.Event
        status="active"
        title="Case officer is reviewing the application"
        timestamp="12 June 2026"
      >
        You will get a message if we need more information.
      </Process.Event>
      <Process.Event title="Decision is ready" timestamp="Expected this week">
        We notify you as soon as the decision is available.
      </Process.Event>
    </Process>
  )
}

function TimelineExample() {
  return (
    <Box marginInline="auto" maxWidth="800px">
      <Timeline>
        <Timeline.Pin date={new Date('2025-05-12')}>
          Follow-up meeting with the employer
        </Timeline.Pin>
        <Timeline.Row label="Sick leave">
          <Timeline.Period
            start={new Date('2025-05-01')}
            end={new Date('2025-05-14')}
            status="warning"
            statusLabel="Sick leave"
          >
            50% sick leave
          </Timeline.Period>
          <Timeline.Period
            start={new Date('2025-05-15')}
            end={new Date('2025-05-31')}
            status="success"
            statusLabel="Return plan"
          >
            Gradual return to work
          </Timeline.Period>
        </Timeline.Row>
        <Timeline.Row label="Payments">
          <Timeline.Period
            start={new Date('2025-05-05')}
            end={new Date('2025-05-20')}
            status="info"
            statusLabel="Benefit payment"
          >
            First benefit payment
          </Timeline.Period>
        </Timeline.Row>
      </Timeline>
    </Box>
  )
}

describe('compound insertion runtime examples', () => {
  it('switches panels in the Tabs example', async () => {
    const user = userEvent.setup()

    render(<TabsExample />)

    const overviewTab = screen.getByRole('tab', { name: 'Overview' })
    const timelineTab = screen.getByRole('tab', { name: 'Timeline' })

    expect(overviewTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('Overview of the application.')).toBeTruthy()

    await user.click(timelineTab)

    expect(timelineTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('Timeline of the case.')).toBeTruthy()
  })

  it('renders the Process example without runtime errors', () => {
    render(<ProcessExample />)

    expect(screen.getByText('Application received')).toBeTruthy()
    expect(screen.getByText('Case officer is reviewing the application')).toBeTruthy()
    expect(screen.getByText('Decision is ready')).toBeTruthy()
  })

  it('renders the Timeline example without runtime errors', () => {
    render(<TimelineExample />)

    expect(screen.getByText('Sick leave')).toBeTruthy()
    expect(screen.getByText('Payments')).toBeTruthy()
  })
})
