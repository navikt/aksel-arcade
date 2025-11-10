Typography - Aksel.nav.no

Typography
==========

Et sett med komponenter for typografi-stilene våre:

*   Heading
    
*   BodyLong
    
*   BodyShort
    
*   Label
    
*   Detail
    
*   ErrorMessage
    

Egnet til:
----------

*   Overskrifter
    
*   Avsnitt
    
*   Komponent-tekst
    

Tilgjengelighet
---------------

På WCAG-nivå A og AA, dvs. de nivåene vi er pålagt til å oppfylle, er det ikke noe krav om minimum tekststørrelse eller linjehøyde. Det reglene krever er at brukeren kan _justere_ tekststørrelse og linjehøyde. Dersom du bruker typografikomponentene, sikrer du at fontene dine er kodet på en måte som lar brukeren justere disse.

WCAG krever også god fargekontrast. Typografikomponentene alene kan ikke stå for god kontrast, siden det er du som designer eller utvikler som styrer fargevalgene. Sjekk kontrastene i løsningen din opp mot [kontrastkravene](/god-praksis/artikler/143-kontrast) med Colour Contrast Analyser, Stark i Figma eller med nettleserens DevTools.

Heading
-------

### Mobilskalering

Ved brekkpunkt 480px vil Heading size `xlarge` og `large` skaleres ned et hakk. `xlarge` går fra 40px til 32px, mens `large` går fra 32px til 28px.

### Hierarki

Komponenten tilbyr en propen `level` som brukes for å sikre riktig heading-heirarki på siden. Bruk da level 1-6 for å velge om heading skal være h1-h6.

### Spacing

Propen `spacing` legger på margin-bottom for øke avstanden til neste element. Avstanden varierer avhengig av `size`.

### HeadingProps

#### level?

*   Type:
    
    `"1" | "2" | "3" | "4" | "5" | "6"`
    
*   Default:
    
    `"1"`
    
*   Description:
    
    Heading level.
    

#### size

*   Type:
    
    `"xlarge" | "large" | "medium" | "small" | "xsmall"`
    
*   Default:
    
    `"null"`
    
*   Description:
    
    xlarge: 40px, large: 32px, medium: 24px, small: 20px, xsmall: 18px.
    

#### children

*   Type:
    
    `ReactNode`
    
*   Description:
    
    Heading text.
    

#### spacing?

*   Type:
    
    `boolean`
    
*   Description:
    
    Adds spacing below text.
    

#### visuallyHidden?

*   Type:
    
    `boolean`
    
*   Description:
    
    Visually hide text. Text will still be accessible for screenreaders.
    

#### align?

*   Type:
    
    `"start" | "center" | "end"`
    
*   Default:
    
    `"null"`
    
*   Description:
    
    Adjust text-align.
    

#### textColor?

*   Type:
    
    `"default" | "subtle"`
    
*   Default:
    
    `"null"`
    
*   Description:
    
    Adjusts color.
    

#### className?

*   Type:
    
    `string`
    

#### data-color?

*   Type:
    
    `(string & {}) | AkselColor`
    

#### ref?

*   Type:
    
    `LegacyRef<HTMLHeadingElement>`
    
*   Description:
    
    Allows getting a ref to the component instance. Once the component unmounts, React will set `ref.current` to `null` (or call the ref with `null` if you passed a callback ref). [React Docs](https://react.dev/learn/referencing-values-with-refs#refs-and-the-dom)
    

#### as?

*   Type:
    
    `React.ElementType`
    
*   Description:
    
    OverridableComponent-api
    

BodyLong
--------

### Spacing

Propen `spacing` legger på margin-bottom for å gi mer avstand til neste element. Avstanden varierer avhengig av `size`.

### Bruk

BodyLong brukes til all løpende tekst, for eksempel brødtekst.

### BodyLongProps

#### size?

*   Type:
    
    `"large" | "medium" | "small"`
    
*   Default:
    
    `"medium"`
    
*   Description:
    
    large: 20px, medium: 18px, small: 16px.
    

#### children

*   Type:
    
    `ReactNode`
    
*   Description:
    
    Text.
    

#### truncate?

*   Type:
    
    `boolean`
    
*   Description:
    
    Truncate text overflow with ellipsis.
    

#### weight?

*   Type:
    
    `"regular" | "semibold"`
    
*   Default:
    
    `"regular"`
    
*   Description:
    
    Adjusts font-weight.
    

#### align?

*   Type:
    
    `"start" | "center" | "end"`
    
*   Default:
    
    `"null"`
    
*   Description:
    
    Adjust text-align.
    

#### visuallyHidden?

*   Type:
    
    `boolean`
    
*   Description:
    
    Visually hide text. Text will still be accessible for screenreaders.
    

#### spacing?

*   Type:
    
    `boolean`
    
*   Description:
    
    Adds spacing below text.
    

#### textColor?

*   Type:
    
    `"default" | "subtle"`
    
*   Default:
    
    `"null"`
    
*   Description:
    
    Adjusts color.
    

#### className?

*   Type:
    
    `string`
    

#### data-color?

*   Type:
    
    `(string & {}) | AkselColor`
    

#### ref?

*   Type:
    
    `LegacyRef<HTMLParagraphElement>`
    
*   Description:
    
    Allows getting a ref to the component instance. Once the component unmounts, React will set `ref.current` to `null` (or call the ref with `null` if you passed a callback ref). [React Docs](https://react.dev/learn/referencing-values-with-refs#refs-and-the-dom)
    

#### as?

*   Type:
    
    `React.ElementType`
    
*   Description:
    
    OverridableComponent-api
    

BodyShort
---------

### Spacing

Propen `spacing` legger på margin-bottom for å gi mer avstand til neste element. Avstanden varierer avhengig av `size`.

### Bruk

BodyShort brukes til tekster som ikke er brødtekst. Ofte brukt i komponenter, for eksempel beskrivelse i skjemafelt.

### BodyShortProps

#### size?

*   Type:
    
    `"large" | "medium" | "small"`
    
*   Default:
    
    `"medium"`
    
*   Description:
    
    large: 20px, medium: 18px, small: 16px.
    

#### children

*   Type:
    
    `ReactNode`
    
*   Description:
    
    Paragraph text.
    

#### truncate?

*   Type:
    
    `boolean`
    
*   Description:
    
    Truncate text overflow with ellipsis.
    

#### weight?

*   Type:
    
    `"regular" | "semibold"`
    
*   Default:
    
    `"regular"`
    
*   Description:
    
    Adjusts font-weight.
    

#### align?

*   Type:
    
    `"start" | "center" | "end"`
    
*   Default:
    
    `"null"`
    
*   Description:
    
    Adjust text-align.
    

#### visuallyHidden?

*   Type:
    
    `boolean`
    
*   Description:
    
    Visually hide text. Text will still be accessible for screenreaders.
    

#### spacing?

*   Type:
    
    `boolean`
    
*   Description:
    
    Adds spacing below text.
    

#### textColor?

*   Type:
    
    `"default" | "subtle"`
    
*   Default:
    
    `"null"`
    
*   Description:
    
    Adjusts color.
    

#### className?

*   Type:
    
    `string`
    

#### data-color?

*   Type:
    
    `(string & {}) | AkselColor`
    

#### ref?

*   Type:
    
    `LegacyRef<HTMLParagraphElement>`
    
*   Description:
    
    Allows getting a ref to the component instance. Once the component unmounts, React will set `ref.current` to `null` (or call the ref with `null` if you passed a callback ref). [React Docs](https://react.dev/learn/referencing-values-with-refs#refs-and-the-dom)
    

#### as?

*   Type:
    
    `React.ElementType`
    
*   Description:
    
    OverridableComponent-api
    

Label
-----

### Spacing

Propen `spacing` legger på margin-bottom for å gi mer avstand til neste element. Avstanden varierer avhengig av `size`. Obs: Siden komponenten rendres som en `<label>` ut av boksen, må du gjøre den om til et blokk-element for at `spacing` skal virke. Det gjøres ved hjelp av `as`, for eksempel `as="p"`.

### LabelProps

#### size?

*   Type:
    
    `"medium" | "small"`
    
*   Default:
    
    `"medium"`
    
*   Description:
    
    medium: 18px, small: 16px.
    

#### children

*   Type:
    
    `ReactNode`
    
*   Description:
    
    Label text.
    

#### visuallyHidden?

*   Type:
    
    `boolean`
    
*   Description:
    
    Visually hide text. Text will still be accessible for screenreaders.
    

#### spacing?

*   Type:
    
    `boolean`
    
*   Description:
    
    Adds spacing below text.
    

#### textColor?

*   Type:
    
    `"default" | "subtle"`
    
*   Default:
    
    `"null"`
    
*   Description:
    
    Adjusts color.
    

#### className?

*   Type:
    
    `string`
    

#### data-color?

*   Type:
    
    `(string & {}) | AkselColor`
    

#### ref?

*   Type:
    
    `LegacyRef<HTMLLabelElement>`
    
*   Description:
    
    Allows getting a ref to the component instance. Once the component unmounts, React will set `ref.current` to `null` (or call the ref with `null` if you passed a callback ref). [React Docs](https://react.dev/learn/referencing-values-with-refs#refs-and-the-dom)
    

#### as?

*   Type:
    
    `React.ElementType`
    
*   Description:
    
    OverridableComponent-api
    

Detail
------

### Spacing

Propen `spacing` legger på margin-bottom for øke avstanden til neste element.

### Bruk

Detail er for veldig korte tekster eller enkeltord som merkelapper og nøkkelord, men på grunn av størrelsen anbefaler vi i de fleste tilfeller å bruke BodyShort.

### DetailProps

#### children

*   Type:
    
    `ReactNode`
    
*   Description:
    
    Text.
    

#### uppercase?

*   Type:
    
    `boolean`
    
*   Description:
    
    ALL CAPS.
    

#### truncate?

*   Type:
    
    `boolean`
    
*   Description:
    
    Truncate text overflow with ellipsis.
    

#### weight?

*   Type:
    
    `"regular" | "semibold"`
    
*   Default:
    
    `"regular"`
    
*   Description:
    
    Adjusts font-weight.
    

#### align?

*   Type:
    
    `"start" | "center" | "end"`
    
*   Default:
    
    `"null"`
    
*   Description:
    
    Adjust text-align.
    

#### visuallyHidden?

*   Type:
    
    `boolean`
    
*   Description:
    
    Visually hide text. Text will still be accessible for screenreaders.
    

#### spacing?

*   Type:
    
    `boolean`
    
*   Description:
    
    Adds spacing below text.
    

#### textColor?

*   Type:
    
    `"default" | "subtle"`
    
*   Default:
    
    `"null"`
    
*   Description:
    
    Adjusts color.
    

#### className?

*   Type:
    
    `string`
    

#### data-color?

*   Type:
    
    `(string & {}) | AkselColor`
    

#### ref?

*   Type:
    
    `LegacyRef<HTMLParagraphElement>`
    
*   Description:
    
    Allows getting a ref to the component instance. Once the component unmounts, React will set `ref.current` to `null` (or call the ref with `null` if you passed a callback ref). [React Docs](https://react.dev/learn/referencing-values-with-refs#refs-and-the-dom)
    

#### size?

*   Deprecated:
    
    Medium is now the same as small.
    
*   Type:
    
    `"medium" | "small"`
    
*   Default:
    
    `"medium"`
    

#### as?

*   Type:
    
    `React.ElementType`
    
*   Description:
    
    OverridableComponent-api
    

ErrorMessage
------------

### Spacing

Propen `spacing` legger på margin-bottom for å gi mer avstand til neste element. Avstanden varierer avhengig av `size`.

### Markering

Husk at rød tekst alene ikke er tilstrekkelig for å vise at det er en feilmelding. Det må også være en visuell markør som ikke avhenger av farger, for eksempel et varselikon. Dette kan du få med propen `showIcon`.

### ErrorMessageProps

#### size?

*   Type:
    
    `"medium" | "small"`
    
*   Default:
    
    `""medium""`
    
*   Description:
    
    medium: 18px, small: 16px.
    

#### children

*   Type:
    
    `ReactNode`
    
*   Description:
    
    Error text.
    

#### showIcon?

*   Type:
    
    `boolean`
    
*   Default:
    
    `false`
    
*   Description:
    
    Render a triangular warning icon.
    

#### spacing?

*   Type:
    
    `boolean`
    
*   Description:
    
    Adds spacing below text.
    

#### className?

*   Type:
    
    `string`
    

#### data-color?

*   Type:
    
    `(string & {}) | AkselColor`
    

#### ref?

*   Type:
    
    `LegacyRef<HTMLParagraphElement>`
    
*   Description:
    
    Allows getting a ref to the component instance. Once the component unmounts, React will set `ref.current` to `null` (or call the ref with `null` if you passed a callback ref). [React Docs](https://react.dev/learn/referencing-values-with-refs#refs-and-the-dom)
    

#### as?

*   Type:
    
    `React.ElementType`
    
*   Description:
    
    OverridableComponent-api
    

Ingress
-------

Denne er nå markert som deprecated. Bruk i stedet BodyLong med size=large.

JSX

Deaktiver linjeskiftKopier

    <BodyLong size="large">  Ingresstekst</BodyLong>

### Tokens

**Deprecation warning:** I det nye systemet for theming og darkmode, er komponent-tokens fjernet. [Les mer om det nye themingsystemet.](/Users/Sjur.Gronningseter/dev/AkselArcade/specs/1-aksel-arcade/Aksel docs/Theming Darkside.md)

Token

Fallback

\--ac-typo-error-text

\--a-text-danger

© 2025 Nav

Arbeids- og velferdsetaten