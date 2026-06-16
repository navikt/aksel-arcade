import { CURRENT_PROJECT_VERSION, type Project, type ViewportSize } from '@/types/project'
import type { EditorState } from '@/types/editor'
import type { PreviewState } from '@/types/preview'
import { generateSecureUUID } from '@/utils/crypto'
import { FIRST_PAGE_ID, createSinglePageProjectSource } from '@/services/projectSource'
import { getViewportWidth } from '@/types/viewports'

// Intro content that showcases features
export const INTRO_JSX_CODE = `<Box
  padding="space-16"
  background="raised"
  borderRadius="12"
  borderWidth="1"
  borderColor="neutral-subtleA"
>
  <VStack gap="space-8">
    <Heading size="large" level="1">
      👋 Welcome to Aksel Arcade!
    </Heading>
    <BodyLong>
      A browser-based React playground for Aksel v8 components.
    </BodyLong>

    <VStack gap="space-4" paddingBlock="space-12">
      <Heading size="small" level="2">
        ✨ Features:
      </Heading>
      <List as="ul">
        <List.Item>
          <strong>Two tabs:</strong> JSX for components, Hooks for custom logic
        </List.Item>
        <List.Item>
          <strong>Live preview:</strong> See changes instantly
        </List.Item>
        <List.Item>
          <strong>Component palette:</strong> Click "Add" to insert components
        </List.Item>
        <List.Item>
          <strong>Format code:</strong> Prettier integration
        </List.Item>
        <List.Item>
          <strong>Responsive testing:</strong> Toggle viewports
        </List.Item>
        <List.Item>
          <strong>Auto-save:</strong> Your work is saved automatically
        </List.Item>
      </List>
    </VStack>

    <InlineMessage status="info">
      <strong>Quick tip:</strong> Delete this intro and start coding! You can always reset via
      Settings → Reset editor.
    </InlineMessage>
  </VStack>
</Box>`

export const INTRO_HOOKS_CODE = `// Define custom hooks here
// Example:
// export const useToggle = (initial = false) => {
//   const [value, setValue] = useState(initial);
//   const toggle = () => setValue(v => !v);
//   return [value, toggle];
// };
//
// React hooks like useState are available without imports.`

export const HOOKS_DEMO_HOOKS_CODE = `// Custom hook for form state management
export const useForm = (initialValues = {}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleChange = (name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!values.name?.trim()) {
      newErrors.name = 'Navn er påkrevd';
    }
    if (!values.email?.trim()) {
      newErrors.email = 'E-post er påkrevd';
    } else if (!/\\S+@\\S+\\.\\S+/.test(values.email)) {
      newErrors.email = 'Ugyldig e-postadresse';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const reset = () => {
    setValues(initialValues);
    setErrors({});
  };

  const dismissConfirmation = () => {
    setShowConfirmation(false);
  };

  return {
    values,
    errors,
    handleChange,
    validate,
    reset,
    showConfirmation,
    setShowConfirmation,
    dismissConfirmation,
  };
};

// Custom hook for toggling visibility
export const useToggle = (initialValue = false) => {
  const [isOn, setIsOn] = useState(initialValue);
  
  const toggle = () => setIsOn(prev => !prev);
  const setOn = () => setIsOn(true);
  const setOff = () => setIsOn(false);
  
  return { isOn, toggle, setOn, setOff };
};

// Custom hook for counter with min/max limits
export const useCounter = (initialValue = 0, min = 0, max = 100) => {
  const [count, setCount] = useState(initialValue);
  
  const increment = () => setCount(prev => Math.min(prev + 1, max));
  const decrement = () => setCount(prev => Math.max(prev - 1, min));
  const reset = () => setCount(initialValue);
  const setValue = (value) => setCount(Math.max(min, Math.min(value, max)));
  
  return { count, increment, decrement, reset, setValue };
};`

export const HOOKS_DEMO_JSX_CODE = `(() => {
  const form = useForm({ name: '', email: '', message: '' });
  const details = useToggle(false);
  const likes = useCounter(0, 0, 999);
  
  const handleSubmit = () => {
    // Don't resubmit if the confirmation message is already shown
    if (form.showConfirmation) {
      return;
    }
    if (form.validate()) {
      form.setShowConfirmation(true);
    }
  };

  return (
    <Box padding="space-16" background="default">
      <VStack gap="space-12">
        <Heading size="xlarge" level="1">
          🎮 Aksel Arcade Demo
        </Heading>
        
        <BodyLong>
          Dette eksemplet demonstrerer tre custom hooks: <code>useForm</code>, <code>useToggle</code>, og <code>useCounter</code>.
        </BodyLong>

        {/* Counter Demo */}
        <Box
          padding="space-8"
          background="raised"
          borderRadius="8"
          borderWidth="1"
          borderColor="neutral-subtleA"
        >
          <VStack gap="space-4">
            <Heading size="medium" level="2">
              👍 Likes: {likes.count}
            </Heading>
            <HStack gap="space-4">
              <Button variant="secondary" onClick={likes.decrement} size="small">
                👎 Minus
              </Button>
              <Button variant="primary" onClick={likes.increment} size="small">
                👍 Pluss
              </Button>
              <Button variant="tertiary" onClick={likes.reset} size="small">
                Nullstill
              </Button>
            </HStack>
          </VStack>
        </Box>

        {/* Toggle Demo */}
        <Box
          padding="space-8"
          background="raised"
          borderRadius="8"
          borderWidth="1"
          borderColor="neutral-subtleA"
        >
          <VStack gap="space-4">
            <HStack gap="space-4" align="center">
              <Heading size="medium" level="2">
                📋 Detaljer
              </Heading>
              <Switch checked={details.isOn} onChange={details.toggle}>
                Vis detaljer
              </Switch>
            </HStack>
            
            {details.isOn && (
              <InlineMessage status="info">
                <strong>Om custom hooks:</strong>{' '}
                <span>
                  Custom hooks lat deg gjenbruke stateful logikk mellom komponenter.
                </span>{' '}
                <span>
                  De starter alltid med <code>use</code> og kan kalle andre hooks.
                </span>
              </InlineMessage>
            )}
          </VStack>
        </Box>

        {/* Form Demo */}
        <Box
          padding="space-8"
          background="raised"
          borderRadius="8"
          borderWidth="1"
          borderColor="neutral-subtleA"
        >
          <form>
            <VStack gap="space-6">
              <Heading size="medium" level="2">
                📬 Kontaktskjema
              </Heading>
              
              <TextField
                label="Navn"
                value={form.values.name || ''}
                onChange={(e) => form.handleChange('name', e.target.value)}
                error={form.errors.name}
              />
              
              <TextField
                label="E-post"
                type="email"
                value={form.values.email || ''}
                onChange={(e) => form.handleChange('email', e.target.value)}
                error={form.errors.email}
              />
              
              <Textarea
                label="Melding (valgfri)"
                value={form.values.message || ''}
                onChange={(e) => form.handleChange('message', e.target.value)}
                minRows={3}
              />
              
              <HStack gap="space-4">
                <Button type="button" variant="primary" onClick={handleSubmit}>
                  Send inn
                </Button>
                <Button type="button" variant="secondary" onClick={form.reset}>
                  Nullstill
                </Button>
              </HStack>
              
              {form.showConfirmation && (
                <VStack gap="space-4">
                  <InlineMessage status="success">
                    <strong>Kamelåså!</strong> Now you just ordered thousands liters of milk!
                  </InlineMessage>
                  <Button
                    type="button"
                    variant="tertiary"
                    size="small"
                    onClick={form.dismissConfirmation}
                  >
                    Lukk meldingen
                  </Button>
                </VStack>
              )}
            </VStack>
          </form>
        </Box>

        <InlineMessage status="success">
          <strong>✨ Prøv å interagere!</strong>{' '}
          <span>
            Klikk på knappene, skriv i skjemaet, og slå av/på detaljer. 
            All state blir håndtert av custom hooks definert i Hooks-fanen.
          </span>
        </InlineMessage>
      </VStack>
    </Box>
  );
})()`

export const FORM_SUMMARY_JSX_CODE = `<Box asChild background="default" paddingBlock="space-12">
      <Page>
        <Page.Block as="main" width="text" gutters>
          <VStack gap="space-32">
            <VStack gap="space-12">
              <Bleed marginInline={{ lg: 'space-32' }}>
                <Box
                  width={{ xs: '64px', lg: '96px' }}
                  height={{ xs: '64px', lg: '96px' }}
                  background="accent-soft"
                  borderRadius="full"
                  aria-hidden
                  position={{ xs: 'relative', lg: 'absolute' }}
                />
              </Bleed>
              <VStack gap="space-4">
                <BodyShort size="small">Nav 10-07.03 (Om søknaden har ID)</BodyShort>
                <Heading level="1" size="xlarge">
                  Søknad om [ytelse]
                </Heading>
              </VStack>
            </VStack>

            <div data-aksel-template="form-summarypage-v4">
              <Link href="#">
                <ArrowLeftIcon aria-hidden /> Forrige steg
              </Link>
              <Box paddingBlock="space-6">
                <Heading level="2" size="large">
                  Oppsummering
                </Heading>
              </Box>
              <FormProgress activeStep={3} totalSteps={3}>
                <FormProgress.Step href="#">Steg 1</FormProgress.Step>
                <FormProgress.Step href="#">Steg 2</FormProgress.Step>
                <FormProgress.Step href="#">Oppsummering</FormProgress.Step>
              </FormProgress>
            </div>

            <GuidePanel poster>
              <BodyLong spacing>
                Nå kan du se over at alt er riktig før du sender inn søknaden. Ved behov kan du
                endre opplysningene.
              </BodyLong>
              <BodyLong>
                Når du har sendt inn søknaden kommer du til en kvitteringsside med informasjon om
                veien videre. Der kan du også ettersende dokumentasjon som mangler.
              </BodyLong>
            </GuidePanel>

            <FormSummary>
              <FormSummary.Header>
                <FormSummary.Heading level="2">Om deg</FormSummary.Heading>
              </FormSummary.Header>
              <FormSummary.Answers>
                <FormSummary.Answer>
                  <FormSummary.Label>Navn</FormSummary.Label>
                  <FormSummary.Value>Anakin Skywalker</FormSummary.Value>
                </FormSummary.Answer>
                <FormSummary.Answer>
                  <FormSummary.Label>Fødselsnummer</FormSummary.Label>
                  <FormSummary.Value>123456 78912</FormSummary.Value>
                </FormSummary.Answer>
                <FormSummary.Answer>
                  <FormSummary.Label>Folkeregistrert adresse</FormSummary.Label>
                  <FormSummary.Value>
                    Tulleveien 1337
                    <br />
                    0472 Oslo
                  </FormSummary.Value>
                </FormSummary.Answer>
                <FormSummary.Answer>
                  <FormSummary.Label>Telefon</FormSummary.Label>
                  <FormSummary.Value>90 90 90 90</FormSummary.Value>
                </FormSummary.Answer>
                <FormSummary.Answer>
                  <FormSummary.Label>E-postadresse</FormSummary.Label>
                  <FormSummary.Value>mail@tull.tøys</FormSummary.Value>
                </FormSummary.Answer>
              </FormSummary.Answers>
              <FormSummary.Footer>
                <FormSummary.EditLink href="/eksempel" />
              </FormSummary.Footer>
            </FormSummary>

            <FormSummary>
              <FormSummary.Header>
                <FormSummary.Heading level="2">Barnetillegg</FormSummary.Heading>
              </FormSummary.Header>
              <FormSummary.Answers>
                <FormSummary.Answer>
                  <FormSummary.Label>Barn nr. 1</FormSummary.Label>
                  <FormSummary.Value>
                    <FormSummary.Answers>
                      <FormSummary.Answer>
                        <FormSummary.Label>Navn</FormSummary.Label>
                        <FormSummary.Value>Luke Skywalker</FormSummary.Value>
                      </FormSummary.Answer>
                      <FormSummary.Answer>
                        <FormSummary.Label>Fødselsdato</FormSummary.Label>
                        <FormSummary.Value>19 BBY</FormSummary.Value>
                      </FormSummary.Answer>
                    </FormSummary.Answers>
                  </FormSummary.Value>
                </FormSummary.Answer>
                <FormSummary.Answer>
                  <FormSummary.Label>Barn nr. 2</FormSummary.Label>
                  <FormSummary.Value>
                    <FormSummary.Answers>
                      <FormSummary.Answer>
                        <FormSummary.Label>Navn</FormSummary.Label>
                        <FormSummary.Value>Leia Organa</FormSummary.Value>
                      </FormSummary.Answer>
                      <FormSummary.Answer>
                        <FormSummary.Label>Fødselsdato</FormSummary.Label>
                        <FormSummary.Value>19 BBY</FormSummary.Value>
                      </FormSummary.Answer>
                    </FormSummary.Answers>
                  </FormSummary.Value>
                </FormSummary.Answer>
              </FormSummary.Answers>
              <FormSummary.Footer>
                <FormSummary.EditLink href="/eksempel" />
              </FormSummary.Footer>
            </FormSummary>

            <VStack gap="space-16">
              <BodyShort as="div" size="small" textColor="subtle">
                Sist lagret: 10. mars 2024 kl. 13.55
              </BodyShort>
              <HGrid
                gap={{ xs: 'space-16', sm: 'space-32 space-16' }}
                columns={{ xs: 1, sm: 2 }}
                width={{ sm: 'fit-content' }}
              >
                <Hide above="sm" asChild>
                  <Button
                    variant="primary"
                    icon={<PaperplaneIcon aria-hidden />}
                    iconPosition="right"
                  >
                    Send søknad
                  </Button>
                </Hide>
                <Button
                  variant="secondary"
                  icon={<ArrowLeftIcon aria-hidden />}
                  iconPosition="left"
                >
                  Forrige steg
                </Button>
                <Show above="sm" asChild>
                  <Button
                    variant="primary"
                    icon={<PaperplaneIcon aria-hidden />}
                    iconPosition="right"
                  >
                    Send søknad
                  </Button>
                </Show>

                <Box asChild marginBlock={{ xs: 'space-16', sm: 'space-0' }}>
                  <Button
                    variant="tertiary"
                    icon={<FloppydiskIcon aria-hidden />}
                    iconPosition="left"
                  >
                    Fortsett senere
                  </Button>
                </Box>
                <Button variant="tertiary" icon={<TrashIcon aria-hidden />} iconPosition="left">
                  Slett søknaden
                </Button>
              </HGrid>
            </VStack>
          </VStack>
        </Page.Block>
      </Page>
    </Box>`

export const createDefaultProject = (): Project => ({
  id: generateSecureUUID(),
  name: 'Untitled Project',
  source: createSinglePageProjectSource(INTRO_JSX_CODE, INTRO_HOOKS_CODE),
  activePageId: FIRST_PAGE_ID,
  viewportSize: 'MD',
  panelLayout: 'editor-left',
  version: CURRENT_PROJECT_VERSION,
  createdAt: new Date().toISOString(),
  lastModified: new Date().toISOString(),
})

export const createDefaultEditorState = (): EditorState => ({
  activeTab: 'JSX',
  isCodeEditorFocused: false,
  jsxCursor: { line: 0, column: 0 },
  hooksCursor: { line: 0, column: 0 },
  jsxSelection: null,
  hooksSelection: null,
  jsxHistory: { past: [], current: '', future: [] },
  hooksHistory: { past: [], current: '', future: [] },
  jsxErrors: [],
  hooksErrors: [],
})

export const createDefaultPreviewState = (viewportSize: ViewportSize = 'MD'): PreviewState => ({
  status: 'idle',
  transpiledCode: null,
  compileError: null,
  pendingCompileError: null,
  runtimeError: null,
  sandboxConsoleMessages: [],
  inspectEnabled: false,
  inspectedElement: null,
  currentViewport: viewportSize,
  viewportWidth: getViewportWidth(viewportSize),
  lastRenderTime: Date.now(),
  renderDuration: 0,
})
