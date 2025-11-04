
# OWASP Cheat Sheet Series – Q&A Portal

A React + Go web portal that dynamically generates multiple‑choice questions from the official **OWASP Cheat Sheet Series**, supports **user info capture**, **OWASP Top‑10 category selection**, **per‑category scoring**, a **> 75% pass threshold**, and generates a **PDF certificate** with attribution.

> **Content & License**  
> Questions are generated at runtime from the **OWASP Cheat Sheet Series** website and its **Top‑10 mapping**. The content is licensed **CC BY‑SA 4.0**; this app displays attribution in the UI and on the certificate.  
> Sources:  
> • OWASP Cheat Sheet Series home (license notice): https://cheatsheetseries.owasp.org  
> • OWASP Top‑10 → Cheat Sheets mapping: https://cheatsheetseries.owasp.org/IndexTopTen.html

---

## Kubernetes quick start

Local HTTPS via NGINX Ingress (uses the controller's default fake cert):

```powershell
./scripts/setup-local.ps1
```

URLs:
- https://quiz.localhost
- https://komodo.localhost

For details, see `docs/local-k8s.md`.

---

## Quick start (local dev)

### Backend (Go)
```bash
cd backend
go run ./main.go
# server on http://localhost:8080
```

### Frontend (Vite + React)
```bash
cd frontend
npm ci
npm run dev
# app on http://localhost:5173 (expects backend at http://localhost:8080 via /api proxy or CORS)
```

---

## Docker images

```bash
# build
docker build -t ghcr.io/your-org/owasp-quiz-backend:latest ./backend
docker build -t ghcr.io/your-org/owasp-quiz-frontend:latest ./frontend

# push
docker push ghcr.io/your-org/owasp-quiz-backend:latest
docker push ghcr.io/your-org/owasp-quiz-frontend:latest
```

---

## Deploy with Helm

> The Helm chart exposes **one hostname** and routes `/api` to the backend and `/` to the frontend, avoiding CORS.

### 1) Set values
Create a `my-values.yaml`:

```yaml
namespace: owasp-quiz
image:
  backend: ghcr.io/your-org/owasp-quiz-backend:latest
  frontend: ghcr.io/your-org/owasp-quiz-frontend:latest
ingress:
  enabled: true
  className: nginx
  host: quiz.example.com
  tls:
    enabled: true
    secretName: quiz-tls
```

### 2) Install
```bash
helm upgrade --install owasp-quiz ./helm/owasp-quiz -f my-values.yaml
```

> After DNS points to your Ingress, open `https://quiz.example.com`.

---

## Production deploy (Let’s Encrypt)

With cert-manager + ClusterIssuer (`letsencrypt-prod`) using HTTP-01:

```powershell
./scripts/deploy-prod.ps1 -Namespace owasp-quiz `
  -AppHost quiz.opencompany.example `
  -KomodoHost komodo.quiz.opencompany.example `
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
3. **Question generation**: It extracts bullet‑point facts from selected cheat sheets to build MCQs (1 correct + 3 distractors), tagging each question with its **category**.  
4. **Scoring**: Overall pass requires `score ≥ ceil(0.75 × total)`. Results include a **per‑category** breakdown.  
5. **Certificate**: Generates a PDF with user details, score, and a category table, with **CC BY‑SA 4.0 attribution**.

References:  
• OWASP Cheat Sheet Series home (license): https://cheatsheetseries.owasp.org  
• OWASP Top‑10 index and mappings: https://cheatsheetseries.owasp.org/IndexTopTen.html

---

## Configuration notes

- **Single host routing**: The Helm Ingress routes `/api` → backend and `/` → frontend. No client‑side `VITE_API_BASE` is required.  
- **Caching**: The backend caches the OWASP index and Top‑10 categories for 6 hours.
- **Politeness**: Requests include a User‑Agent and a small delay when retrieving pages.
- **Attribution**: The UI header and certificate include attribution per **CC BY‑SA 4.0**.

---

## Security & hardening ideas

- Add rate limiting and TLS (via cert‑manager) on the Ingress.
- Persist attempts (and user info) to Postgres; add SSO (Azure AD) for enterprise use.
- Nightly job to pre‑build question banks to reduce on‑demand scraping.

---

## Troubleshooting

- If questions fail to generate, OWASP page structure may have changed. Update the selectors in `internal/scraper/*`.
- Ensure the cluster can reach `https://cheatsheetseries.owasp.org` over the internet.

---

## License

This repository’s code is provided under your organization’s chosen license (add one).  
**OWASP Cheat Sheet Series content** remains under **CC BY‑SA 4.0**; see the site for details: https://cheatsheetseries.owasp.org
