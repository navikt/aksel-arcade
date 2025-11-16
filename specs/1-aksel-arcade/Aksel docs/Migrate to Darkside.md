Migrere til Darkside - Aksel.nav.no

Grunnleggende

Migrere til Darkside
====================

Tokens
------

[Se tokenoversikten her.](https://aksel.nav.no/grunnleggende/darkside/design-tokens)

**Codemod**
-----------

Vi tilbyr automatisk migrering av alle tokens med vår codemod. Etter du har satt opp ny CSS, kan du kjøre denne for å raskt komme i gang med nye farger or tokens.

BASH

Deaktiver linjeskiftKopier

    npx @navikt/aksel darkside

**CSS**
-------

Mesteparten av CSSen vår er omskrevet. Dette inkluderer å gi nytt navn til alle `.navds`\-classNames til `.aksel`. Dette vil påvirke de fleste tilpassede overstyringer som målretter `.navds`\-klasser.

Siden vi sterkt anbefaler å unngå tilpassede overstyringer der det er mulig, vil vi oppmuntre til å åpne en issue hvis du finner ut at du må overstyre vår CSS for å oppnå noe! Det er disse tilfellene vi vil vite om slik at vi kan fikse dem for alle.

### **Fjernede komponent-tokens**

Alle komponent-spesifikke tokens støttes ikke lenger. Det betyr at alle tokens som disse fra `Button` er fjernet:

CSS

Deaktiver linjeskiftKopier

    --ac-button-primary-bg--ac-button-primary-text--ac-button-primary-hover-bg--ac-button-primary-active-bg

Alle komponentbaserte tokens er prefikset med `--ac`, så et globalt søk i kodebasen din bør finne alle av dem.

**Tailwind CSS**
----------------

Siden vår Tailwind CSS-konfigurasjon er knyttet til våre tokens, vil de fleste endringer gjort på tokens påvirke Tailwind CSS-konfigurasjonen. Vi har bestemt oss for å prefikse alle våre klasser med `ax-` i den nye konfigurasjonen, så det bør være mulig å bruke begge pakkene samtidig. Vi vil utvikle verktøy for å forhåpentligvis gjøre migrasjonene enklere i fremtiden.

### **Fjernede klasser**

z-index, maxWidth og spacing-klasser er fjernet fra den nye konfigurasjonen.

**React**
---------

Vi har gjort noen oppdateringer til `@navikt/ds-react` som du bør være oppmerksom på før testing.

### **Accordion**

#### Props:

*   `variant` er avviklet og vil bli fjernet i fremtiden. Vi har ikke implementert det i det nye systemet.
    
*   `headingSize` er avviklet og vil bli fjernet i fremtiden. Accordion-størrelse medium tilsvarer nå liten heading, og størrelse `small` tilsvarer `xsmall` heading.
    

#### Strukturelle endringer:

`<Accordion.Content/>` har nå en ekstra nestet `div` for å tillate bedre animasjoner. Tilpasset CSS kan bryte.

### **Datepicker**

Weeknumber-button bruker vår egen button-komponent, og ikke lenger en tilpasset knapp.

### **GuidePanel**

Komponenten har fått en komplett overhaling. Tilpassede overstyringer kan bryte.

### **Popover, HelpText**

`arrow`\-prop er fjernet. Alle våre flytende dialogelementer bortsett fra `Tooltip` kommer nå uten pil. Hvis du har tilpassede `offset`\-verdier, må du kanskje oppdatere dem for å tilpasse dette.

### **Pagination**

Button bruker nå vår egen button-komponent og `variant="tertiary-neutral"`.

### **Primitives**

Gitt at disse er tett knyttet til våre tokens, vil du mest sannsynlig måtte oppdatere deler av dem for å teste det nye systemet.

Alle primitives som bruker våre nåværende `spacing`\-tokens har nå de nye `space`\-tokens. Du kan bruke de gamle tokens mens du tester, men den fullstendige utgivelsen vil fjerne dem fra prop-listen.

TSX

Deaktiver linjeskiftKopier

    - <HStack gap="4">+ <HStack gap="space-16">

#### **Page**

`background`\-prop er fjernet. Nå bruker bare `bg-default`\-token.

#### **Box**

Siden `<Box />`er direkte knyttet til våre tokens, tilbyr vi nå `<Box.New />` som et midlertidig alternativ. Denne komponenten er basert på våre nye tokens og kan bruke bakgrunner, borders, border-radius og skygger fra det nye systemet. Når den fullstendige utgivelsen kommer, vil vi oppdatere `<Box />` til å bruke det nye systemet, og tilby verktøy for å håndtere denne migrasjonen.

#### Alle forekomster av vil bryte når du bruker det nye systemet hvis:

*   `background`\-prop brukes
    
*   `shadow`\-prop brukes
    
*   `borderColor`\-prop brukes
    

© 2025 Nav

Arbeids- og velferdsetaten