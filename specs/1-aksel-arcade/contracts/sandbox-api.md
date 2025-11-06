# Sandbox API Contract

**Feature**: 1-aksel-arcade  
**Date**: 2025-11-06  
**Version**: 1.0.0

## Overview

This contract defines the PostMessage API for secure communication between the main Aksel Arcade application and the sandboxed iframe that executes user code. All messages are type-safe, validated, and follow a command/response pattern.

---

## Security Model

### Iframe Configuration

```html
<iframe
  id="preview-sandbox"
  sandbox="allow-scripts"
  referrerpolicy="no-referrer"
  title="Live Preview Sandbox"
  src="/sandbox.html"
/>
```

**Sandbox Restrictions**:
- ✅ `allow-scripts`: Required for React code execution
- ❌ No `allow-same-origin`: Prevents access to parent localStorage/cookies
- ❌ No `allow-forms`: Prevents form submission
- ❌ No `allow-popups`: Prevents window.open()
- ❌ No `allow-modals`: Prevents alert/confirm/prompt

### Content Security Policy

**Main Application CSP**:
```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
connect-src 'none';
img-src 'self' data:;
font-src 'self';
```

**Sandbox Iframe CSP** (via meta tag in sandbox.html):
```
default-src 'none';
script-src 'unsafe-eval' 'unsafe-inline';
style-src 'unsafe-inline';
connect-src 'none';
img-src data:;
```

**Rationale**:
- `'unsafe-eval'` in sandbox required for Babel Standalone transpilation
- `connect-src 'none'` blocks all network requests (FR-022)
- Sandbox cannot access parent via `allow-same-origin` omission

---

## Message Types

### Main → Sandbox Messages

#### 1. EXECUTE_CODE

Instructs the sandbox to transpile and execute user JSX and Hooks code.

```typescript
interface ExecuteCodeMessage {
  type: 'EXECUTE_CODE';
  payload: {
    jsxCode: string;      // JSX tab content
    hooksCode: string;    // Hooks tab content
    requestId?: string;   // Optional correlation ID
  };
}
```

**Behavior**:
1. Sandbox receives message
2. Transpiles `hooksCode` and `jsxCode` with Babel Standalone
3. Creates virtual module system: `./hooks` exports hooks, `./main` imports and renders JSX
4. Executes transpiled code and renders to `#root` div
5. Sends `RENDER_SUCCESS` or `COMPILE_ERROR`/`RUNTIME_ERROR` response

**Error Handling**:
- Transpilation error → `COMPILE_ERROR` with line/column
- Runtime error → `RUNTIME_ERROR` with stack trace
- Timeout (5s) → Main app shows "Execution timeout" error

**Example**:
```typescript
// Main app sends
window.frames[0].postMessage({
  type: 'EXECUTE_CODE',
  payload: {
    jsxCode: 'export default function App() { return <Button>Click</Button>; }',
    hooksCode: 'export const useCounter = () => { const [count, setCount] = useState(0); return { count, increment: () => setCount(c => c + 1) }; };',
    requestId: 'exec-123',
  },
}, '*');
```

---

#### 2. UPDATE_VIEWPORT

Notifies sandbox of viewport width change (for responsive testing).

```typescript
interface UpdateViewportMessage {
  type: 'UPDATE_VIEWPORT';
  payload: {
    width: number;  // New viewport width in pixels (320-1440)
  };
}
```

**Behavior**:
1. Sandbox updates iframe body width
2. Triggers re-layout of rendered components
3. No response message (fire-and-forget)

**Example**:
```typescript
// Main app sends
window.frames[0].postMessage({
  type: 'UPDATE_VIEWPORT',
  payload: { width: 768 }, // MD breakpoint
}, '*');
```

---

#### 3. TOGGLE_INSPECT

Enables or disables element inspection mode.

```typescript
interface ToggleInspectMessage {
  type: 'TOGGLE_INSPECT';
  payload: {
    enabled: boolean;
  };
}
```

**Behavior**:
1. If `enabled: true`: Attach mousemove listener to track hovered element
2. If `enabled: false`: Remove mousemove listener, clear highlight
3. No immediate response (subsequent hovers trigger `INSPECTION_DATA` messages)

**Example**:
```typescript
// Main app sends
window.frames[0].postMessage({
  type: 'TOGGLE_INSPECT',
  payload: { enabled: true },
}, '*');
```

---

#### 4. GET_INSPECTION_DATA

Requests inspection data for element at specific coordinates (triggered by hover in inspect mode).

```typescript
interface GetInspectionDataMessage {
  type: 'GET_INSPECTION_DATA';
  payload: {
    x: number;  // Viewport-relative X coordinate
    y: number;  // Viewport-relative Y coordinate
  };
}
```

**Behavior**:
1. Sandbox uses `document.elementFromPoint(x, y)` to find element
2. Extracts component name, props, computed styles (see InspectionData in data-model.md)
3. Sends `INSPECTION_DATA` response with data or `null` if no element found

**Example**:
```typescript
// Main app sends (on mousemove when inspect enabled)
window.frames[0].postMessage({
  type: 'GET_INSPECTION_DATA',
  payload: { x: 250, y: 100 },
}, '*');
```

---

### Sandbox → Main Messages

#### 1. RENDER_SUCCESS

Indicates successful code execution and rendering.

```typescript
interface RenderSuccessMessage {
  type: 'RENDER_SUCCESS';
  payload?: {
    requestId?: string;  // Correlation ID from EXECUTE_CODE
  };
}
```

**Example**:
```typescript
// Sandbox sends
window.parent.postMessage({
  type: 'RENDER_SUCCESS',
  payload: { requestId: 'exec-123' },
}, '*');
```

---

#### 2. COMPILE_ERROR

Reports JSX/Hooks transpilation error.

```typescript
interface CompileErrorMessage {
  type: 'COMPILE_ERROR';
  payload: {
    message: string;       // Error message (e.g., "Unexpected token")
    line: number | null;   // Line number in source (0-indexed)
    column: number | null; // Column number in source (0-indexed)
    stack: string | null;  // Full error stack
    requestId?: string;    // Correlation ID
  };
}
```

**Example**:
```typescript
// Sandbox sends
window.parent.postMessage({
  type: 'COMPILE_ERROR',
  payload: {
    message: 'SyntaxError: Unexpected token (3:15)',
    line: 3,
    column: 15,
    stack: 'SyntaxError: Unexpected token...',
    requestId: 'exec-123',
  },
}, '*');
```

---

#### 3. RUNTIME_ERROR

Reports error during React rendering or user code execution.

```typescript
interface RuntimeErrorMessage {
  type: 'RUNTIME_ERROR';
  payload: {
    message: string;             // Error message
    componentStack: string | null; // React component stack
    stack: string;               // JavaScript stack trace
    requestId?: string;
  };
}
```

**Example**:
```typescript
// Sandbox sends
window.parent.postMessage({
  type: 'RUNTIME_ERROR',
  payload: {
    message: 'Cannot read property "foo" of undefined',
    componentStack: '    in Button\n    in App',
    stack: 'TypeError: Cannot read property...',
    requestId: 'exec-123',
  },
}, '*');
```

---

#### 4. INSPECTION_DATA

Provides element inspection details in response to `GET_INSPECTION_DATA` or automatic hover detection.

```typescript
interface InspectionDataMessage {
  type: 'INSPECTION_DATA';
  payload: {
    componentName: string;
    tagName: string;
    cssClass: string;
    props: Record<string, unknown>;
    color: string;
    fontFamily: string;
    fontSize: string;
    margin: string;
    padding: string;
    boundingRect: {
      x: number;
      y: number;
      width: number;
      height: number;
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  } | null;  // null if no element at coordinates
}
```

**Example**:
```typescript
// Sandbox sends
window.parent.postMessage({
  type: 'INSPECTION_DATA',
  payload: {
    componentName: 'Button',
    tagName: 'button',
    cssClass: 'button aksel-button',
    props: { variant: 'primary', size: 'medium', children: 'Click me' },
    color: 'rgb(255, 255, 255)',
    fontFamily: 'Inter, sans-serif',
    fontSize: '16px',
    margin: '0px',
    padding: '8px 16px',
    boundingRect: { x: 100, y: 50, width: 120, height: 40, top: 50, right: 220, bottom: 90, left: 100 },
  },
}, '*');
```

---

#### 5. CONSOLE_LOG

Proxies console.log/warn/error calls from sandbox to main app for debugging.

```typescript
interface ConsoleLogMessage {
  type: 'CONSOLE_LOG';
  payload: {
    level: 'log' | 'warn' | 'error';
    args: any[];  // Serialized console arguments
    timestamp: number; // Timestamp in ms
  };
}
```

**Example**:
```typescript
// Sandbox sends (when user code calls console.log('Hello', { foo: 'bar' }))
window.parent.postMessage({
  type: 'CONSOLE_LOG',
  payload: {
    level: 'log',
    args: ['Hello', { foo: 'bar' }],
    timestamp: Date.now(),
  },
}, '*');
```

---

## Message Validation

### Runtime Type Guards

```typescript
// Main app validates messages from sandbox
const isSandboxToMainMessage = (msg: any): msg is SandboxToMainMessage => {
  if (!msg || typeof msg !== 'object' || !msg.type) return false;
  
  const validTypes = ['RENDER_SUCCESS', 'COMPILE_ERROR', 'RUNTIME_ERROR', 'INSPECTION_DATA', 'CONSOLE_LOG'];
  return validTypes.includes(msg.type);
};

// Sandbox validates messages from main app
const isMainToSandboxMessage = (msg: any): msg is MainToSandboxMessage => {
  if (!msg || typeof msg !== 'object' || !msg.type) return false;
  
  const validTypes = ['EXECUTE_CODE', 'UPDATE_VIEWPORT', 'TOGGLE_INSPECT', 'GET_INSPECTION_DATA'];
  return validTypes.includes(msg.type);
};
```

### Origin Validation

```typescript
// Main app checks message source
window.addEventListener('message', (event) => {
  // Only accept messages from our sandbox iframe
  if (event.source !== iframeRef.current?.contentWindow) {
    console.warn('Ignoring message from unknown source');
    return;
  }
  
  if (!isSandboxToMainMessage(event.data)) {
    console.warn('Invalid message format:', event.data);
    return;
  }
  
  handleSandboxMessage(event.data);
});

// Sandbox checks message source
window.addEventListener('message', (event) => {
  // Only accept messages from parent window
  if (event.source !== window.parent) {
    console.warn('Ignoring message from unknown source');
    return;
  }
  
  if (!isMainToSandboxMessage(event.data)) {
    console.warn('Invalid message format:', event.data);
    return;
  }
  
  handleMainMessage(event.data);
});
```

---

## Error Handling Strategy

### Timeout Protection

```typescript
// Main app sets timeout for code execution
const executeCodeWithTimeout = (code: string, timeout = 5000) => {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Code execution timeout'));
    }, timeout);
    
    const successListener = (event: MessageEvent) => {
      if (event.data.type === 'RENDER_SUCCESS') {
        clearTimeout(timer);
        window.removeEventListener('message', successListener);
        resolve();
      }
    };
    
    const errorListener = (event: MessageEvent) => {
      if (event.data.type === 'COMPILE_ERROR' || event.data.type === 'RUNTIME_ERROR') {
        clearTimeout(timer);
        window.removeEventListener('message', errorListener);
        reject(event.data.payload);
      }
    };
    
    window.addEventListener('message', successListener);
    window.addEventListener('message', errorListener);
    
    // Send EXECUTE_CODE message
    sendToSandbox({ type: 'EXECUTE_CODE', payload: { jsxCode: code, hooksCode: '' } });
  });
};
```

### Error Recovery

```typescript
// Sandbox catches and reports all errors
window.addEventListener('error', (event) => {
  window.parent.postMessage({
    type: 'RUNTIME_ERROR',
    payload: {
      message: event.message,
      componentStack: null,
      stack: event.error?.stack || '',
    },
  }, '*');
});

// React error boundary in sandbox
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    window.parent.postMessage({
      type: 'RUNTIME_ERROR',
      payload: {
        message: error.message,
        componentStack: errorInfo.componentStack,
        stack: error.stack || '',
      },
    }, '*');
  }
  
  render() {
    return this.props.children;
  }
}
```

---

## Performance Considerations

### Message Throttling

```typescript
// Throttle inspection data messages during hover (max 60fps)
let lastInspectionTime = 0;
const INSPECTION_THROTTLE_MS = 16; // ~60fps

const handleMouseMove = (event: MouseEvent) => {
  const now = Date.now();
  if (now - lastInspectionTime < INSPECTION_THROTTLE_MS) return;
  lastInspectionTime = now;
  
  const element = document.elementFromPoint(event.clientX, event.clientY);
  if (element) {
    const data = extractInspectionData(element as HTMLElement);
    window.parent.postMessage({
      type: 'INSPECTION_DATA',
      payload: data,
    }, '*');
  }
};
```

### Debounced Code Execution

```typescript
// Main app debounces EXECUTE_CODE messages (250ms per spec)
const debouncedExecute = debounce((jsxCode: string, hooksCode: string) => {
  sendToSandbox({
    type: 'EXECUTE_CODE',
    payload: { jsxCode, hooksCode },
  });
}, 250);
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('Message Validation', () => {
  it('should accept valid EXECUTE_CODE message', () => {
    const msg = {
      type: 'EXECUTE_CODE',
      payload: { jsxCode: 'test', hooksCode: '' },
    };
    expect(isMainToSandboxMessage(msg)).toBe(true);
  });
  
  it('should reject invalid message type', () => {
    const msg = { type: 'INVALID', payload: {} };
    expect(isMainToSandboxMessage(msg)).toBe(false);
  });
  
  it('should reject message with missing payload', () => {
    const msg = { type: 'EXECUTE_CODE' };
    expect(isMainToSandboxMessage(msg)).toBe(false);
  });
});
```

### Integration Tests

```typescript
describe('Sandbox Communication', () => {
  it('should execute code and receive RENDER_SUCCESS', async () => {
    const iframe = renderSandboxIframe();
    
    const promise = waitForMessage('RENDER_SUCCESS');
    
    sendToSandbox({
      type: 'EXECUTE_CODE',
      payload: {
        jsxCode: 'export default () => <div>Test</div>',
        hooksCode: '',
      },
    });
    
    await expect(promise).resolves.toBeTruthy();
  });
  
  it('should report compile error for invalid JSX', async () => {
    const iframe = renderSandboxIframe();
    
    const promise = waitForMessage('COMPILE_ERROR');
    
    sendToSandbox({
      type: 'EXECUTE_CODE',
      payload: {
        jsxCode: 'export default () => <div',
        hooksCode: '',
      },
    });
    
    const error = await promise;
    expect(error.payload.message).toContain('SyntaxError');
  });
});
```

---

**Contract Status**: ✅ Complete - All message types, validation, and error handling defined
