# Theme Centralization Investigation & Fix Plan

## Current Architecture Analysis (Problem Identified)

### Theme Handling Locations Found:

1. **SettingsContext** (`src/contexts/SettingsContext.tsx`)
   - Manages theme state: `'light' | 'dark'`
   - Has `toggleTheme()` function
   - Default: `'dark'`
   - ✅ **THIS SHOULD BE THE SINGLE SOURCE OF TRUTH**

2. **ThemeProvider** (`src/components/Layout/ThemeProvider.tsx`)
   - Wraps app with Aksel `<Theme>` component
   - Reads from SettingsContext
   - Applied at App.tsx level
   - ✅ **CORRECT - Uses SettingsContext**

3. **AppHeader** (`src/components/Header/AppHeader.tsx`)
   - Has Settings button with ActionMenu
   - Contains theme toggle in ActionMenu
   - Calls `toggleTheme()` from SettingsContext
   - ✅ **CORRECT - Uses SettingsContext**

4. **ThemeToggle** (`src/components/Preview/ThemeToggle.tsx`) 
   - ❌ **PROBLEM #1**: Has its own LOCAL theme state: `useState<'light' | 'dark'>('dark')`
   - ❌ **PROBLEM #2**: Separate from main app theme (SettingsContext)
   - ❌ **PROBLEM #3**: Sends theme to sandbox independently
   - Located in Preview header
   - 🔥 **THIS MUST BE REMOVED OR REFACTORED**

5. **PreviewPane** (`src/components/Preview/PreviewPane.tsx`)
   - Has local state: `const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light')`
   - ❌ **PROBLEM #4**: Different default than main app ('light' vs 'dark')
   - ❌ **PROBLEM #5**: Manages theme independently
   - Applies theme as className to preview container
   - 🔥 **THIS MUST BE REFACTORED**

6. **Sandbox** (`public/sandbox.html`)
   - Has its own theme state: `let currentTheme = 'dark'`
   - Listens for `UPDATE_THEME` messages
   - Updates html/root classes and re-renders component
   - ✅ **CORRECT APPROACH** - Should receive theme from centralized source

### Root Cause Identified:

**The preview panel has its own independent theme management that is NOT synchronized with the main app theme controlled in Settings.**

This means:
- Main app theme (controlled by Settings) affects: App UI, Editor, Header
- Preview theme (controlled by ThemeToggle in Preview) affects: Sandbox/iframe content
- These are DISCONNECTED, causing confusion and inconsistent behavior

## Solution Design: Centralized Theme Control

### Principle:
**Single Source of Truth: SettingsContext manages ONE theme that applies to BOTH main app AND preview/sandbox.**

### Implementation Plan:

#### Stage 1: Remove Duplicate Theme State
- [ ] Remove local theme state from `ThemeToggle.tsx`
- [ ] Remove local theme state from `PreviewPane.tsx`
- [ ] Remove ThemeToggle component from Preview header (it's redundant - Settings already controls theme)

#### Stage 2: Connect Preview to SettingsContext
- [ ] Update `PreviewPane.tsx` to read theme from `useSettings()`
- [ ] Update `LivePreview.tsx` (or wherever iframe is) to send theme from SettingsContext to sandbox

#### Stage 3: Verify Sandbox Integration
- [ ] Ensure sandbox receives theme updates when Settings theme toggles
- [ ] Test theme switching applies to both main app AND preview

#### Stage 4: Clean Up UI
- [ ] Remove ThemeToggle button from Preview header (reduces clutter)
- [ ] Theme is now controlled ONLY from Settings in AppHeader

#### Stage 5: Verification Testing
- [ ] Open app in browser
- [ ] Toggle theme from Settings
- [ ] Verify BOTH main app AND preview change theme together
- [ ] Verify no console errors
- [ ] Verify Aksel components render correctly in both themes

## Expected Outcome:

✅ Single theme toggle in Settings controls entire app
✅ Main app and preview are always in sync
✅ Simpler, cleaner architecture
✅ No confusion about where to change theme
✅ Follows Constitution: Clean Code Excellence, Modular & Reusable Code

## Implementation Status:
- [ ] Stage 1: Remove Duplicate Theme State
- [ ] Stage 2: Connect Preview to SettingsContext
- [ ] Stage 3: Verify Sandbox Integration
- [ ] Stage 4: Clean Up UI
- [ ] Stage 5: Verification Testing
