# Production Deployment Guide

**Last Updated**: 2025-11-17  
**Target Platform**: Static hosting (Vercel, Netlify, GitHub Pages, etc.)

## Prerequisites

- Node.js 18+ installed
- npm 9+ installed
- Git repository access
- Static hosting account (e.g., Vercel, Netlify)

## Pre-Deployment Checklist

### 1. Code Quality

Run all checks to ensure code quality:

```bash
# TypeScript type checking
npm run type-check

# ESLint validation
npm run lint

# Format check (optional)
npm run format
```

**Expected Output**: No errors. All checks should pass.

### 2. Build Verification

Test the production build locally:

```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

**Expected Output**:
- `dist/` folder created
- No build errors
- Preview server starts on `http://localhost:4173`

**Verify in Browser**:
1. Open `http://localhost:4173`
2. Test code execution (write a simple React component)
3. Test theme toggle
4. Test viewport resize
5. Test inspect mode
6. Check browser console for errors

### 3. Security Verification

**Check Source Maps**:
```bash
# Should return empty (no .map files in production build)
find dist -name "*.map"
```

**Check CSP in Production**:
1. Open browser DevTools → Console
2. Look for: `🔒 CSP applied: Production`
3. Verify no CSP violations in console

**Check PostMessage Origin Validation**:
1. Open browser DevTools → Console
2. Execute code in editor
3. Look for logs like: `📤 Sending EXECUTE_CODE to sandbox`
4. Verify no `❌ Rejected message from unauthorized origin` warnings

### 4. Performance Check

**Bundle Size Analysis**:
```bash
npm run build

# Check main bundle size (should be < 2MB total)
du -sh dist/assets/*.js | sort -h
```

**Load Time Test**:
1. Open Chrome DevTools → Network tab
2. Throttle to "Fast 3G"
3. Hard reload (`Cmd+Shift+R`)
4. Verify page loads in < 3 seconds

## Deployment Options

### Option 1: Vercel (Recommended)

**Steps**:
1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your GitHub repository
5. Configure build settings:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
6. Click "Deploy"

**Environment Variables**: None required (browser-only app)

**Custom Domain** (optional):
1. Go to Project Settings → Domains
2. Add your domain
3. Follow DNS configuration instructions

### Option 2: Netlify

**Steps**:
1. Push code to GitHub
2. Go to [netlify.com](https://netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Select your GitHub repository
5. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
6. Click "Deploy site"

**Optional Configuration** (`netlify.toml`):
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Option 3: GitHub Pages

**Steps**:
1. Update `vite.config.ts`:
```typescript
export default defineConfig({
  base: '/your-repo-name/', // Replace with your repo name
  // ... rest of config
})
```

2. Build and deploy:
```bash
npm run build
cd dist
git init
git add -A
git commit -m "Deploy to GitHub Pages"
git push -f git@github.com:username/your-repo-name.git main:gh-pages
```

3. Enable GitHub Pages:
   - Go to repo Settings → Pages
   - Source: Deploy from branch
   - Branch: `gh-pages` → `/` (root)
   - Save

**Automated Deployment** (GitHub Actions):

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### Option 4: Custom Server (Nginx/Apache)

**Build**:
```bash
npm run build
```

**Nginx Configuration** (`/etc/nginx/sites-available/akselarcade`):
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/akselarcade/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    # Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "DENY";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "no-referrer";
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()";
}
```

**Deploy**:
```bash
# Copy build to server
scp -r dist/* user@server:/var/www/akselarcade/dist/

# Restart nginx
ssh user@server 'sudo systemctl reload nginx'
```

## Post-Deployment Verification

### 1. Smoke Tests

Visit your deployed URL and verify:

- [ ] Page loads without errors
- [ ] Default intro code renders correctly
- [ ] Can write and execute custom code
- [ ] Code editor has syntax highlighting
- [ ] Preview updates on code change
- [ ] Theme toggle works (light/dark)
- [ ] Viewport resize works
- [ ] Inspect mode highlights elements
- [ ] No console errors in DevTools

### 2. Security Tests

**CSP Verification**:
1. Open DevTools → Network
2. Check response headers for `Content-Security-Policy`
3. Verify no external scripts/styles loaded (except cdn.nav.no)

**Origin Validation**:
1. Open DevTools → Console
2. Type: `window.parent.postMessage({type: 'EXECUTE_CODE'}, '*')`
3. Expected: Message rejected with warning (origin mismatch)

**Source Map Check**:
```bash
# No .map files should be accessible
curl https://your-domain.com/assets/index-abc123.js.map
# Expected: 404 Not Found
```

### 3. Performance Tests

**PageSpeed Insights**:
1. Go to [pagespeed.web.dev](https://pagespeed.web.dev)
2. Enter your deployed URL
3. Target scores:
   - Performance: > 80
   - Accessibility: > 90
   - Best Practices: > 90
   - SEO: > 90

**WebPageTest** (optional):
1. Go to [webpagetest.org](https://webpagetest.org)
2. Run test from multiple locations
3. Verify load time < 3s on 3G

## Monitoring & Maintenance

### Analytics (Optional)

Add privacy-friendly analytics (e.g., Plausible, Fathom):

```html
<!-- Add to index.html before </head> -->
<script defer data-domain="your-domain.com" src="https://plausible.io/js/script.js"></script>
```

### Error Tracking (Optional)

Add error tracking (e.g., Sentry):

```typescript
// src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
});
```

### Update Dependencies

Regularly update dependencies for security patches:

```bash
# Check for outdated packages
npm outdated

# Update Aksel packages (important for bug fixes)
npm update @navikt/ds-react @navikt/ds-css @navikt/aksel-icons

# Update all dependencies
npm update
```

### Backup User Data

LocalStorage data is stored per-domain in user's browser. No server-side backup needed.

Users can export their code manually (feature to be implemented if needed).

## Rollback Procedure

If deployment fails or issues are discovered:

### Vercel/Netlify
1. Go to Deployments
2. Select previous working deployment
3. Click "Promote to Production"

### GitHub Pages
```bash
# Revert to previous commit
git revert HEAD
git push origin gh-pages
```

### Custom Server
```bash
# Restore from backup
ssh user@server 'cp -r /var/www/akselarcade/dist.backup/* /var/www/akselarcade/dist/'
ssh user@server 'sudo systemctl reload nginx'
```

## Troubleshooting

### Issue: White screen on deployment

**Cause**: Incorrect base path in Vite config

**Solution**:
```typescript
// vite.config.ts
export default defineConfig({
  base: '/', // For root domain
  // OR
  base: '/repo-name/', // For GitHub Pages
})
```

### Issue: Assets not loading (404 errors)

**Cause**: SPA routing not configured

**Solution**: Add redirect/rewrite rules (see deployment option above)

### Issue: CSP blocks resources

**Cause**: CSP too strict or environment detection failed

**Solution**: Check browser console for CSP violations, adjust `public/sandbox.html` CSP if needed

### Issue: Code execution fails

**Cause**: Babel or React not loading properly

**Solution**:
1. Check browser console for errors
2. Verify `public/sandbox.html` loads correctly
3. Check Network tab for failed resource loads

## Support

For deployment issues:
- Check GitHub Issues: [github.com/your-org/akselarcade/issues](https://github.com)
- Contact: maintainers@example.com (update with real contact)

---

**Last Updated**: 2025-11-17  
**Maintained by**: AkselArcade Team
