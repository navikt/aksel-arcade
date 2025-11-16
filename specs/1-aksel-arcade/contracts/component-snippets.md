# Component Snippets Contract

**Feature**: 1-aksel-arcade  
**Date**: 2025-11-06  
**Version**: 1.0.0

## Overview

This contract defines the registry of Aksel component snippets used in the "Add component" palette. Each snippet includes the component name, category, searchable keywords, JSX template with placeholders, and import statement.

---

## Component Snippet Registry

### Snippet Format

```typescript
interface ComponentSnippet {
  id: string;              // Unique identifier (kebab-case)
  name: string;            // Display name for palette
  category: 'layout' | 'component';  // Toggle panel category
  keywords: string[];      // Lowercase search terms
  template: string;        // JSX template with ${N:placeholder} markers
  description: string;     // Short description (shown in palette)
  import: string;          // ES6 import statement
  docs?: string;           // Optional URL to Aksel docs
}
```

### Placeholder Syntax

Templates use TextMate snippet placeholder syntax:
- `${1:placeholder}` - First tab stop with default text
- `${2:placeholder}` - Second tab stop
- `\n` - Newline character
- `\t` - Tab character (2 spaces in editor)

---

## Core Snippets (Initial Release)

### Layout Components

#### 1. Box

```json
{
  "id": "box",
  "name": "Box",
  "category": "layout",
  "keywords": ["box", "container", "layout", "padding", "wrapper"],
  "template": "<Box padding=\"4\">\n  ${1:Content}\n</Box>",
  "description": "Layout container with spacing control",
  "import": "import { Box } from '@navikt/ds-react';",
  "docs": "https://aksel.nav.no/komponenter/core/box"
}
```

**Usage**: General-purpose container with padding/margin props. Default padding="4" (16px per Aksel spacing scale).

---

#### 2. Stack

```json
{
  "id": "stack",
  "name": "Stack",
  "category": "layout",
  "keywords": ["stack", "vertical", "column", "layout", "gap", "spacing"],
  "template": "<Stack gap=\"4\">\n  ${1:First item}\n  ${2:Second item}\n</Stack>",
  "description": "Vertical layout stack with gap spacing",
  "import": "import { Stack } from '@navikt/ds-react';",
  "docs": "https://aksel.nav.no/komponenter/core/stack"
}
```

**Usage**: Vertical flexbox layout with gap between children. Default gap="4" (16px).

---

#### 3. Grid

```json
{
  "id": "grid",
  "name": "Grid",
  "category": "layout",
  "keywords": ["grid", "layout", "columns", "responsive"],
  "template": "<Grid columns={{ xs: 1, sm: 2, md: 3 }} gap=\"4\">\n  ${1:Grid item 1}\n  ${2:Grid item 2}\n  ${3:Grid item 3}\n</Grid>",
  "description": "Responsive grid layout",
  "import": "import { Grid } from '@navikt/ds-react';",
  "docs": "https://aksel.nav.no/komponenter/core/grid"
}
```

**Usage**: CSS Grid wrapper with responsive column definitions. Default shows 1 column on XS, 2 on SM, 3 on MD+.

---

### Form Components

#### 4. Button

```json
{
  "id": "button",
  "name": "Button",
  "category": "component",
  "keywords": ["button", "click", "action", "submit", "primary", "cta"],
  "template": "<Button variant=\"primary\" size=\"medium\">${1:Button text}</Button>",
  "description": "Action button with variants",
  "import": "import { Button } from '@navikt/ds-react';",
  "docs": "https://aksel.nav.no/komponenter/core/button"
}
```

**Usage**: Primary action button. Variants: `primary`, `secondary`, `tertiary`, `danger`. Sizes: `small`, `medium`, `large`.

---

#### 5. TextField

```json
{
  "id": "textfield",
  "name": "TextField",
  "category": "component",
  "keywords": ["input", "text", "form", "field", "textbox"],
  "template": "<TextField label=\"${1:Label}\" placeholder=\"${2:Placeholder}\" />",
  "description": "Text input field with label",
  "import": "import { TextField } from '@navikt/ds-react';",
  "docs": "https://aksel.nav.no/komponenter/core/textfield"
}
```

**Usage**: Single-line text input with label, placeholder, error support.

---

#### 6. Select

```json
{
  "id": "select",
  "name": "Select",
  "category": "component",
  "keywords": ["select", "dropdown", "options", "form", "menu"],
  "template": "<Select label=\"${1:Label}\">\n  <option value=\"\">${2:Option 1}</option>\n  <option value=\"\">${3:Option 2}</option>\n</Select>",
  "description": "Dropdown select menu",
  "import": "import { Select } from '@navikt/ds-react';",
  "docs": "https://aksel.nav.no/komponenter/core/select"
}
```

**Usage**: Dropdown selection with label. Pre-populated with 2 option placeholders.

---

#### 7. Checkbox

```json
{
  "id": "checkbox",
  "name": "Checkbox",
  "category": "component",
  "keywords": ["checkbox", "check", "toggle", "form", "boolean"],
  "template": "<Checkbox>${1:Label}</Checkbox>",
  "description": "Checkbox input with label",
  "import": "import { Checkbox } from '@navikt/ds-react';",
  "docs": "https://aksel.nav.no/komponenter/core/checkbox"
}
```

**Usage**: Boolean checkbox with inline label.

---

#### 8. Radio

```json
{
  "id": "radio",
  "name": "Radio",
  "category": "component",
  "keywords": ["radio", "option", "choice", "form", "group"],
  "template": "<Radio name=\"${1:group}\">${2:Label}</Radio>",
  "description": "Radio button input",
  "import": "import { Radio } from '@navikt/ds-react';",
  "docs": "https://aksel.nav.no/komponenter/core/radio"
}
```

**Usage**: Radio button with group name. Multiple radios with same `name` create a radio group.

---

## Search Algorithm

### Fuzzy Search Implementation

```typescript
interface SearchOptions {
  category?: 'layout' | 'component'; // Filter by category
  limit?: number;                    // Max results (default: no limit)
}

const searchSnippets = (
  query: string,
  snippets: ComponentSnippet[],
  options: SearchOptions = {}
): ComponentSnippet[] => {
  const lowerQuery = query.toLowerCase().trim();
  
  // Empty query returns all snippets (optionally filtered by category)
  if (!lowerQuery) {
    let results = snippets;
    if (options.category) {
      results = results.filter(s => s.category === options.category);
    }
    return results;
  }
  
  // Filter by category first
  let filtered = snippets;
  if (options.category) {
    filtered = filtered.filter(s => s.category === options.category);
  }
  
  // Score each snippet
  const scored = filtered.map(snippet => {
    let score = 0;
    
    // Exact name match (highest priority)
    if (snippet.name.toLowerCase() === lowerQuery) {
      score += 100;
    }
    // Name starts with query
    else if (snippet.name.toLowerCase().startsWith(lowerQuery)) {
      score += 50;
    }
    // Name contains query
    else if (snippet.name.toLowerCase().includes(lowerQuery)) {
      score += 25;
    }
    
    // Keyword exact match
    if (snippet.keywords.includes(lowerQuery)) {
      score += 40;
    }
    // Keyword starts with query
    else if (snippet.keywords.some(kw => kw.startsWith(lowerQuery))) {
      score += 20;
    }
    // Keyword contains query
    else if (snippet.keywords.some(kw => kw.includes(lowerQuery))) {
      score += 10;
    }
    
    return { snippet, score };
  });
  
  // Filter out zero-score results
  const matches = scored.filter(s => s.score > 0);
  
  // Sort by score (descending), then alphabetically
  matches.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.snippet.name.localeCompare(b.snippet.name);
  });
  
  // Apply limit
  let results = matches.map(m => m.snippet);
  if (options.limit) {
    results = results.slice(0, options.limit);
  }
  
  return results;
};
```

**Example Searches**:
```typescript
// Search for "button"
searchSnippets('button', AKSEL_SNIPPETS);
// Returns: [Button]

// Search for "box"
searchSnippets('box', AKSEL_SNIPPETS);
// Returns: [Box, TextField, Checkbox] (because "box" matches keywords)

// Search "layout"
searchSnippets('layout', AKSEL_SNIPPETS);
// Returns: [Box, Stack, Grid]

// Filter by category
searchSnippets('', AKSEL_SNIPPETS, { category: 'layout' });
// Returns: [Box, Stack, Grid]
```

---

## Snippet Insertion Logic

### insertSnippet(snippet: ComponentSnippet, editor: CodeMirrorEditor): void

Inserts a snippet at the current cursor position with placeholder tab stops.

**Behavior**:
1. Get current cursor position
2. Check if import statement already exists at top of file
3. If not, add import statement on line 1 (or after existing imports)
4. Insert snippet template at cursor
5. Parse placeholders and set initial cursor to first `${1:...}`
6. Optionally highlight placeholder text for easy replacement

**Implementation**:
```typescript
const insertSnippet = (snippet: ComponentSnippet, editor: CodeMirrorEditor): void => {
  const doc = editor.state.doc;
  const cursor = editor.state.selection.main.head;
  
  // Check if import exists
  const hasImport = doc.toString().includes(snippet.import);
  
  let changes = [];
  
  // Add import if missing
  if (!hasImport) {
    // Find insertion point (after other imports or at start)
    const importInsertPos = findImportInsertPosition(doc);
    changes.push({
      from: importInsertPos,
      to: importInsertPos,
      insert: snippet.import + '\n',
    });
  }
  
  // Insert template at cursor
  const template = parseTemplate(snippet.template);
  changes.push({
    from: cursor,
    to: cursor,
    insert: template.text,
  });
  
  // Apply changes
  editor.dispatch({ changes });
  
  // Move cursor to first placeholder
  if (template.firstPlaceholder) {
    const newCursor = cursor + template.firstPlaceholder.offset;
    editor.dispatch({
      selection: {
        anchor: newCursor,
        head: newCursor + template.firstPlaceholder.length,
      },
    });
  }
};

interface ParsedTemplate {
  text: string;                // Template with placeholders removed
  firstPlaceholder?: {
    offset: number;            // Character offset from insertion point
    length: number;            // Length of placeholder text
    text: string;              // Default placeholder text
  };
}

const parseTemplate = (template: string): ParsedTemplate => {
  // Replace ${N:placeholder} with just placeholder text
  // Track first placeholder position
  let offset = 0;
  let firstPlaceholder: ParsedTemplate['firstPlaceholder'] = undefined;
  
  const text = template.replace(/\$\{(\d+):([^}]+)\}/g, (match, num, placeholder, index) => {
    if (!firstPlaceholder && num === '1') {
      firstPlaceholder = {
        offset: index,
        length: placeholder.length,
        text: placeholder,
      };
    }
    return placeholder;
  });
  
  return { text, firstPlaceholder };
};

const findImportInsertPosition = (doc: Text): number => {
  // Find last import statement or start of file
  const lines = doc.toString().split('\n');
  let lastImportLine = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ')) {
      lastImportLine = i;
    } else if (lines[i].trim() && !lines[i].trim().startsWith('//')) {
      // Stop at first non-import, non-comment line
      break;
    }
  }
  
  if (lastImportLine >= 0) {
    // Insert after last import
    return doc.line(lastImportLine + 1).to + 1;
  }
  
  // Insert at start
  return 0;
};
```

---

## Component Palette UI

### Layout Structure

```
┌─────────────────────────────────────┐
│ Add Component                    [X]│
├─────────────────────────────────────┤
│ Search: [input field          ]     │
├─────────────────────────────────────┤
│ [Layout] [Components]               │  <- Toggle buttons
├─────────────────────────────────────┤
│ ┌─ Box                             │
│ │  Layout container with spacing   │
│ ├─ Stack                           │
│ │  Vertical layout stack with gap  │
│ └─ Grid                            │
│    Responsive grid layout          │
└─────────────────────────────────────┘
```

### Keyboard Navigation

- **Arrow Up/Down**: Navigate through results
- **Enter**: Insert selected snippet
- **Escape**: Close palette
- **Tab**: Switch between Layout/Components toggles
- **Type to search**: Focus automatically on search input

---

## Testing Strategy

### Unit Tests

```typescript
describe('Component Snippets', () => {
  describe('searchSnippets', () => {
    it('should return all snippets for empty query', () => {
      const results = searchSnippets('', AKSEL_SNIPPETS);
      expect(results.length).toBe(8);
    });
    
    it('should filter by category', () => {
      const results = searchSnippets('', AKSEL_SNIPPETS, { category: 'layout' });
      expect(results.length).toBe(3);
      expect(results.every(r => r.category === 'layout')).toBe(true);
    });
    
    it('should prioritize exact name match', () => {
      const results = searchSnippets('button', AKSEL_SNIPPETS);
      expect(results[0].id).toBe('button');
    });
    
    it('should match on keywords', () => {
      const results = searchSnippets('input', AKSEL_SNIPPETS);
      const ids = results.map(r => r.id);
      expect(ids).toContain('textfield');
      expect(ids).toContain('checkbox');
    });
  });
  
  describe('insertSnippet', () => {
    it('should add import statement if missing', () => {
      const editor = createMockEditor('// Empty file');
      insertSnippet(AKSEL_SNIPPETS[0], editor); // Box
      
      const text = editor.state.doc.toString();
      expect(text).toContain("import { Box } from '@navikt/ds-react';");
    });
    
    it('should not duplicate import if already exists', () => {
      const editor = createMockEditor("import { Box } from '@navikt/ds-react';\n");
      insertSnippet(AKSEL_SNIPPETS[0], editor);
      
      const text = editor.state.doc.toString();
      const matches = text.match(/import.*Box/g);
      expect(matches?.length).toBe(1);
    });
    
    it('should insert template at cursor', () => {
      const editor = createMockEditor('function App() {\n  return |\n}');
      insertSnippet(AKSEL_SNIPPETS[0], editor);
      
      const text = editor.state.doc.toString();
      expect(text).toContain('<Box padding="4">');
    });
  });
});
```

---

## Future Extensions

### Additional Snippets (Future Releases)

Potential additions based on Aksel Darkside library:
- **Typography**: `Heading`, `BodyLong`, `BodyShort`, `Label`
- **Navigation**: `Tabs`, `Link`, `Breadcrumbs`
- **Feedback**: `Alert`, `Modal`, `Loader`
- **Data Display**: `Table`, `Tag`, `Chip`

### Snippet Customization

Allow users to define custom snippets:
```typescript
interface UserSnippet extends ComponentSnippet {
  custom: true;
  createdAt: string;
}

// Store in LocalStorage: aksel-arcade:custom-snippets
```

### Snippet Analytics (Optional)

Track most-used snippets for better defaults:
```typescript
interface SnippetUsage {
  snippetId: string;
  count: number;
}

// Store in LocalStorage: aksel-arcade:snippet-usage
```

---

**Contract Status**: ✅ Complete - All 8 core snippets defined with search and insertion logic
