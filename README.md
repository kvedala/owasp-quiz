
# OWASP Quiz – Static Site

A fully static React quiz application that delivers **500+ pre-generated multiple-choice questions** from the **OWASP Cheat Sheet Series** and **Top‑10 mapping**. Runs serverless on **GitHub Pages** with client-side scoring and **PDF certificate generation**.

> **Content & License**  
> Questions are from the **OWASP Cheat Sheet Series** and **OWASP Top‑10** mapping. Content is licensed **CC BY‑SA 4.0**.  
> Sources:  
> • OWASP Cheat Sheet Series: https://cheatsheetseries.owasp.org  
> • OWASP Top‑10 → Cheat Sheets: https://cheatsheetseries.owasp.org/IndexTopTen.html

---

## Features

✅ **500+ Curated Questions** from OWASP Top 10 and General security topics  
✅ **Category-based Filtering** – Select which OWASP categories to test  
✅ **Client-Side Scoring** – 75% pass threshold  
✅ **Per-Category Breakdown** – See your score for each category  
✅ **Download PDF Certificate** – Generated in the browser  
✅ **No Backend Required** – Fully static, deploy anywhere  
✅ **GitHub Pages Ready** – Deploy for free  

---

## Quick Start

### Development

```bash
cd frontend
npm ci
npm run dev
# App opens at http://localhost:5173
```

Select categories, answer questions, submit, and download your certificate.

### Build for production

```bash
cd frontend
npm run build
# Static site in frontend/dist/
```

### Deploy to GitHub Pages

1. Push to GitHub with `frontend/dist/` built
2. Enable GitHub Pages in **Settings** → **Pages** → **Source: Deploy from branch** (or GitHub Actions)
3. Site available at `https://<username>.github.io/owasp-quiz/`

**For a custom domain**, update GitHub Pages settings after pushing.

---

## Project Structure

```
frontend/              # Static React site
├── public/            # Static assets
│   └── questions.json # Pre-generated 500+ questions
├── src/
│   ├── api.js         # Local data loaders (no backend)
│   ├── App.jsx        # Main app
│   ├── pages/         # Home, Quiz, Results pages
│   ├── utils/
│   │   └── pdfGenerator.js  # Client-side PDF cert generation
│   └── ...
├── package.json       # jsPDF + React dependencies
├── vite.config.js     # Vite config
└── dist/              # Built site (production)
.github/
├── workflows/         # CI/CD (optional)
└── ...
docs/                  # Documentation
README.md
```

---

## How It Works

1. **Quiz Loading**: `frontend/public/questions.json` is fetched on app load (included in build)
2. **Quiz Generation**: User selects categories → random sampling in-browser
3. **Scoring**: User submits answers → score computed locally (75% pass threshold)
4. **Certificate**: jsPDF generates a PDF in the browser, including:
   - Candidate name
   - Total score & percentage
   - Per-category breakdown
   - CC BY‑SA attribution
   - Download link (no network call)

---

## Data Format

`questions.json` contains:

```json
{
  "meta": { "title": "...", "license": "CC BY-SA 4.0", "source": "..." },
  "questions": [
    {
      "topic": "A01: Broken Access Control",
      "difficulty": "medium",
      "question": "Which is best practice for...",
      "options": ["A...", "B...", "C...", "D..."],
      "answer": 2,
      "explanation": "...",
      "tags": ["access-control", "authorization"],
      "source": "OWASP Link"
    },
    ...
  ]
}
```

---

## Local Development

### Add questions to `frontend/public/questions.json`

The JSON file is bundled into the static site during build. To update:

1. Replace or append to `frontend/public/questions.json`
2. Run `npm run build` in frontend/
3. Deploy

### Customize styling

Edit `frontend/src/App.jsx`, `frontend/src/pages/*.jsx` to adjust the look & feel.

---

## GitHub Actions CI/CD (Optional)

Create `.github/workflows/deploy.yml` to auto-build and deploy:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  build:
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

---

## License

**App code**: MIT  
**OWASP Content**: CC BY‑SA 4.0  
See attribution in the app UI and on generated certificates.

---

## Support

For questions or issues:
- 📖 [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org)
- 🐛 File an issue in this repository


---

## Production deploy (Let’s Encrypt)

With cert-manager + ClusterIssuer (`letsencrypt-prod`) using HTTP-01:

```powershell
./scripts/deploy-prod.ps1 -Namespace owasp-quiz `
  -AppHost quiz.opencompany.example `
  -IssuerKind ClusterIssuer `
  -IssuerName letsencrypt-prod `
  -IngressClass nginx `
  -CreateClusterIssuer `
  -Wait
```

See `docs/prod.md` for cert-manager setup and DNS notes.

---

## How it works

1. **Discovery**: The backend starts from the OWASP CSS home, finds the **Index (Alphabetical)**, and discovers official cheat sheet pages (`/cheatsheets/*.html`).  
2. **Top‑10 categories**: The backend scrapes **Index Top 10** to build the category list (A01–A10) and the cheat sheets mapped to each category.  
3. **Question bank**: Pre-generated questions are stored in a persistent volume (`/data/questionbank/questions.json`), eliminating real-time LLM calls for instant quiz serving.
4. **LLM enhancement (optional)**: When enabled, uses Ollama (llama3.2:1b by default) to generate scenario-based MCQs from OWASP content with multi-layer contamination filtering.
5. **Question generation**: Extracts bullet‑point facts from selected cheat sheets to build MCQs (1 correct + 3 distractors), tagging each question with its **category**.  
6. **Scoring**: Overall pass requires `score ≥ ceil(0.75 × total)`. Results include a **per‑category** breakdown.  
7. **Certificate**: Generates a PDF with user details, score, and a category table, with **CC BY‑SA 4.0 attribution**.

References:  
• OWASP Cheat Sheet Series home (license): https://cheatsheetseries.owasp.org  
• OWASP Top‑10 index and mappings: https://cheatsheetseries.owasp.org/IndexTopTen.html

---

## Cloud LLM (no local Ollama)

You can use a free/low-cost OpenAI-compatible provider (e.g., OpenRouter) instead of running a local LLM. The backend already understands `QUIZ_LLM_PROVIDER=openai` and will use a Chat Completions API to enhance stems and to generate bank questions when the generator is used.

Helm values example:

```yaml
cloudLlm:
  enabled: true
  provider: openai
  # OpenRouter example (pairs with "/v1" internally → https://openrouter.ai/api/v1)
  endpoint: https://openrouter.ai/api
  model: mistralai/mistral-7b-instruct
  apiKeySecretName: openrouter-api
  apiKeySecretKey: apiKey

# Disable local Ollama
llm:
  enabled: false
```

Create the secret:

```bash
kubectl -n owasp-quiz create secret generic openrouter-api \
  --from-literal=apiKey=YOUR_OPENROUTER_API_KEY
```

Notes:
- For live runtime stems, the backend reads `QUIZ_LLM_PROVIDER`, `QUIZ_LLM_MODEL`, `QUIZ_LLM_ENDPOINT`, `QUIZ_LLM_API_KEY`.
- For question bank generation Jobs/CronJobs, enabling `cloudLlm.enabled` injects the same env vars so the generator uses the cloud API.
- Tested with OpenAI-compatible providers. For OpenRouter, set `endpoint: https://openrouter.ai/api` and a supported model name.

---

## Configuration notes

- **Question bank**: Persistent volume stores pre-generated questions for instant serving. CronJob disabled by default in local dev; use `-EnableRefreshCron` to enable automatic regeneration every 30 minutes.
- **LLM integration**: Use either a local Ollama deployment or a cloud OpenAI-compatible provider. For local, the default is `llama3.2:1b`. For cloud, configure `cloudLlm` values as above.
- **Performance tuning**: Content truncated to 900 chars, num_predict limited to 120 tokens, 3 questions per sheet for fast local generation.
- **Single host routing**: The Helm Ingress routes `/api` → backend and `/` → frontend. No client‑side `VITE_API_BASE` is required.  
- **Caching**: The backend caches the OWASP index and Top‑10 categories for 6 hours.
- **Politeness**: Requests include a User‑Agent and a small delay when retrieving pages.
- **Attribution**: The UI header and certificate include attribution per **CC BY‑SA 4.0**.
 - **HTTPS redirect**: NGINX Ingress enforces HTTPS‑only via `nginx.ingress.kubernetes.io/force-ssl-redirect: "true"`.
 - **Local self‑signed backends**: Local values disable upstream TLS verification for HTTPS pods via `nginx.ingress.kubernetes.io/proxy-ssl-verify: "false"`.

---

## Security & hardening ideas

- Add rate limiting and TLS (via cert‑manager) on the Ingress.
- Persist attempts (and user info) to Postgres; add SSO (Azure AD) for enterprise use.
- Nightly job to pre‑build question banks to reduce on‑demand scraping.

---

## Troubleshooting

- **Excess refresh pods**: CronJob is disabled by default in local dev. If you see many `refresh-questions` pods, run `kubectl -n owasp-quiz delete cronjob owasp-quiz-refresh-questions` and let the script clean them up on next run.
- **Slow question generation**: Local LLM (llama3.2:1b) can take 60-90s per sheet. Generation runs asynchronously via Jobs; check logs with `kubectl -n owasp-quiz logs -l job-name=owasp-quiz-generate-questions`.
- **Contaminated questions**: Multi-layer filters remove navigation artifacts, but edge cases may slip through. Check `/data/questionbank/questions.json` and report patterns.
- If questions fail to generate, OWASP page structure may have changed. Update the selectors in `internal/scraper/*`.
- Ensure the cluster can reach `https://cheatsheetseries.owasp.org` over the internet.
 - If the Ingress returns 502 locally, ensure the NGINX annotations include `proxy-ssl-verify: "false"` to trust self‑signed backend/frontend pods.

---

## License

This repository’s code is provided under your organization’s chosen license (add one).  
**OWASP Cheat Sheet Series content** remains under **CC BY‑SA 4.0**; see the site for details: https://cheatsheetseries.owasp.org
