Sette opp prosjekt med Darkside - Aksel.nav.no

Grunnleggende

Sette opp prosjekt med Darkside
===============================

**Nytt prosjekt**
-----------------

For nye prosjekter er oppsettet like enkelt som før, men krever nå en `Theme`\-komponent som wrappes rundt appen din. Komponenten fungerer som en lokal feature-flag for den nye implementeringen, med den ekstra fordelen at den kan bytte mellom lys og mørk modus for deg.

### **Steg:**

1.  Importer ny CSS `@navikt/ds-css/darkside`
    
2.  Importer `Theme`\-komponent fra `@navikt/ds-react/Theme`
    
3.  Wrap appen din inn i `Theme`\-komponenten.
    

TSX

Deaktiver linjeskiftKopier

    import "@navikt/ds-css/darkside";import { Theme } from "@navikt/ds-react/Theme";
    export const App = () => (  <Theme>    <YourApp />  </Theme>);

### **Kun Tokens/CSS**

Hvis du ikke bruker noen av våre React-komponenter, kan du fortsatt bytte mellom temaer ved å sette `class="light"` eller `class="dark"` på root-elementet ditt.

### **Migrere tokens**

Vi tilbyr automatisk migrering av alle tokens med vår codemod. Etter du har satt opp ny CSS, kan du kjøre denne for å raskt komme i gang med nye farger or tokens.

BASH

Deaktiver linjeskiftKopier

    npx @navikt/aksel darkside

**Theme-bytte**
---------------

`Theme`\-komponenten har en `theme`\-prop som kan settes til enten `light` eller `dark`. Dette setter bare en klasse på elementet av `light` eller `dark` (i tillegg til en `aksel-theme` klasse), og resten håndteres av CSSen. Du trenger ikke bruke denne prop-en, da andre løsninger som f.eks `next-themes` med `attribute="class"`\-prop løser det for deg.

Du har muligheten til å bruke `hasBackground` (standard til `true`) for å få `Theme` til å inkludere en innebygd standardbakgrunn.

Siden theme-bytte ofte er rammeverkspesifikt, har vi ikke inkludert en tema-bryter komponent eller avansert logikk for cookies/localstorage. Du må implementere dette selv ved å bruke en tilpasset oppsett, eller bruke et bibliotek som [next-themes](https://github.com/pacocoursey/next-themes).

Vi vil fortsette å jobbe med hele `Theme`\-økosystemet, og kan inkludere flere funksjoner i fremtiden for å håndtere dette innebygd.

### **Theme-bytte komponent**

Dette er kontekstbasert for hva som passer din applikasjon, men det er noen generelle mønstre du kan følge.

*   **Light- eller darkmode:** Her kan du bruke en enkel Switch-komponent, eller en Tertiary-knapp for å bytte mellom dem.
    
*   **Light-, dark- eller systemmodus:** Her kan du bruke en ToggleGroup eller Select-komponent.
    

TSX

Deaktiver linjeskiftKopier

    isLightMode ? (  <Button    variant="tertiary-neutral"    icon={<SunIcon title="Switch to dark theme" />}  />) : (  <Button    variant="tertiary-neutral"    icon={<MoonIcon title="Switch to light theme" />}  />);

Merk at løsningen over vil kunne gi hydreringsfeil hvis man bruker SSR da man vil få ulike dom-noder på server og client. Bruker heller CSS for å vise/skjule elementet basert på theme da.

**Jeg vil bare teste de nye tokens**
------------------------------------

Siden du kan bruke den nye token-pakken sammen med de gamle, kan du starte med å importere nye tokens som du ville gjort med det gamle systemet.

CSS

Deaktiver linjeskiftKopier

    @import "@navikt/ds-tokens/darkside-css";

For SCSS, Less og JS er de også tilgjengelige under stiene.

Informasjon

For å støtte tematisering, er scss, less og js tokens nå basert på `css-variables`. Dette betyr at du må importere css-versjonen fra `darkside-css` sammen med dem for at alt skal fungere.

**Jeg vil teste de nye React-endringene**
-----------------------------------------

For at det nye systemet skal fungere med våre komponenter, må du bruke den nye `Theme`\-komponenten, og importere den nye CSS-en fra `@navikt/ds-css/darkside`.

TSX

Deaktiver linjeskiftKopier

    import "@navikt/ds-css/darkside";import { Theme } from "@navikt/ds-react/Theme";
    export const App = () => (  <Theme theme="light">    <YourApp />  </Theme>);

Du må sjekke alle dine tilpassede overstyringer når du gjør denne overgangen.

### **Delvis oppdatering**

Du kan migrere deler av applikasjonen din til å bruke de nye CSS-klassene uten å måtte migrere alt på en gang.

TSX

Deaktiver linjeskiftKopier

    // Old setupimport "@navikt/ds-css/darkside";// New setupimport "@navikt/ds-css/darkside";import { Theme } from "@navikt/ds-react/Theme";
    export const App = () => (  <div>    <StillOnOldCSSComponent>    /* Only this part of your app now uses new styling */    <Theme>      <YourApp />    </Theme>  </div>);

Du må sjekke alle dine tilpassede overstyringer når du gjør denne overgangen.

**Jeg må gjøre noen tilpassede endringer for mørkt modus**
----------------------------------------------------------

Siden vår implementering er basert på CSS, kan du enkelt gjøre tilpassede justeringer der det er nødvendig.

CSS

Deaktiver linjeskiftKopier

    .my-component {  background-color: var(--ax-bg-raised);  color: var(--ax-text-neutral);  border: 1px solid var(--ax-border-neutral-subtleA);}
    // Makes hover-state more visible only for darkmode.dark .my-component {  &:hover {    border-color: var(--ax-border-accent);  }}

Tailwind CSS
------------

Merk at du ikke kan bruke ny og gammel tailwind-config samtidig! Hvis du fortsatt ønsker å bruke gamle tokens, må du manuelt kopiere dem fra den gamle tailwind-configen vår og extende din egen. Du finner den gamle [her på yarnpkg.com](https://yarnpkg.com/package?q=%40navikt%2Fds-ta&name=%40navikt%2Fds-tailwind&file=%2Ftailwind.config.js).

TSX

Deaktiver linjeskiftKopier

    // Tailwind v3module.exports = {  presets: [require("@navikt/ds-tailwind/darkside-tw3")],}

© 2025 Nav

Arbeids- og velferdsetaten
