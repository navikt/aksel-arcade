import type { Project } from '@/types/project'
import type { EditorState } from '@/types/editor'
import type { PreviewState } from '@/types/preview'

// Intro content that showcases features
export const INTRO_JSX_CODE = `export default function App() {
  return (
    <BoxNew
      padding="space-16"
      background="raised"
      borderRadius="xlarge"
      borderWidth="1"
      borderColor="neutral-subtleA"
    >
      <VStack gap="space-8">
        <Heading size="large" level="1">👋 Welcome to Aksel Arcade!</Heading>
        <BodyLong>
          A browser-based React playground for Aksel Darkside components.
        </BodyLong>
        
        <VStack gap="space-4">
          <Heading size="small" level="2">✨ Features:</Heading>
          <BodyShort>• <strong>Two tabs:</strong> JSX for components, Hooks for custom logic</BodyShort>
          <BodyShort>• <strong>Live preview:</strong> See changes instantly</BodyShort>
          <BodyShort>• <strong>Component palette:</strong> Click "Add" to insert components</BodyShort>
          <BodyShort>• <strong>Format code:</strong> Prettier integration</BodyShort>
          <BodyShort>• <strong>Responsive testing:</strong> Toggle viewports</BodyShort>
          <BodyShort>• <strong>Auto-save:</strong> Your work is saved automatically</BodyShort>
        </VStack>
        
        <Alert variant="info">
          <strong>Quick tip:</strong> Delete this intro and start coding! You can always reset via Settings → Reset editor.
        </Alert>
      </VStack>
    </BoxNew>
  )
}`

export const INTRO_HOOKS_CODE = `// Define custom hooks here
// Example:
// import { useState } from 'react';
//
// export const useToggle = (initial = false) => {
//   const [value, setValue] = useState(initial);
//   const toggle = () => setValue(v => !v);
//   return [value, toggle];
// };`

export const HOOKS_DEMO_HOOKS_CODE = `import { useState } from 'react';

// Custom hook for form state management
export const useForm = (initialValues = {}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});

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
      newErrors.name = 'Namn er påkravd';
    }
    if (!values.email?.trim()) {
      newErrors.email = 'E-post er påkravd';
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

  return { values, errors, handleChange, validate, reset };
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

export const HOOKS_DEMO_JSX_CODE = `import { useForm, useToggle, useCounter } from './hooks';

export default function App() {
  const form = useForm({ name: '', email: '', message: '' });
  const details = useToggle(false);
  const likes = useCounter(0, 0, 999);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.validate()) {
      alert(\`Skjema sendt!\\nNamn: \${form.values.name}\\nE-post: \${form.values.email}\`);
      form.reset();
    }
  };

  return (
    <BoxNew padding="space-16" background="default">
      <VStack gap="space-12">
        <Heading size="xlarge" level="1">
          🎮 Aksel Arcade Demo
        </Heading>
        
        <BodyLong>
          Dette eksemplet demonstrerer tre custom hooks: <code>useForm</code>, <code>useToggle</code>, og <code>useCounter</code>.
        </BodyLong>

        {/* Counter Demo */}
        <BoxNew
          padding="space-8"
          background="raised"
          borderRadius="large"
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
                Reset
              </Button>
            </HStack>
          </VStack>
        </BoxNew>

        {/* Toggle Demo */}
        <BoxNew
          padding="space-8"
          background="raised"
          borderRadius="large"
          borderWidth="1"
          borderColor="neutral-subtleA"
        >
          <VStack gap="space-4">
            <HStack gap="space-4" align="center">
              <Heading size="medium" level="2">
                📋 Detaljar
              </Heading>
              <Switch checked={details.isOn} onChange={details.toggle}>
                Vis detaljar
              </Switch>
            </HStack>
            
            {details.isOn && (
              <Alert variant="info">
                <Heading size="small" level="3" spacing>
                  Om custom hooks
                </Heading>
                <BodyShort spacing>
                  Custom hooks lèt deg gjenbruke stateful logikk mellom komponentar.
                </BodyShort>
                <BodyShort>
                  Dei byrjar alltid med <code>use</code> og kan kalle andre hooks.
                </BodyShort>
              </Alert>
            )}
          </VStack>
        </BoxNew>

        {/* Form Demo */}
        <BoxNew
          padding="space-8"
          background="raised"
          borderRadius="large"
          borderWidth="1"
          borderColor="neutral-subtleA"
        >
          <form onSubmit={handleSubmit}>
            <VStack gap="space-6">
              <Heading size="medium" level="2">
                📬 Kontaktskjema
              </Heading>
              
              <TextField
                label="Namn"
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
                label="Melding (valfri)"
                value={form.values.message || ''}
                onChange={(e) => form.handleChange('message', e.target.value)}
                minRows={3}
              />
              
              <HStack gap="space-4">
                <Button type="submit" variant="primary">
                  Send inn
                </Button>
                <Button type="button" variant="secondary" onClick={form.reset}>
                  Nullstill
                </Button>
              </HStack>
            </VStack>
          </form>
        </BoxNew>

        <Alert variant="success">
          <Heading size="small" level="3" spacing>
            ✨ Prøv å interagere!
          </Heading>
          <BodyShort>
            Klikk på knappane, skriv i skjemaet, og slå av/på detaljar. 
            All state blir handtert av custom hooks definert i Hooks-fana.
          </BodyShort>
        </Alert>
      </VStack>
    </BoxNew>
  );
}`

export const FORM_SUMMARY_JSX_CODE = `export default function App() {
  return (
    <BoxNew asChild background="default" paddingBlock="space-12">
      <Page>
        <Page.Block as="main" width="text" gutters>
          <VStack gap="8">
            <VStack gap="3">
              <Bleed asChild marginInline={{ lg: 'space-32' }}>
                <BoxNew
                  width={{ xs: '64px', lg: '96px' }}
                  height={{ xs: '64px', lg: '96px' }}
                  asChild
                  position={{ xs: 'relative', lg: 'absolute' }}
                />
              </Bleed>
              <VStack gap="1">
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
              <BoxNew paddingBlock="space-6">
                <Heading level="2" size="large">
                  Oppsummering
                </Heading>
              </BoxNew>
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

                <BoxNew asChild marginBlock={{ xs: 'space-16', sm: 'space-0' }}>
                  <Button
                    variant="tertiary"
                    icon={<FloppydiskIcon aria-hidden />}
                    iconPosition="left"
                  >
                    Fortsett senere
                  </Button>
                </BoxNew>
                <Button variant="tertiary" icon={<TrashIcon aria-hidden />} iconPosition="left">
                  Slett søknaden
                </Button>
              </HGrid>
            </VStack>
          </VStack>
        </Page.Block>
      </Page>
    </BoxNew>
  )
}`

export const createDefaultProject = (): Project => ({
  id: crypto.randomUUID(),
  name: 'Untitled Project',
  jsxCode: INTRO_JSX_CODE,
  hooksCode: INTRO_HOOKS_CODE,
  viewportSize: 'MD',
  panelLayout: 'editor-left',
  version: '1.0.0',
  createdAt: new Date().toISOString(),
  lastModified: new Date().toISOString(),
})

export const createDefaultEditorState = (): EditorState => ({
  activeTab: 'JSX',
  jsxCursor: { line: 0, column: 0 },
  hooksCursor: { line: 0, column: 0 },
  jsxSelection: null,
  hooksSelection: null,
  jsxHistory: { past: [], current: '', future: [] },
  hooksHistory: { past: [], current: '', future: [] },
  jsxErrors: [],
  hooksErrors: [],
})

export const createDefaultPreviewState = (): PreviewState => ({
  status: 'idle',
  transpiledCode: null,
  compileError: null,
  runtimeError: null,
  inspectEnabled: false,
  inspectedElement: null,
  currentViewport: 'MD',
  viewportWidth: 768,
  lastRenderTime: Date.now(),
  renderDuration: 0,
})
