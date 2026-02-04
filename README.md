# OWASP Quiz – Static Site

A fully static React quiz application that delivers **500+ unique curated multiple-choice questions** from the **OWASP Cheat Sheet Series** and **Top‑10 mapping**. Runs serverless on **Bitbucket Pages** or **GitHub Pages** with client-side scoring, PDF certificate generation, and security-hardened CSP headers.

> **Content & License**  
> Questions are from the **OWASP Cheat Sheet Series** and **OWASP Top‑10** mapping. Content is licensed **CC BY‑SA 4.0**.  
> Sources:  
> • OWASP Cheat Sheet Series: https://cheatsheetseries.owasp.org  
> • OWASP Top‑10 → Cheat Sheets: https://cheatsheetseries.owasp.org/IndexTopTen.html

---

## Features

✅ **500+ Unique Curated Questions** with automatic deduplication – no duplicate questions in a quiz  
✅ **Category-based Filtering** – Select which OWASP categories to test  
✅ **Randomized Questions** – Shuffled order on every quiz generation  
✅ **Client-Side Scoring** – 75% pass threshold (≥15/20 correct)  
✅ **Per-Category Breakdown** – See your score for each OWASP category  
✅ **Download PDF Certificate** – Generated in the browser with environment metadata  
✅ **Security Hardened** – CSP and security headers configured in Vite  
✅ **Pure Static Site** – No backend, no server required. Deploy to any static hosting (GitHub Pages, Bitbucket Pages, Netlify, Vercel, S3, CDN, etc.)  

---

## Quick Start

### Development

```bash
cd frontend
npm ci
npm run dev
# App opens at http://localhost:5173
```

1. Enter candidate information (name, email, job title, department)
2. Select OWASP categories or leave all selected for the full question bank
3. Answer 20 randomly shuffled, deduplicated questions
4. View results with per-category score breakdown
5. Optionally include location in certificate and download as PDF

### Build for production

```bash
cd frontend
npm run build
# Static site output in frontend/dist/
```

### Deploy to Bitbucket Pages

1. Push to Bitbucket repository
2. Enable Bitbucket Pages in **Repository settings** → **Pages**
3. Set deployment branch and folder (`dist/`)
4. Site available at `https://<workspace>.bitbucket.io/<repository>/`

**For GitHub Pages**, follow similar steps in **Settings** → **Pages**.

---

## Project Structure

```
frontend/                      # Static React app (Vite)
├── src/
│   ├── api.js                # Question bank loader & quiz generator (with deduplication)
│   ├── App.jsx               # Main app layout
│   ├── main.jsx              # Entry point
│   ├── styles.css            # Global styles (CSP-compliant, no inline)
│   ├── pages/
│   │   ├── Home.jsx          # Candidate info & category selection
│   │   ├── Quiz.jsx          # Quiz interface with live progress tracking
│   │   └── Results.jsx       # Results, scoring, certificate download
│   ├── context/
│   │   └── MetadataContext.jsx
│   ├── hooks/
│   │   └── useMetadata.js
│   ├── utils/
│   │   └── pdfGenerator.js   # Client-side PDF cert generation
│   └── data/
│       ├── questionBank.js   # Question bank importer
│       └── questions.json    # Pre-generated questions (bundled into JS)
├── public/                   # Static assets
│   └── questions.json        # Source file (bundled at build time)
├── index.html                # Entry HTML with CSP meta tag
├── vite.config.js            # Vite config with security plugin
├── SECURITY.md               # Detailed security documentation
├── package.json              # jsPDF + React dependencies
└── dist/                      # Production build (static files ready to deploy)
README.md
```

---

## How It Works

### Quiz Flow

1. **Question Loading**: `frontend/src/data/questions.json` is imported and bundled into the compiled JavaScript at build time (not served as a separate network request)
2. **Quiz Generation**: 
   - User selects categories (or uses all)
   - App deduplicates questions by question text
   - Shuffles and returns first 20 unique questions
3. **Scoring**: User submits answers → score computed locally (75% pass = ≥15/20 correct)
4. **Certificate**: jsPDF generates PDF in the browser, including:
   - Candidate name, test date (local & UTC)
   - Total score & percentage
   - Per-category breakdown
   - Timezone & browser/device info
   - Optional location (requires user consent)
   - CC BY‑SA attribution
   - No network call required

### Deduplication

Questions are automatically deduplicated by exact question text during quiz generation. If the same question appears multiple times in `questions.json` (e.g., across different category mappings), only the first occurrence is included in the quiz.

### Security

Security features include:
- **Content Security Policy (CSP)** - Prevents XSS and data injection attacks
- **Security Headers** - X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- **Build Security** - Source maps disabled, content hashing for integrity
- **Privacy** - Geolocation optional and consent-based

Security headers are configured in the Vite dev server. For production deployments, configure headers at your hosting platform or CDN level.

📄 **For comprehensive security documentation, see [SECURITY.md](SECURITY.md)**

---

## Environment Details on Certificates

When downloading a certificate, the following details are automatically included:

**Always included:**
- Candidate name
- Test date (local time & UTC)
- Timezone
- Browser/Device info (User-Agent)
- Score & percentage
- Per-category breakdown
- OWASP attribution

**Optional (with consent):**
- Approximate location (latitude, longitude, accuracy)
- Only requested if user explicitly checks the consent checkbox
- Can be denied without affecting certificate generation

---

## Data Format

`questions.json` contains:

```json
{
  "meta": {
    "title": "OWASP Top 10:2025 Question Bank",
    "license": "CC BY-SA 4.0",
    "sources": {
      "A01": "https://owasp.org/Top10/2025/A01_2025-Broken_Access_Control/",
      ...
    }
  },
  "questions": [
    {
      "topic": "A01: Broken Access Control",
      "difficulty": "Easy",
      "question": "Which control is MOST effective...?",
      "options": ["A...", "B...", "C...", "D..."],
      "answer": 0,
      "explanation": "OWASP A01 prioritizes...",
      "tags": ["access-control", "authorization"],
      "source": "https://owasp.org/...",
      "cwes": ["CWE-200"],
      "cwe_names": ["Exposure of Sensitive Information..."]
    },
    ...
  ]
}
```

---

## Local Development

### Update questions

1. Replace `frontend/public/questions.json` with new data
2. Copy to `frontend/src/data/questions.json`
3. Run `npm run build`
4. Deploy

### Customize styling

All app styles are in [frontend/src/styles.css](frontend/src/styles.css). No inline `style={{}}` props in components (for CSP compliance).

### Test security headers

Use online tools to verify security configuration:
- [Mozilla Observatory](https://observatory.mozilla.org/)
- [Security Headers](https://securityheaders.com/)

Or test locally during development:
```bash
npm run dev
curl -I http://localhost:5173/
```

---

## Deployment

This is a **pure static site** - the build output in `frontend/dist/` contains only HTML, CSS, and JavaScript files. Deploy to **any** static hosting platform:

### GitHub Pages

```bash
cd frontend
npm run build
# Commit frontend/dist/ or set up GitHub Actions
```

GitHub Actions workflow (`.github/workflows/deploy.yml`):

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd frontend && npm ci && npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./frontend/dist
```

### Bitbucket Pages

Create/update `bitbucket-pipelines.yml`:

```yaml
image: node:18

pipelines:
  branches:
    main:
      - step:
          name: Build and Deploy
          script:
            - cd frontend
            - npm ci
            - npm run build
          artifacts:
            - frontend/dist/**
```

Bitbucket automatically deploys artifacts to your Pages folder.

### Other Static Hosting Platforms

After running `npm run build`, simply upload the `frontend/dist/` folder to:

- **Netlify**: Drag & drop `dist/` folder or connect Git repo
- **Vercel**: `vercel --prod` in frontend directory
- **Cloudflare Pages**: Connect Git repo or upload via dashboard
- **AWS S3 + CloudFront**: Upload to S3 bucket, serve via CloudFront
- **Azure Static Web Apps**: Deploy via Azure CLI or GitHub Actions
- **Firebase Hosting**: `firebase deploy` after init
- **Any web server**: Upload `dist/` contents to public HTML directory

No special configuration required - it's just static files!

---

## Troubleshooting

**Q: Duplicate questions appearing in the quiz?**  
A: The app automatically deduplicates by question text. If duplicates persist, ensure `frontend/src/data/questions.json` was updated and the build reran.

**Q: "Assets in public directory cannot be imported" error?**  
A: Vite doesn't allow JavaScript imports from `public/`. Questions must be in `frontend/src/data/questions.json`. Copy from `public/` if updating.

**Q: CSP errors in browser console?**  
A: The CSP is configured in [frontend/vite.config.js](frontend/vite.config.js). If you need to adjust policies, modify the `cspDirectives` array. Note: `'unsafe-inline'` is required for React's inline styles.

**Q: How to add security headers on my hosting platform?**  
A: See [SECURITY.md](SECURITY.md) for recommended headers and platform-specific configuration. For Docker deployment with NGINX, see [DOCKER.md](DOCKER.md).

**Q: Certificate not downloading?**  
A: Check browser console for errors. If geolocation is enabled, try unchecking location consent and try again.

---

## License

**Application Code**: MIT License (see [LICENSE.md](LICENSE.md))  
**OWASP Content**: CC BY‑SA 4.0  

All questions are derived from the OWASP Cheat Sheet Series and OWASP Top 10, licensed under CC BY‑SA 4.0. Attribution is included in the app UI and on generated certificates.

---

## References

- 📖 [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org)
- 🔝 [OWASP Top 10 (2025)](https://owasp.org/Top10/)
- 🏗️ [Vite Documentation](https://vitejs.dev)
- 📄 [jsPDF for certificate generation](https://github.com/parallax/jsPDF)
- 🔒 [Security Documentation](SECURITY.md)
- 🐳 [Docker Deployment Guide](DOCKER.md)
