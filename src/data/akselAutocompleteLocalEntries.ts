import type { AkselAutocompleteEntry } from './akselAutocompleteData'

// The generated docs data currently omits InfoCard.Message even though the
// installed Aksel package exposes it, so we keep a small local supplement.
export const AKSEL_AUTOCOMPLETE_LOCAL_ENTRIES: AkselAutocompleteEntry[] = [
  {
    name: 'InfoCard.Message',
    group: 'component',
    status: 'current',
    docs: 'https://aksel.nav.no/komponenter/core/infocard',
    props: [
      {
        name: 'icon',
        type: '`ReactNode`',
        values: [],
        required: true,
        description: 'Icon to display in message.',
      },
      {
        name: 'className',
        type: '`string`',
        values: [],
        required: false,
        description: '',
      },
      {
        name: 'ref',
        type: '`RefHTMLDivElement`',
        values: [],
        required: false,
        description: '',
      },
    ],
  },
]
