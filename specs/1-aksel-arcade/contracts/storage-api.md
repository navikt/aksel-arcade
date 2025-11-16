# Storage API Contract

**Feature**: 1-aksel-arcade  
**Date**: 2025-11-06  
**Version**: 1.0.0

## Overview

This contract defines the LocalStorage schema and API for persisting Aksel Arcade projects. The storage layer enforces a 5MB size limit, provides auto-save with debouncing, and supports schema versioning for future migrations.

---

## Storage Keys

### Primary Key

**Key**: `aksel-arcade:project`  
**Value**: JSON-serialized `StoredProject` object  
**Max Size**: 5MB (5,242,880 bytes)

### Auxiliary Keys (Future Extensions)

**Key**: `aksel-arcade:settings`  
**Value**: JSON-serialized user preferences (theme, shortcuts, etc.)  
**Max Size**: 10KB

**Key**: `aksel-arcade:recent-projects`  
**Value**: JSON array of recent project metadata (name, lastModified)  
**Max Size**: 50KB

---

## Schema Definition

### StoredProject (v1.0.0)

```typescript
interface StoredProject {
  // Schema metadata
  version: string;           // Schema version (e.g., "1.0.0")
  
  // Project identity
  id: string;                // UUID v4
  name: string;              // User-editable project name
  
  // Code content
  jsxCode: string;           // JSX tab code
  hooksCode: string;         // Hooks tab code
  
  // UI state
  viewportSize: ViewportSize; // Selected viewport (XS/SM/MD/LG/XL/2XL)
  panelLayout: PanelLayout;   // Panel positions (editor-left/editor-right)
  
  // Timestamps
  createdAt: string;         // ISO 8601 timestamp
  lastModified: string;      // ISO 8601 timestamp
}

type ViewportSize = 'XS' | 'SM' | 'MD' | 'LG' | 'XL' | '2XL';
type PanelLayout = 'editor-left' | 'editor-right';
```

### Example JSON

```json
{
  "version": "1.0.0",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Aksel UI Prototype",
  "jsxCode": "import { Button } from '@navikt/ds-react';\n\nexport default function App() {\n  return <Button variant=\"primary\">Click me</Button>;\n}",
  "hooksCode": "import { useState } from 'react';\n\nexport const useCounter = () => {\n  const [count, setCount] = useState(0);\n  return { count, increment: () => setCount(c => c + 1) };\n};",
  "viewportSize": "LG",
  "panelLayout": "editor-left",
  "createdAt": "2025-11-06T10:00:00.000Z",
  "lastModified": "2025-11-06T10:30:00.000Z"
}
```

---

## API Specification

### saveProject(project: StoredProject): SaveResult

Saves the project to LocalStorage with size validation.

**Parameters**:
- `project`: StoredProject object to persist

**Returns**:
```typescript
interface SaveResult {
  success: boolean;
  sizeBytes: number;
  warning?: string;  // Present if size > 4MB
  error?: string;    // Present if validation fails
}
```

**Behavior**:
1. Validate project schema (required fields, types)
2. Update `lastModified` to current timestamp
3. Serialize to JSON
4. Calculate byte size (using `Blob` constructor)
5. Check size constraints:
   - If > 5MB: Return error, do not save
   - If > 4MB: Save but return warning
   - Otherwise: Save normally
6. Write to LocalStorage under key `aksel-arcade:project`
7. Return save result

**Errors**:
- `VALIDATION_ERROR`: Invalid project schema
- `SIZE_EXCEEDED`: Project exceeds 5MB limit
- `STORAGE_ERROR`: LocalStorage quota exceeded or disabled

**Example**:
```typescript
const result = saveProject(project);

if (!result.success) {
  console.error('Save failed:', result.error);
  showNotification({ type: 'error', message: result.error });
} else if (result.warning) {
  console.warn(result.warning);
  showNotification({ type: 'warning', message: result.warning });
} else {
  console.log('Project saved:', result.sizeBytes, 'bytes');
}
```

**Implementation**:
```typescript
const saveProject = (project: StoredProject): SaveResult => {
  // Update timestamp
  const projectToSave = {
    ...project,
    lastModified: new Date().toISOString(),
  };
  
  // Validate schema
  try {
    validateProjectSchema(projectToSave);
  } catch (error) {
    return {
      success: false,
      sizeBytes: 0,
      error: `Validation error: ${error.message}`,
    };
  }
  
  // Serialize and measure size
  const json = JSON.stringify(projectToSave);
  const sizeBytes = new Blob([json]).size;
  
  // Check size limits
  if (sizeBytes > MAX_PROJECT_SIZE_BYTES) {
    return {
      success: false,
      sizeBytes,
      error: `Project size (${formatBytes(sizeBytes)}) exceeds 5MB limit`,
    };
  }
  
  // Save to LocalStorage
  try {
    localStorage.setItem(STORAGE_KEY, json);
  } catch (error) {
    return {
      success: false,
      sizeBytes,
      error: `Storage error: ${error.message}`,
    };
  }
  
  // Success with optional warning
  const result: SaveResult = { success: true, sizeBytes };
  
  if (sizeBytes > WARN_PROJECT_SIZE_BYTES) {
    result.warning = `Project size (${formatBytes(sizeBytes)}) approaching 5MB limit`;
  }
  
  return result;
};

const MAX_PROJECT_SIZE_BYTES = 5 * 1024 * 1024;
const WARN_PROJECT_SIZE_BYTES = 4 * 1024 * 1024;
const STORAGE_KEY = 'aksel-arcade:project';
```

---

### loadProject(): LoadResult

Loads the project from LocalStorage with schema migration.

**Returns**:
```typescript
interface LoadResult {
  project: StoredProject | null;
  fromStorage: boolean;  // True if loaded from LocalStorage, false if default
  migrated: boolean;     // True if schema was migrated
  error?: string;        // Present if load failed
}
```

**Behavior**:
1. Attempt to read `aksel-arcade:project` from LocalStorage
2. If not found: Return default project
3. If found: Parse JSON
4. Check schema version
5. If version mismatch: Run migration
6. Validate migrated project
7. Return project

**Errors**:
- `PARSE_ERROR`: Invalid JSON in LocalStorage
- `MIGRATION_ERROR`: Schema migration failed
- `VALIDATION_ERROR`: Project failed validation after load/migration

**Example**:
```typescript
const result = loadProject();

if (result.error) {
  console.error('Load failed:', result.error);
  // Fall back to default project
  return createDefaultProject();
}

if (result.migrated) {
  console.log('Project migrated from', result.project.version);
  // Optionally notify user
}

return result.project;
```

**Implementation**:
```typescript
const loadProject = (): LoadResult => {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    
    // No saved project
    if (!json) {
      return {
        project: createDefaultProject(),
        fromStorage: false,
        migrated: false,
      };
    }
    
    // Parse JSON
    let stored: any;
    try {
      stored = JSON.parse(json);
    } catch (error) {
      return {
        project: null,
        fromStorage: true,
        migrated: false,
        error: 'Failed to parse stored project JSON',
      };
    }
    
    // Migrate if necessary
    let project: StoredProject;
    let migrated = false;
    
    if (stored.version !== CURRENT_VERSION) {
      try {
        project = migrateProject(stored);
        migrated = true;
      } catch (error) {
        return {
          project: null,
          fromStorage: true,
          migrated: false,
          error: `Migration failed: ${error.message}`,
        };
      }
    } else {
      project = stored as StoredProject;
    }
    
    // Validate
    try {
      validateProjectSchema(project);
    } catch (error) {
      return {
        project: null,
        fromStorage: true,
        migrated,
        error: `Validation failed: ${error.message}`,
      };
    }
    
    return {
      project,
      fromStorage: true,
      migrated,
    };
    
  } catch (error) {
    return {
      project: null,
      fromStorage: false,
      migrated: false,
      error: `Unexpected error: ${error.message}`,
    };
  }
};

const CURRENT_VERSION = '1.0.0';
```

---

### exportProject(project: StoredProject): void

Triggers a JSON file download of the project.

**Parameters**:
- `project`: StoredProject to export

**Behavior**:
1. Serialize project to JSON (with 2-space indentation for readability)
2. Create Blob with `application/json` MIME type
3. Create object URL for Blob
4. Trigger download with filename: `{projectName}-{timestamp}.json`
5. Revoke object URL after download

**Example**:
```typescript
exportProject(currentProject);
// Downloads: "My Aksel UI Prototype-2025-11-06.json"
```

**Implementation**:
```typescript
const exportProject = (project: StoredProject): void => {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `${sanitizeFilename(project.name)}-${timestamp}.json`;
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  
  URL.revokeObjectURL(url);
};

const sanitizeFilename = (name: string): string => {
  return name
    .replace(/[^a-z0-9]/gi, '-')  // Replace non-alphanumeric with dash
    .replace(/-+/g, '-')           // Collapse multiple dashes
    .replace(/^-|-$/g, '')         // Trim dashes from ends
    .toLowerCase()
    .substring(0, 50);             // Max 50 chars
};
```

---

### importProject(file: File): Promise<ImportResult>

Imports a project from a JSON file with validation.

**Parameters**:
- `file`: File object from file input

**Returns**:
```typescript
interface ImportResult {
  project: StoredProject | null;
  success: boolean;
  error?: string;
}
```

**Behavior**:
1. Read file as text
2. Parse JSON
3. Validate schema
4. Migrate if version mismatch
5. Assign new `id` and update `lastModified` (treat as new project)
6. Return validated project

**Errors**:
- `READ_ERROR`: File could not be read
- `PARSE_ERROR`: Invalid JSON
- `VALIDATION_ERROR`: Schema validation failed
- `MIGRATION_ERROR`: Migration failed

**Example**:
```typescript
const result = await importProject(file);

if (!result.success) {
  alert(`Import failed: ${result.error}`);
  return;
}

// Confirm before replacing current project
if (confirm('Replace current project with imported project?')) {
  loadProject(result.project);
  saveProject(result.project);
}
```

**Implementation**:
```typescript
const importProject = async (file: File): Promise<ImportResult> => {
  try {
    // Read file
    const text = await file.text();
    
    // Parse JSON
    let imported: any;
    try {
      imported = JSON.parse(text);
    } catch (error) {
      return {
        project: null,
        success: false,
        error: 'Invalid JSON file',
      };
    }
    
    // Validate and migrate
    let project: StoredProject;
    try {
      if (imported.version !== CURRENT_VERSION) {
        project = migrateProject(imported);
      } else {
        project = imported as StoredProject;
      }
      
      validateProjectSchema(project);
    } catch (error) {
      return {
        project: null,
        success: false,
        error: `Validation failed: ${error.message}`,
      };
    }
    
    // Assign new ID and timestamp (treat as new project)
    project.id = crypto.randomUUID();
    project.lastModified = new Date().toISOString();
    
    return {
      project,
      success: true,
    };
    
  } catch (error) {
    return {
      project: null,
      success: false,
      error: `Import error: ${error.message}`,
    };
  }
};
```

---

### clearStorage(): void

Removes the project from LocalStorage (for testing or "New Project").

**Behavior**:
1. Remove `aksel-arcade:project` from LocalStorage
2. Optionally remove auxiliary keys

**Example**:
```typescript
if (confirm('Delete current project?')) {
  clearStorage();
  window.location.reload();
}
```

**Implementation**:
```typescript
const clearStorage = (): void => {
  localStorage.removeItem(STORAGE_KEY);
  // Optionally clear other keys
  // localStorage.removeItem('aksel-arcade:settings');
};
```

---

## Schema Validation

### validateProjectSchema(project: unknown): asserts project is StoredProject

Validates project schema and throws if invalid.

**Implementation**:
```typescript
const validateProjectSchema = (project: unknown): asserts project is StoredProject => {
  if (!project || typeof project !== 'object') {
    throw new Error('Project must be an object');
  }
  
  const p = project as any;
  
  // Required fields
  if (typeof p.version !== 'string' || !p.version.match(/^\d+\.\d+\.\d+$/)) {
    throw new Error('Invalid version field');
  }
  
  if (typeof p.id !== 'string' || !isValidUUID(p.id)) {
    throw new Error('Invalid id field (must be UUID)');
  }
  
  if (typeof p.name !== 'string' || p.name.trim().length === 0 || p.name.length > 100) {
    throw new Error('Invalid name field (1-100 characters)');
  }
  
  if (typeof p.jsxCode !== 'string') {
    throw new Error('Invalid jsxCode field (must be string)');
  }
  
  if (typeof p.hooksCode !== 'string') {
    throw new Error('Invalid hooksCode field (must be string)');
  }
  
  const validViewports = ['XS', 'SM', 'MD', 'LG', 'XL', '2XL'];
  if (!validViewports.includes(p.viewportSize)) {
    throw new Error('Invalid viewportSize field');
  }
  
  const validLayouts = ['editor-left', 'editor-right'];
  if (!validLayouts.includes(p.panelLayout)) {
    throw new Error('Invalid panelLayout field');
  }
  
  if (typeof p.createdAt !== 'string' || !isValidISODate(p.createdAt)) {
    throw new Error('Invalid createdAt field (must be ISO 8601)');
  }
  
  if (typeof p.lastModified !== 'string' || !isValidISODate(p.lastModified)) {
    throw new Error('Invalid lastModified field (must be ISO 8601)');
  }
};

const isValidUUID = (uuid: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
};

const isValidISODate = (date: string): boolean => {
  return !isNaN(Date.parse(date));
};
```

---

## Schema Migration

### migrateProject(stored: any): StoredProject

Migrates projects from older schema versions to current version.

**Current Version**: 1.0.0 (no migrations yet)

**Implementation**:
```typescript
const migrateProject = (stored: any): StoredProject => {
  const version = stored.version || '0.0.0';
  
  // No migrations for initial version
  if (version === '1.0.0') {
    return stored as StoredProject;
  }
  
  // Future migrations
  // Example: if version is less than 1.1.0, add new field
  // if (compareVersions(version, '1.1.0') < 0) {
  //   stored.newField = defaultValue;
  //   stored.version = '1.1.0';
  // }
  
  throw new Error(`Unsupported schema version: ${version}`);
};

// Example future migration (v1.1.0)
// const migrate_1_0_0_to_1_1_0 = (project: any): any => {
//   return {
//     ...project,
//     newField: 'default-value',
//     version: '1.1.0',
//   };
// };
```

---

## Auto-Save Implementation

### useAutoSave Hook

```typescript
const useAutoSave = (project: StoredProject) => {
  const timeoutRef = useRef<number>();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  useEffect(() => {
    clearTimeout(timeoutRef.current);
    setSaveStatus('idle');
    
    // Debounce by 1 second
    timeoutRef.current = setTimeout(() => {
      setSaveStatus('saving');
      
      const result = saveProject(project);
      
      if (result.success) {
        setSaveStatus('saved');
        
        if (result.warning) {
          console.warn(result.warning);
          // Optionally show warning toast
        }
        
        // Reset to idle after 2 seconds
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
        console.error('Auto-save failed:', result.error);
        // Show error notification
      }
    }, 1000);
    
    return () => clearTimeout(timeoutRef.current);
  }, [project]);
  
  return saveStatus;
};
```

**Usage**:
```typescript
function App() {
  const [project, setProject] = useState<StoredProject>(loadProject().project!);
  const saveStatus = useAutoSave(project);
  
  return (
    <div>
      <StatusIndicator status={saveStatus} />
      {/* Rest of app */}
    </div>
  );
}
```

---

## Size Calculation Utilities

### formatBytes(bytes: number): string

Formats byte size for human readability.

```typescript
const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};
```

### getProjectSize(project: StoredProject): number

Calculates exact byte size of serialized project.

```typescript
const getProjectSize = (project: StoredProject): number => {
  const json = JSON.stringify(project);
  return new Blob([json]).size;
};
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('Storage API', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  
  describe('saveProject', () => {
    it('should save valid project to LocalStorage', () => {
      const project = createDefaultProject();
      const result = saveProject(project);
      
      expect(result.success).toBe(true);
      expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
    });
    
    it('should reject project exceeding 5MB', () => {
      const project = createDefaultProject();
      project.jsxCode = 'x'.repeat(6 * 1024 * 1024); // 6MB
      
      const result = saveProject(project);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds 5MB');
    });
    
    it('should warn when project exceeds 4MB', () => {
      const project = createDefaultProject();
      project.jsxCode = 'x'.repeat(4.5 * 1024 * 1024); // 4.5MB
      
      const result = saveProject(project);
      
      expect(result.success).toBe(true);
      expect(result.warning).toContain('approaching 5MB');
    });
  });
  
  describe('loadProject', () => {
    it('should load saved project from LocalStorage', () => {
      const project = createDefaultProject();
      saveProject(project);
      
      const result = loadProject();
      
      expect(result.fromStorage).toBe(true);
      expect(result.project?.id).toBe(project.id);
    });
    
    it('should return default project when LocalStorage is empty', () => {
      const result = loadProject();
      
      expect(result.fromStorage).toBe(false);
      expect(result.project?.name).toBe('Untitled Project');
    });
  });
  
  describe('importProject', () => {
    it('should import valid JSON file', async () => {
      const project = createDefaultProject();
      const json = JSON.stringify(project);
      const file = new File([json], 'project.json', { type: 'application/json' });
      
      const result = await importProject(file);
      
      expect(result.success).toBe(true);
      expect(result.project?.name).toBe(project.name);
    });
    
    it('should reject invalid JSON', async () => {
      const file = new File(['invalid json'], 'project.json', { type: 'application/json' });
      
      const result = await importProject(file);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });
  });
});
```

---

**Contract Status**: ✅ Complete - All storage operations, validation, and migration defined
