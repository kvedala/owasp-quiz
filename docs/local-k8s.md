# Local Kubernetes (Docker Desktop/kind/minikube)

Recommended: use the provided script with NGINX Ingress. It serves HTTPS using the ingress controller's default self-signed certificate for local hosts (e.g., `*.localhost`). All HTTP requests are redirected to HTTPS.

```powershell
./scripts/setup-local.ps1 [-BuildImages]
```

URLs:
- https://quiz.localhost (frontend + API under /api)
- http://k8s.localhost (Kubernetes Dashboard; local-only)

The chart routes `/api` to the backend and `/` to the frontend. Both services speak HTTPS inside the cluster; the ingress terminates external TLS.

## Prerequisites
- Docker
- One local Kubernetes: kind or minikube
- Helm v3
- Windows users: PowerShell admin access to edit `hosts` if you prefer a custom hostname (we use `quiz.localhost`, and by RFC 6761 any `*.localhost` resolves to 127.0.0.1).

### Notes for local script
- Installs NGINX Ingress into the `owasp-quiz` namespace.
- Sets `nginx.ingress.kubernetes.io/force-ssl-redirect: "true"` so HTTP→HTTPS.
- Disables upstream TLS verify for self-signed pod certs in local dev.
- Enables an optional dashboard ingress via `localDashboardIngress.enabled=true` (k8s.localhost).
- Generate a dashboard token:

```powershell
kubectl -n owasp-quiz create serviceaccount admin-user
kubectl -n owasp-quiz create clusterrolebinding admin-user-binding --clusterrole=cluster-admin --serviceaccount=owasp-quiz:admin-user
kubectl -n owasp-quiz create token admin-user --duration=1h
```

---

---

## Alternative: kind + ingress-nginx (manual)

1) Create a kind cluster with ingress enabled (example):

```powershell
kind create cluster --name owasp-quiz
kubectl cluster-info
```

2) Install ingress-nginx:

```powershell
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl -n ingress-nginx rollout status deploy/ingress-nginx-controller
```

3) (Optional) Create a local TLS cert and secret (mkcert):

```powershell
# Install mkcert if needed: https://github.com/FiloSottile/mkcert
mkcert -install
mkcert quiz.localhost
kubectl create namespace owasp-quiz
kubectl -n owasp-quiz create secret tls quiz-local-tls `
  --cert=quiz.localhost.pem `
  --key=quiz.localhost-key.pem
```

4) Deploy the chart with local values:

```powershell
helm upgrade --install owasp-quiz ./helm/owasp-quiz `
  -f ./helm/owasp-quiz/values.local-kind.yaml
```

5) Open https://quiz.localhost (accept the self-signed certificate warning)

> If the browser doesn’t trust your local CA, re-run `mkcert -install` and restart the browser.

---

## Alternative: Caddy Ingress Controller (built-in local HTTPS)

1) Create your cluster (kind or minikube).

2) Install Caddy Ingress Controller:

```powershell
kubectl apply -f https://raw.githubusercontent.com/caddyserver/ingress/v0.7.0/deploy/caddy-ingress-controller.yaml
kubectl -n caddy-system rollout status deploy/caddy-ingress-controller
```

3) Deploy with Caddy-specific overrides:

```powershell
helm upgrade --install owasp-quiz ./helm/owasp-quiz `
  -f ./helm/owasp-quiz/values.local-kind.yaml `
  --set ingress.className=caddy `
  --set ingress.annotations.{kubernetes\.io/ingress\.class}=caddy `
  --set ingress.annotations.caddy\.ingress\.kubernetes\.io/tls=internal `
  --set ingress.annotations.caddy\.ingress\.kubernetes\.io/enable-tls=true
```

Caddy will terminate HTTPS using its internal CA for local hosts (e.g., `quiz.localhost`). You may need to trust Caddy’s local CA depending on your environment.

---

## Notes
- The chart supports pluggable annotations and `ingressClassName` (see `templates/ingress.yaml`).
- For production, set a real hostname and manage certs via cert-manager/ACME. See `docs/prod.md`.
- If you run the frontend dev server outside the cluster, set `ALLOWED_ORIGINS` on the backend or use single-host routing via the Ingress to avoid CORS.
- Dashboard ingress for local dev is templated in `templates/ingress-dashboard.yaml` and gated by `localDashboardIngress.enabled`.

### Optional: Manage with Portainer
See `docs/portainer.md` to install Portainer via Helm and expose it through the same Caddy Ingress:

```powershell
helm repo add portainer https://portainer.github.io/k8s/
helm repo update
helm upgrade --install portainer portainer/portainer `
  -n portainer --create-namespace `
  -f ./helm/portainer/values.local-kind.yaml
```
