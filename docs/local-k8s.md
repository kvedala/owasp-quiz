# Local Kubernetes (kind/minikube) with Helm

This guide shows two options for local development and testing via Helm:
- Option A: ingress-nginx with a self-signed or mkcert TLS secret
- Option B: Caddy Ingress Controller with automatic local HTTPS

Both options use the chart in `helm/owasp-quiz` and the example `values.local-kind.yaml`.

## Prerequisites
- Docker
- One local Kubernetes: kind or minikube
- Helm v3
- Windows users: PowerShell admin access to edit `hosts` if you prefer a custom hostname (we use `quiz.localhost`, and by RFC 6761 any `*.localhost` resolves to 127.0.0.1).

---

## Option A: kind + ingress-nginx (recommended starter)

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

3) Create a local TLS cert and secret (mkcert is easiest):

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

5) Open https://quiz.localhost

> If the browser doesn’t trust your local CA, re-run `mkcert -install` and restart the browser.

---

## Option B: Caddy Ingress Controller (built-in local HTTPS)

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

## One-command setup (PowerShell)

From the repo root:

```powershell
./scripts/setup-local.ps1 -InstallPortainer
```

Flags:
- `-RecreateCluster` to delete and recreate the kind cluster named `owasp-quiz`.
- `-InstallPortainer` to also install Portainer with Caddy ingress.

---

## Notes
- The chart now supports pluggable annotations and `ingressClassName` (see `templates/ingress.yaml`).
- For production, set a real hostname and manage certs via cert-manager/ACME. Update `values.yaml` and `ingress.annotations` accordingly.
- If you run the frontend dev server outside the cluster, set `ALLOWED_ORIGINS` on the backend or use single-host routing via the Ingress to avoid CORS.

### Optional: Manage with Portainer
See `docs/portainer.md` to install Portainer via Helm and expose it through the same Caddy Ingress:

```powershell
helm repo add portainer https://portainer.github.io/k8s/
helm repo update
helm upgrade --install portainer portainer/portainer `
  -n portainer --create-namespace `
  -f ./helm/portainer/values.local-kind.yaml
```
