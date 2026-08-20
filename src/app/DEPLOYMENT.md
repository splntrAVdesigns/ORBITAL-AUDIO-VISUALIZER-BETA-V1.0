# 🚀 DEPLOYMENT GUIDE

Complete deployment instructions for ORBITAL Audio-Reactive Visualizer Engine.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Vercel Deployment (Recommended)](#vercel-deployment-recommended)
3. [Netlify Deployment](#netlify-deployment)
4. [GitHub Pages Deployment](#github-pages-deployment)
5. [Custom Server Deployment](#custom-server-deployment)
6. [Environment Configuration](#environment-configuration)
7. [Post-Deployment Checklist](#post-deployment-checklist)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

✅ **Node.js 18+** installed  
✅ **Git** installed  
✅ **GitHub account** (for Vercel/Netlify)  
✅ **Project built locally** (`npm run build` successful)  
✅ **All dependencies installed** (`npm install` complete)  

---

## Vercel Deployment (Recommended)

Vercel provides the best experience for Vite + React applications with zero-config deployment.

### Method 1: Vercel CLI (Fastest)

```bash
# Install Vercel CLI globally
npm install -g vercel

# Navigate to project directory
cd orbital-visualizer

# Login to Vercel (opens browser)
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

**First deployment will ask:**
- Project name: `orbital-visualizer` (or your preferred name)
- Framework: `Vite` (should auto-detect)
- Build command: `npm run build` (default)
- Output directory: `dist` (default)
- Development command: `npm run dev` (default)

### Method 2: Vercel Dashboard (UI)

1. **Go to:** [vercel.com/new](https://vercel.com/new)
2. **Import Git Repository:**
   - Click "Import Project"
   - Select GitHub
   - Authorize Vercel to access your repos
   - Select `orbital-visualizer` repository
3. **Configure Project:**
   - Framework Preset: `Vite`
   - Root Directory: `./` (leave default)
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
4. **Environment Variables:** (none required for basic deployment)
5. **Click "Deploy"**

**Deployment takes ~2-3 minutes.**

### Vercel Configuration File

Create `/vercel.json` for advanced configuration:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        },
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "require-corp"
        }
      ]
    }
  ]
}
```

**Note:** ORBITAL is a single-page app — the existing `/vercel.json` includes a catch-all rewrite to `index.html` so client-side routing works correctly on refresh/deep-link.

---

## Netlify Deployment

Netlify is another excellent option for static site hosting.

### Method 1: Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize site
netlify init

# Build and deploy
netlify deploy --prod
```

### Method 2: Netlify Dashboard

1. **Go to:** [app.netlify.com/start](https://app.netlify.com/start)
2. **Connect Git Repository:**
   - Click "Add new site"
   - Choose "Import from Git"
   - Select GitHub and authorize
   - Select `orbital-visualizer` repository
3. **Build Settings:**
   - Branch: `main`
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: (leave empty)
4. **Click "Deploy site"**

### Netlify Configuration File

Create `/netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Opener-Policy = "same-origin"
    Cross-Origin-Embedder-Policy = "require-corp"
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
```

---

## GitHub Pages Deployment

GitHub Pages is free but requires additional configuration for React Router.

### Setup

1. **Install gh-pages package:**

```bash
npm install --save-dev gh-pages
```

2. **Update `package.json`:**

```json
{
  "homepage": "https://yourusername.github.io/orbital-visualizer",
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  }
}
```

3. **Update `vite.config.ts`:**

```typescript
export default defineConfig({
  base: '/orbital-visualizer/',
  // ... rest of config
});
```

4. **Deploy:**

```bash
npm run deploy
```

5. **Enable GitHub Pages:**
   - Go to repository → Settings → Pages
   - Source: `gh-pages` branch
   - Click "Save"

**Note:** GitHub Pages doesn't support server-side routing well. Since ORBITAL is a single-page app, you may need to use hash routing to avoid 404s on refresh.

---

## Custom Server Deployment

Deploy to your own server with Node.js.

### Using Serve (Simple Static Server)

```bash
# Build project
npm run build

# Install serve globally
npm install -g serve

# Serve the dist folder
serve -s dist -l 3000
```

### Using Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/orbital/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Enable GZIP compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Using Apache

Create `.htaccess` in `dist/`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

# Enable GZIP
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/css application/json application/javascript text/xml application/xml
</IfModule>

# Cache Control
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
</IfModule>
```

---

## Environment Configuration

ORBITAL doesn't require environment variables for basic deployment, but you can add optional configurations:

### Optional Environment Variables

Create `.env.production`:

```env
# Analytics (optional)
VITE_ANALYTICS_ID=your-google-analytics-id

# API Endpoints (if you add backend features)
VITE_API_URL=https://api.your-domain.com

# Feature Flags
VITE_ENABLE_RECORDING=true
VITE_ENABLE_MIDI=true
```

Access in code:

```typescript
const analyticsId = import.meta.env.VITE_ANALYTICS_ID;
```

---

## Post-Deployment Checklist

After deploying, verify:

### ✅ Functional Testing

- [ ] Landing page loads correctly
- [ ] "LAUNCH ORBITAL" button works
- [ ] Microphone input works (requires HTTPS)
- [ ] File upload works
- [ ] Demo tracks play
- [ ] All 4 visualization modes render
- [ ] Macro knobs control parameters
- [ ] Preset loading works
- [ ] Recording works at each resolution/codec option
- [ ] MIDI detection works (if device connected)
- [ ] Center image upload works
- [ ] Fullscreen mode works
- [ ] Keyboard shortcuts work

### ✅ Performance Testing

- [ ] FPS stays above 50 (enable Performance HUD in Session Settings to monitor)
- [ ] No console errors
- [ ] No memory leaks (check DevTools Memory tab)
- [ ] Audio sync is accurate (no lag)
- [ ] Recording outputs clean video

### ✅ Browser Compatibility

Test in:
- [ ] Chrome (recommended)
- [ ] Firefox (recommended)
- [ ] Edge
- [ ] Safari (limited MediaRecorder support)
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

### ✅ Security

- [ ] HTTPS enabled (required for microphone access)
- [ ] No exposed API keys
- [ ] No console warnings about mixed content
- [ ] CSP headers configured (if needed)

---

## Updating Existing Deployment

### Update Vercel Deployment

```bash
# Pull latest changes
git pull origin main

# Build locally to test
npm run build

# Deploy to preview
vercel

# Deploy to production (after testing)
vercel --prod
```

**Or use Git integration:**
- Push to `main` branch → Auto-deploys to production
- Push to other branch → Auto-deploys to preview URL

### Update Netlify Deployment

```bash
# Pull latest changes
git pull origin main

# Deploy
netlify deploy --prod
```

**Or use Git integration:**
- Push to `main` branch → Auto-deploys

### Update GitHub Pages

```bash
# Pull latest changes
git pull origin main

# Rebuild and deploy
npm run deploy
```

---

## Troubleshooting

### Issue: Blank page after deployment

**Cause:** Incorrect base path or routing issue

**Solution:**
1. Check `vite.config.ts` base path matches deployment URL
2. Verify `dist/index.html` exists after build
3. Check browser console for 404 errors
4. Ensure server is configured for SPA routing

---

### Issue: Microphone not working

**Cause:** Not served over HTTPS

**Solution:**
- Use HTTPS (required for `getUserMedia()`)
- Vercel/Netlify provide HTTPS by default
- For custom server, set up SSL certificate (Let's Encrypt)

---

### Issue: Recording not downloading

**Cause:** Browser doesn't support codec

**Solution:**
- Use Chrome/Firefox (best support)
- Check codec fallback in code (VP9 → VP8 → H264)
- Check console for MediaRecorder errors

---

### Issue: Large bundle size

**Cause:** Unoptimized build

**Solution:**
```bash
# Analyze bundle
npm run build -- --mode analyze

# Check for large dependencies
npm install -g webpack-bundle-analyzer
```

**Optimization tips:**
- Remove unused dependencies
- Use dynamic imports for heavy features
- Enable code splitting in Vite config

---

### Issue: Slow initial load

**Cause:** Large asset files

**Solution:**
- Compress images (use WebP format)
- Enable GZIP/Brotli on server
- Use lazy loading for components
- Add loading spinner on landing page

---

## Performance Optimization

### Enable Compression (Vercel/Netlify)

Both platforms enable compression by default, but verify:

**Vercel:** Automatic Brotli compression  
**Netlify:** Automatic GZIP compression  

### CDN Configuration

Both Vercel and Netlify use global CDNs automatically.

For custom servers:
- Use Cloudflare (free tier available)
- Configure cache headers for static assets
- Enable GZIP/Brotli compression

### Asset Optimization

```bash
# Optimize images before deployment
npm install -g imagemin-cli

# Compress PNGs
imagemin public/*.png --out-dir=public

# Or use online tools:
# - TinyPNG.com
# - Squoosh.app
```

---

## Analytics Integration (Optional)

### Google Analytics 4

1. **Create GA4 property**
2. **Add to `index.html`:**

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### Plausible Analytics (Privacy-friendly)

```html
<script defer data-domain="yourdomain.com" src="https://plausible.io/js/script.js"></script>
```

---

## Custom Domain Setup

### Vercel

1. Go to Project → Settings → Domains
2. Add your domain (e.g., `orbital.app`)
3. Configure DNS:
   - A Record: `76.76.21.21`
   - CNAME: `cname.vercel-dns.com`
4. Wait for DNS propagation (~24 hours)

### Netlify

1. Go to Site → Domain Settings → Add custom domain
2. Configure DNS:
   - A Record: (Netlify IP from dashboard)
   - CNAME: `yoursitename.netlify.app`

---

## Monitoring & Logging

### Vercel

- **Analytics:** Built-in (free for hobbyists)
- **Logs:** Real-time function logs in dashboard
- **Performance:** Web Vitals tracking

### Netlify

- **Analytics:** Paid add-on
- **Logs:** Build logs in dashboard
- **Performance:** Forms & Functions insights

### Sentry (Error Tracking)

```bash
npm install @sentry/react @sentry/vite-plugin
```

Add to `main.tsx`:

```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "your-sentry-dsn",
  integrations: [new Sentry.BrowserTracing()],
  tracesSampleRate: 1.0,
});
```

---

## Backup & Recovery

### Vercel/Netlify

- **Automatic:** Every deployment is preserved
- **Rollback:** Click "Rollback to this deployment" in dashboard
- **Download:** Export deployment files from dashboard

### Manual Backup

```bash
# Create backup of dist folder
tar -czf orbital-backup-$(date +%Y%m%d).tar.gz dist/

# Upload to cloud storage
# - AWS S3
# - Google Cloud Storage
# - Dropbox
```

---

## CI/CD Setup (Advanced)

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run build
      - run: npm run test (if you have tests)
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID}}
          vercel-project-id: ${{ secrets.PROJECT_ID}}
```

---

## Next Steps After Deployment

1. ✅ Update README.md with live demo URL
2. ✅ Share on social media
3. ✅ Submit to directories (Product Hunt, etc.)
4. ✅ Monitor analytics and user feedback
5. ✅ Iterate based on user needs

---

## Support

If you encounter deployment issues:

1. **Check Logs:** Vercel/Netlify dashboard → Deployments → Failed build
2. **GitHub Issues:** [Create an issue](https://github.com/yourusername/orbital-visualizer/issues)
3. **Community:** [Discussions](https://github.com/yourusername/orbital-visualizer/discussions)

---

**Happy Deploying! 🚀**

**Built with Vercel? Add the badge to README:**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/orbital-visualizer)