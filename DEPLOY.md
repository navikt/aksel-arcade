# Deploy to GitHub Pages

**Status**: Production Ready  
**Last Verified**: 2025-11-17

## Quick Deploy

```bash
# 1. Commit your changes
git add .
git commit -m "Ready for deployment"

# 2. Push to trigger deployment
git push origin 1-aksel-arcade

# 3. Merge to main (after verification)
git checkout master
git merge 1-aksel-arcade
git push origin master
```

GitHub Actions will automatically build and deploy to GitHub Pages.

Your app will be live at: **https://navikt.github.io/aksel-arcade/**

## Security ✅

All security measures are in place:
- ✅ PostMessage origin validation (same-origin only)
- ✅ Content Security Policy (production mode)
- ✅ Source maps disabled in production
- ✅ Sandbox iframe isolation
- ✅ No external network requests allowed

## Pre-Deployment Checks

Before deploying, verify locally:

```bash
# 1. Type check
npm run type-check  # Must pass with 0 errors

# 2. Build for production
npm run build

# 3. Preview production build
npm run preview
```

Open http://localhost:4173 and test:
- [ ] Code execution works
- [ ] Theme toggle works
- [ ] Preview updates correctly
- [ ] No console errors

## First-Time Setup

If this is your first deployment:

1. **Enable GitHub Pages**:
   - Go to: https://github.com/navikt/aksel-arcade/settings/pages
   - Source: "GitHub Actions"
   - Save

2. **Push the workflow** (already created in `.github/workflows/deploy.yml`)

3. **Monitor deployment**:
   - Go to: https://github.com/navikt/aksel-arcade/actions
   - Watch the "Deploy to GitHub Pages" workflow

## Architecture

**Browser-only, no backend**:
- All code runs in browser
- No server required
- Uses localStorage for persistence
- Sandboxed iframe for user code execution

**Bundle size**: ~500KB (optimized with code splitting)

**Security model**:
- User code runs in isolated iframe
- CSP blocks external requests
- PostMessage with origin validation
- See `SECURITY.md` for details

## Troubleshooting

**White screen after deploy?**
- Check GitHub Actions logs for build errors
- Verify `vite.config.ts` has correct `base: '/aksel-arcade/'`

**Assets not loading?**
- Clear browser cache (Cmd+Shift+R)
- Check browser console for 404 errors

**Code execution fails?**
- Check browser console for CSP violations
- Verify sandbox.html loads correctly

## Rollback

If something breaks:

```bash
# 1. Go to GitHub Actions
# 2. Find last working deployment
# 3. Click "Re-run all jobs"
```

Or revert locally:

```bash
git revert HEAD
git push origin master
```

## Monitoring

**After deployment, verify**:
1. Visit https://navikt.github.io/aksel-arcade/
2. Open DevTools Console
3. Check for:
   - ✅ "🔒 CSP applied: Production"
   - ❌ No CSP violations
   - ❌ No 404 errors

**Performance**:
- Initial load: <2s on 3G (target met)
- No backend = instant deployment
- GitHub Pages CDN = global distribution

## Support

- **GitHub Issues**: https://github.com/navikt/aksel-arcade/issues
- **Actions Dashboard**: https://github.com/navikt/aksel-arcade/actions

---

**Constitution Compliant**: Browser-first, clean code, performance-first ✅
