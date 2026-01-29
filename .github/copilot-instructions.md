# Copilot Instructions for OWASP Quiz

Use these notes to be productive immediately. Keep edits small and follow existing patterns.

## Architecture

**Backend** (Go, `backend/`): Provides `/api/*` endpoints for quiz generation, scoring, and PDF certificates. Scrapes OWASP Cheat Sheet Series at runtime.
- **Go module**: `opencompany/owasp-quiz/backend`
- **Key endpoints**:
  - `GET /api/categories` — OWASP Top‑10 categories
  - `GET /api/topics` — Alphabetical cheat sheet index
  - `GET /api/generate-quiz?count=5..50&seed=&categories=` — Generate quiz (MCQs)
  - `POST /api/submit` — Submit answers, get score + attempt ID
  - `GET /api/certificate?attempt_id=` — Download PDF certificate
- **Middleware stack** (`backend/main.go`):
  - CORS: allow-list via `ALLOWED_ORIGINS` env var
  - Security headers: CSP, X-Frame-Options, etc.
  - Rate limiting: 60 requests/minute per IP (in-memory map)
  - Health check: `GET /healthz`
- **Internal packages**:
  - `internal/scraper/`: Fetches OWASP CSS pages; polite UA + small delay; caches index + Top‑10 for 6h
  - `internal/quiz/generator.go`: Builds MCQs from bullet facts (1 correct + 3 distractors); caps at 20 facts/source, 25 questions/bundle
  - `internal/cert/cert.go`: Generates A4 PDF with score, per-category table, and CC BY‑SA 4.0 attribution
- **State management**:
  - Attempts stored in-memory (`map[string]Attempt`); purged after 24h
  - Caching: OWASP index + Top‑10 cached 6h (in-proc). Pass threshold ≥ 75%
  - Emails NOT persisted (privacy); only name/job/department stored
- **HTTPS**: Serves on port 8443 with self-signed cert (see `TLS_CERT` / `TLS_KEY` env vars; `backend/Dockerfile` generates cert in `/app/certs/`)

**Frontend** (React + Vite, `frontend/`): SPA flow: Home → Quiz → Results.
- **API calls**: Use relative `/api` by default (works via Ingress path routing). Set `VITE_API_BASE` only when running backend separately.
- **Build**: `npm run build` → static assets in `dist/`
- **Serving**: NGINX on port 443 with self-signed cert (`frontend/Dockerfile` generates it); health endpoint at `/health`
 - **Favicon**: Inline URL-encoded SVG embedded in `index.html` to avoid `/favicon.ico` 404s.

## Deployment

**Helm chart** (`helm/owasp-quiz/`): Single-host deployment; path-based routing: `/api` → backend, `/` → frontend.
- **Ingress**: Controller-agnostic. Set `ingress.className` (e.g., `caddy`, `nginx`) and `ingress.annotations` per controller.
- **Health probes**:
  - Backend: `GET /healthz` on port 8443 (HTTPS)
  - Frontend: `GET /health` on port 443 (HTTPS)
- **Security**: End-to-end encryption — both services use HTTPS internally with self-signed certs; Ingress does TLS termination for external traffic.
 - **HTTPS redirect**: For NGINX, enforce HTTPS-only via `nginx.ingress.kubernetes.io/force-ssl-redirect: "true"`. When targeting self-signed HTTPS pods locally, disable upstream TLS verification with `nginx.ingress.kubernetes.io/proxy-ssl-verify: "false"`.

**Values files**:
- **Local dev**: `values.local-docker-desktop.yaml` (hosts: `*.localhost`, NGINX Ingress with HTTPS-only redirect; skips upstream TLS verify for self-signed backends)
- **Production**: `values.yaml` (default; set `ingress.className=nginx`, add cert‑manager annotations + `tls.secretName`, and `nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"` for backend/frontend)
- **Production (alternate)**: `values.prod.yaml` (customized for production deployment)

**Optional management UIs**:
- None currently configured (Kubernetes Dashboard removed).

## Dev workflows

**Fast path** (Kubernetes):
```powershell
\.\scripts\setup-local.ps1 [-RecreateCluster]
```
- Works with any existing Kubernetes cluster (Docker Desktop, kind, minikube)
- Installs NGINX Ingress, deploys chart, enables Dashboard ingress, waits for rollouts
- On Docker Desktop: builds images locally (`docker build`)
- On other clusters: uses GitHub Container Registry images

**Manual dev** (local without Kubernetes):
```bash
# Backend
cd backend
go run ./main.go
# Serves HTTP on localhost:8080 by default
# Set TLS_CERT and TLS_KEY env vars for HTTPS

# Frontend
cd frontend
npm ci
npm run dev
# http://localhost:5173
# Set VITE_API_BASE=http://localhost:8080 if not behind Ingress
```

**Docker images**:
- `backend/Dockerfile`: Multi-stage build (golang:1-alpine → alpine:latest); generates self-signed cert; nonroot user
- `frontend/Dockerfile`: npm build → nginx:alpine; generates self-signed cert; custom `nginx.conf` with `/health` endpoint

**More docs**: `docs/local-k8s.md`, `docs/caddy.md`, `docs/portainer.md`

## Conventions

- **JSON stability**: Keep Go struct field names and `json` tags stable; all responses must be serializable
- **Input validation** (`backend/main.go`):
  - Name: required, 1–100 chars, letters/spaces/hyphens only
  - Email: optional, standard format, NOT persisted for privacy
  - Job/Department: optional, 1–200 chars, alphanumeric + punctuation
  - All inputs HTML-escaped via `html.EscapeString()`
- **Scraper politeness** (`internal/scraper/`):
  - Custom User-Agent: `"OWASP-Quiz-Bot/1.0 (+https://example.org)"`
  - Small delay between requests (if iterating)
  - Only scrapes `/cheatsheets/*.html` paths
  - Caching (6h) to avoid hammering OWASP site
  - If questions fail, check OWASP page structure changed → update selectors
  - Accepts both absolute (`/cheatsheets/...`) and relative (`cheatsheets/...`) links when crawling.
  - Normalizes scraped text via `cleanText` to remove zero-width/nbsp/BOM and stray punctuation; applied to titles, category names, and facts.
- **License/attribution**: Always retain **CC BY‑SA 4.0** attribution in UI and PDF certificate (OWASP content requirement)
- **Security**: Both services use HTTPS internally; validate UUIDs; rate-limit endpoints; purge old attempts

## Cloud LLM vs Local LLM

- Runtime stems: Enable by setting env vars in the backend pod:
  - `QUIZ_LLM_PROVIDER=openai`
  - `QUIZ_LLM_MODEL` (e.g., `mistralai/mistral-7b-instruct` on OpenRouter)
  - `QUIZ_LLM_ENDPOINT` (e.g., `https://openrouter.ai/api`)
  - `QUIZ_LLM_API_KEY` (inject via Kubernetes Secret)
- Question bank generation: The Job/CronJob respects `cloudLlm.enabled` Helm values to inject the same envs and call the OpenAI-compatible API directly (no ephemeral Ollama).
- Local LLM: Keep `llm.enabled=true` to use Ollama with `llm.model`, or set both `llm.enabled=false` and `cloudLlm.enabled=true` to go fully cloud.

## Common extensions

- **New API endpoint**: Add handler in `backend/main.go`; keep middleware chain; return JSON with struct + tags; route under `/api/*`
- **Certificate customization**: Extend `cert.CertData` struct and table rendering in `internal/cert/cert.go`; plumb new fields from `Attempt` via submit response
- **Quiz tuning**: Adjust limits in `internal/quiz/generator.go` (facts/source, questions/bundle) and bounds in `/api/generate-quiz` handler
- **Ingress switching**: Toggle Caddy/NGINX via Helm values (`ingress.className` + `annotations`). For NGINX + cert‑manager, add issuer annotations + `tls.secretName` + backend-protocol annotations for HTTPS backends

If anything is unclear (e.g., NGINX cert‑manager setup), check `docs/*` or ask to refine this file.
