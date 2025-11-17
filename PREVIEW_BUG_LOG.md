# Preview Bug Fix Attempts Log

## Problem Statement
Preview pane is black/empty in production (https://navikt.github.io/aksel-arcade/), but works fine in localhost:5173.

## Attempt History

### Attempt 1 (Date Unknown - Before Current Session)
**Theory**: Unknown
**Fix Attempted**: Unknown
**Result**: Failed - preview still black

### Attempt 2 (Date Unknown - Before Current Session)
**Theory**: Unknown
**Fix Attempted**: Unknown
**Result**: Failed - preview still black

### Attempt 3 (Date Unknown - Before Current Session)
**Theory**: Unknown
**Fix Attempted**: Unknown
**Result**: Failed - preview still black

### Attempt 4 (Date Unknown - Before Current Session)
**Theory**: Unknown
**Fix Attempted**: Unknown
**Result**: Failed - preview still black

### Attempt 5 (2025-11-17 - Current Session)
**Theory**: Sandbox bundle path resolution incorrect in production
**Analysis**:
- sandbox.html at `/aksel-arcade/sandbox.html` was using `'../' + sandboxEntry.file`
- This resolved to `/assets/sandbox-DNgRkRTS.js` (404)
- Should be `/aksel-arcade/assets/sandbox-DNgRkRTS.js`

**Fix Attempted**: Changed line 247 in public/sandbox.html from:
```javascript
const sandboxPath = '../' + sandboxEntry.file;
```
to:
```javascript
const sandboxPath = basePath + sandboxEntry.file;
```

**Verification Performed**:
- ✅ Confirmed wrong path returns 404: curl https://navikt.github.io/assets/sandbox-DNgRkRTS.js
- ✅ Confirmed correct path returns 200: curl https://navikt.github.io/aksel-arcade/assets/sandbox-DNgRkRTS.js
- ✅ Built production bundle with fix
- ✅ Verified fix is in dist/sandbox.html
- ❌ DID NOT VERIFY in actual browser before claiming fixed

**Result**: UNKNOWN - Need to verify in actual production environment

**Status**: PENDING VERIFICATION

## Next Steps
1. ✅ FOUND ROOT CAUSE: LivePreview.tsx line 165 uses `src="./sandbox.html"`
   - In dev: resolves to `/sandbox.html` ✅
   - In prod: resolves to `/aksel-arcade/sandbox.html` ❌ (should be `/aksel-arcade/sandbox.html` but path is relative)
   
### Attempt 6 (2025-11-17 - Current Session)
**Theory**: iframe src uses relative path that doesn't account for base path
**Root Cause**: `src="./sandbox.html"` in LivePreview.tsx line 165
  - In localhost: `./sandbox.html` resolves to `/sandbox.html` ✅
  - In production: `./sandbox.html` resolves to `/sandbox.html` ❌ (should be `/aksel-arcade/sandbox.html`)

**Fix Applied**: Changed LivePreview.tsx line 165:
```typescript
// Before:
src="./sandbox.html"

// After:
src={import.meta.env.BASE_URL + 'sandbox.html'}
```

**Verification Performed**:
- ✅ Built production bundle
- ✅ Verified built JS contains: `src:"/aksel-arcade/sandbox.html`
- ⏳ Need to verify in actual browser that preview works

**Status**: READY FOR TESTING - Changes committed and built

**Files Changed**:
1. `/Users/Sjur.Gronningseter/dev/AkselArcade/public/sandbox.html` (line 247) - Fixed sandbox bundle path resolution
2. `/Users/Sjur.Gronningseter/dev/AkselArcade/src/components/Preview/LivePreview.tsx` (line 165) - Fixed iframe src path

**To Deploy**: Push changes and GitHub Actions will deploy to https://navikt.github.io/aksel-arcade/

**Result**: ❌ FAILED - Preview still black in production
**Evidence from user**: Inspected iframe HTML shows sandbox.html loaded but #root is empty
**Key Console Output from Production**:
- "🔧 Environment: Production" ✅
- "📦 Loading from built assets..." ✅
- Attempting to load from manifest and sandbox bundle

**CRITICAL NEW INFO FROM USER**:
1. Repo was moved from personal account to navikt org
2. Repo was renamed from "Arcade" to "aksel-arcade"
3. iframe HTML loads correctly but #root div remains empty (no React render)

### Attempt 7 (2025-11-17 - Current Session)
**Theory**: sandbox.html loads but React/Aksel fails to initialize, causing empty render
**Investigation Steps**:
1. Check browser console logs from production iframe
2. Check if loadFromBuild() succeeds or falls back to CDN
3. Check if SANDBOX_READY message is sent
4. Check if EXECUTE_CODE message is received
5. Check if akselLoaded flag is set correctly

**Hypothesis**: Dynamic import failing due to MIME type or CORS issue
**Analysis**:
- sandbox.html loads correctly (user confirmed via inspect)
- Script executes (CSP applied correctly based on user's HTML)
- But React doesn't render (empty #root div)
- This suggests: `loadFromBuild()` is failing and NOT falling back to CDN properly

**Likely Root Cause**: Dynamic `import()` statement might be failing with CORS or MIME type error, and the `.catch()` handler isn't being triggered properly OR CDN fallback is also failing silently.

**Need to check**:
1. Are there console errors in production iframe?
2. Is the import statement actually executing?
3. Is CDN fallback being triggered?

**Status**: DEBUG LOGGING ADDED

**Fix Applied**: Added comprehensive error logging to sandbox.html:
- Log start of module load process
- Log which load function is being called (dev vs prod)
- Enhanced error catch to show full error details
- Error catch now sends RUNTIME_ERROR to parent window so errors are visible

**Files Changed**:
- public/sandbox.html: Added debug logs at lines 274-276 and enhanced error catch at lines 327-344

**Next**: Build, deploy, and check production console for actual error messages

### Attempt 8 (2025-11-17 - After Enhanced Logging)
**Status**: ✅ BUILT SUCCESSFULLY

**Build Output**:
- Build completed in 7.44s
- ✅ Enhanced error logging confirmed in dist/sandbox.html
- ✅ Startup logging confirmed in dist/sandbox.html
- All assets generated successfully

**Next Steps**:
1. Commit and push changes to GitHub
2. Wait for GitHub Actions to deploy
3. Open https://navikt.github.io/aksel-arcade/ in browser
4. Open DevTools console
5. Look for console logs starting with "🚀 Starting module load"
6. If error, look for "❌❌❌ CRITICAL ERROR" messages
7. Record actual error message in this log

**Files Ready to Commit**:
- public/sandbox.html (enhanced logging)
- src/components/Preview/LivePreview.tsx (fixed iframe src)
- dist/* (built files)
