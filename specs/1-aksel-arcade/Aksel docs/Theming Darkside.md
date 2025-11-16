Theming - Aksel.nav.no

Grunnleggende

Theming
=======

Aksel støtter theming for modusene light og dark. Denne artikkelen tar for seg det tekniske aspektet for theming. For design, se [Design i light og dark mode](/god-praksis/artikler/design-i-dark-mode-og-light-mode).

Vi bruker klassenavn `light` og `dark` for å bytte mellom fargemodus. Dette lar deg endre mellom light og darkmode ved å sette klassen på HTML-elementet, eller scopet til bare en liten del av appen. Som standard faller systemet tilbake på `light`, slik at du ikke trenger å legge dette til selv uten behov.

Theme
-----

Vi tilbyr en egen komponent for å definere fargemodus og setter bakgrunnsfarge. Du kan sette `hasBackground` til `false` hvis du ikke ønsker bakgrunn.

TSX

Deaktiver linjeskiftKopier

    <Theme theme="dark">   <App /></Theme>

### Props

#### className?

*   Type:
    
    `string`
    

#### hasBackground?

*   Type:
    
    `boolean`
    
*   Description:
    
    Sets default background when enabled
    

#### data-color?

*   Type:
    
    `AkselColor`
    
*   Description:
    
    Sets default 'base'-color for application
    

#### theme?

*   Type:
    
    `"light" | "dark"`
    
*   Default:
    
    `"Inherits parent theme, or "light" if root"`
    
*   Description:
    
    Color theme
    

#### asChild?

*   Type:
    
    `boolean`
    
*   Description:
    
    Renders the component and its child as a single element, merging the props of the component with the props of the child.
    
    Out: <MergedComponent data-prop data-child />
    
        @example ```
        <Component asChild data-prop>
          <ChildComponent data-child />
        </Component>
        
        Out:
        <MergedComponent data-prop data-child />
        
    
*   Example:
    
        ```
    

#### ref?

*   Type:
    
    `LegacyRef<HTMLDivElement>`
    
*   Description:
    
    Allows getting a ref to the component instance. Once the component unmounts, React will set `ref.current` to `null` (or call the ref with `null` if you passed a callback ref). [React Docs](https://react.dev/learn/referencing-values-with-refs#refs-and-the-dom)
    

### Alltid dark eller alltid light-mode

I noen tilfeller kan det være nyttig å alltid sette ett element til den ene modusen. Siden theming er basert på CSS-cascade, løser du dette slikt

TSX

Deaktiver linjeskiftKopier

    <Theme theme="light">  ...  <Theme theme="dark">   ...  </Theme></Theme>

Dette kan være relevant for en mørk header eller footer, som ofte står i kontrast til resten av innholdet på siden.

Dynamisk theming
----------------

Ved å bruke html data-attributt `data-color` kan du endre farge brukt på komponenter. Vi tilbyr alle fargene våre gjennom dette API-et.

Implementasjonen er hierarkisk, slik at du kan definere fargene brukt slik:

TSX

Deaktiver linjeskiftKopier

    <div data-color-role="neutral">  <!-- Innhold får neutral-tint --></div>
    <div data-color-role="accent">  <!-- Innhold får accent-tint --></div>

### Bruk med Aksel-komponenter

Dette kan være nyttig for mange komponenter, men i noen tilfeller ønsker vi å begrense muligheten (f.eks i Alert). Vi deler komponenter inn i 3 ulike grupper for hvor bra de støtter dynamisk theming.

#### Static

Elementer med statusfarger som Alert og ErrorSummary eller error-states vil støtte et begrenset antall farger og ofte ikke kunne endres på dynamiskt.

#### Neutral

Komponenter som Modal og Tooltip vil alltid være nøytrale, og vil ikke påvirkes av `data-color`.

#### Cascade

De fleste resterende komponenter vil arve `data-color` og da endre farge basert på dette.

TSX

Deaktiver linjeskiftKopier

    <div data-color-role="neutral">  <Button>    Neutral-button  </Button></div>
    <Button data-color-role="danger">   Danger button</Button>

### Autocomplete

For å få riktige typer når du bruker `data-color`, kan du løse dette i tsconfig.

TSX

Deaktiver linjeskiftKopier

    {  "compilerOptions": {    "types": ["@navikt/ds-react/types/theme"]  }}

Egne farger
-----------

Noen subdomener i Nav har til dels egen branding, noe som er støttet gjennom themingsystemet vårt. Ta kontakt med team Aksel for hjelp med å sette dette opp både i Figma og Kode.

© 2025 Nav

Arbeids- og velferdsetaten
