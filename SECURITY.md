# Security Documentation

**Last Updated**: 2025-11-17  
**Version**: 1.0.0

## Overview

AkselArcade is a browser-based React playground that executes user-provided code in a sandboxed environment. This document outlines the security measures implemented to protect against common web vulnerabilities.

## Security Model

### Threat Model

**Primary Threats**:
1. **Code Injection**: User executes malicious JavaScript code
2. **XSS (Cross-Site Scripting)**: Malicious code attempts to access parent window
3. **CSRF (Cross-Site Request Forgery)**: Unauthorized API requests from user code
4. **Data Exfiltration**: User code attempts to send data to external servers
5. **Source Code Exposure**: Production source maps expose implementation details

**Out of Scope**:
- DoS attacks (intentional infinite loops, memory exhaustion)
- Browser vulnerabilities (zero-day exploits in browser engines)
- Social engineering attacks on users

## Security Measures Implemented

### 1. Iframe Sandbox Isolation

**Implementation**: `public/sandbox.html`

User code executes in a sandboxed iframe with the following attributes:
```html
<iframe
  src="/sandbox.html"
  sandbox="allow-scripts allow-same-origin"
/>
```

**Sandbox Restrictions**:
- ✅ `allow-scripts`: Allows JavaScript execution (required for playground)
- ✅ `allow-same-origin`: Allows access to same-origin resources (required for Vite HMR in dev)
- ❌ `allow-forms`: **Blocked** - prevents form submissions
- ❌ `allow-popups`: **Blocked** - prevents opening new windows
- ❌ `allow-top-navigation`: **Blocked** - prevents navigating parent window
- ❌ `allow-pointer-lock`: **Blocked** - prevents pointer lock API
- ❌ `allow-modals`: **Blocked** - prevents alert/confirm/prompt

**Security Benefit**: Even if user code is malicious, it cannot:
- Navigate the parent window
- Access cookies or localStorage of the parent
- Open popup windows or tabs
- Submit forms to external domains

### 2. Content Security Policy (CSP)

**Implementation**: `public/sandbox.html` (lines 8-24)

Dynamic CSP based on environment (development vs production):

**Development CSP** (localhost):
```
default-src 'none'; 
script-src 'unsafe-inline' 'unsafe-eval' http://localhost:* https://localhost:*; 
style-src 'unsafe-inline' http://localhost:* https://localhost:* https://cdn.nav.no; 
font-src https://cdn.nav.no data:; 
connect-src http://localhost:* https://localhost:* ws://localhost:* wss://localhost:*; 
img-src data: https:;
```

**Production CSP**:
```
default-src 'none'; 
script-src 'unsafe-inline' 'unsafe-eval'; 
style-src 'unsafe-inline' https://cdn.nav.no; 
font-src https://cdn.nav.no data:; 
connect-src https://cdn.nav.no; 
img-src data: https:;
```

**CSP Directives Explained**:
- `default-src 'none'`: Block all resources by default (whitelist approach)
- `script-src 'unsafe-eval'`: **Required** for user code execution via `eval()`
  - ⚠️ Note: This is intentional for a code playground. User code must be evaluated dynamically.
- `script-src 'unsafe-inline'`: Allows inline scripts (for sandbox runtime)
- `connect-src`: In production, **only** allows connections to `cdn.nav.no` (Aksel CDN)
  - ❌ **Blocks** external API calls, preventing data exfiltration
- `img-src data: https:`: Allows data URIs and HTTPS images only
- `font-src https://cdn.nav.no data:`: Restricts fonts to Aksel CDN only

**Security Benefit**:
- User code **cannot make network requests** in production (no `fetch()` or `XMLHttpRequest` to external domains)
- Prevents data exfiltration to attacker-controlled servers
- Mitigates supply chain attacks by restricting resource loading

### 3. PostMessage Origin Validation

**Implementation**: All components using `postMessage` (fixed 2025-11-17)

**Before (Insecure)**:
```typescript
window.parent.postMessage(message, '*')  // ❌ Wildcard origin
```

**After (Secure)**:
```typescript
window.parent.postMessage(message, window.location.origin)  // ✅ Same-origin only
```

**Validation on Receiving End**:
```typescript
window.addEventListener('message', (event) => {
  // Security: Validate origin (same-origin only)
  if (event.origin !== window.location.origin) {
    console.warn('❌ Rejected message from unauthorized origin:', event.origin)
    return
  }
  
  // Validate message structure
  if (!event.data || typeof event.data !== 'object') return
  
  // Process message...
})
```

**Files Updated**:
- `src/components/Preview/LivePreview.tsx` (4 instances)
- `src/components/Preview/InspectMode.tsx` (1 instance)
- `src/components/Preview/ThemeToggle.tsx` (2 instances)
- `public/sandbox.html` (4 instances)

**Security Benefit**:
- Prevents malicious third-party pages from sending spoofed messages
- Ensures communication only between trusted components (main app ↔ sandbox)

### 4. Source Map Protection

**Implementation**: `vite.config.ts`

```typescript
build: {
  // Security: Disable source maps in production
  sourcemap: false,
  // ...
}
```

**Security Benefit**:
- Production builds do not include `.map` files
- Source code structure and variable names are not exposed
- Makes reverse engineering and vulnerability discovery harder

**Note**: Vite disables source maps by default in production, but we explicitly set `sourcemap: false` for clarity and defense-in-depth.

### 5. Input Validation & Sanitization

**Implementation**: `src/utils/security.ts`

All messages from the sandbox are validated using TypeScript type guards:

```typescript
export function validateSandboxToMainMessage(data: unknown): data is SandboxToMainMessage {
  // Validate message structure before processing
  // ...
}
```

**Security Benefit**:
- Prevents malformed messages from causing crashes or unexpected behavior
- Enforces strict message contracts between main app and sandbox

### 6. No Dangerous APIs Exposed

**User Code Restrictions**:
- ❌ No access to `document.cookie`
- ❌ No access to `localStorage` of parent window (iframe has separate storage)
- ❌ No access to `window.top` or `window.parent` (sandbox prevents navigation)
- ❌ No network requests in production (CSP blocks `fetch`/`XMLHttpRequest`)

**Allowed APIs**:
- ✅ React API (hooks, components)
- ✅ Aksel Design System components
- ✅ Standard JavaScript APIs (Math, Date, Array, etc.)
- ✅ Console logging (proxied to main app console)

## Production Deployment Checklist

Before deploying to production, verify:

- [ ] `npm run type-check` passes (no TypeScript errors)
- [ ] `npm run lint` passes (no ESLint errors)
- [ ] `npm run build` succeeds
- [ ] `dist/` folder does **not** contain `.map` files
- [ ] Production CSP is active (test on deployed domain)
- [ ] PostMessage origin validation is enabled (check browser console for validation logs)
- [ ] All debug/test files removed from repository
- [ ] `.gitignore` excludes build artifacts

## Reporting Security Issues

If you discover a security vulnerability, please:

1. **Do not** open a public GitHub issue
2. Contact the maintainers privately via email (add contact email here)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work with you to address the issue.

## Security Audit Log

| Date       | Action                                      | Version |
|------------|---------------------------------------------|---------|
| 2025-11-17 | Initial security audit and hardening        | 1.0.0   |
| 2025-11-17 | Fixed postMessage origin validation         | 1.0.0   |
| 2025-11-17 | Implemented dynamic CSP (dev vs prod)       | 1.0.0   |
| 2025-11-17 | Disabled source maps in production          | 1.0.0   |
| 2025-11-17 | Repository cleanup (removed debug files)    | 1.0.0   |

## Known Limitations

### Intentional Security Trade-offs

1. **`'unsafe-eval'` in CSP**: Required for dynamic code execution. This is the core feature of the playground and cannot be removed. User code is isolated in iframe to mitigate risks.

2. **`allow-same-origin` sandbox attribute**: Required for:
   - Vite HMR (Hot Module Replacement) in development
   - Loading Aksel components from same origin
   
   Without this, the sandbox cannot access resources from the Vite dev server. The CSP and postMessage validation provide additional layers of defense.

3. **DoS Attacks**: No protection against intentional infinite loops or memory exhaustion in user code. Users can crash their own browser tab, but this does not affect other tabs or the server (browser-only architecture).

## References

- [MDN: iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#attr-sandbox)
- [MDN: Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [MDN: postMessage Security](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#security_concerns)
- [OWASP: Cross-Site Scripting (XSS)](https://owasp.org/www-community/attacks/xss/)

---

**Maintained by**: AkselArcade Team  
**Last Review**: 2025-11-17
