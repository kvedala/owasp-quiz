# Using Caddy Ingress Controller (Local + Production)

This project supports Caddy Ingress Controller out of the box via Helm values.

- Local development: use `values.local-kind.yaml` (className=caddy, TLS via Caddy internal CA)
- Production: use `values.caddy.yaml` (className=caddy, automatic ACME TLS)

## Install Caddy Ingress Controller

```powershell
kubectl apply -f https://raw.githubusercontent.com/caddyserver/ingress/v0.7.0/deploy/caddy-ingress-controller.yaml
kubectl -n caddy-system rollout status deploy/caddy-ingress-controller
```

> For production, configure the controller with a valid ACME email (see the Caddy Ingress Controller docs for configuring global options, e.g., via a ConfigMap or controller args).

## Local (kind/minikube)

```powershell
helm upgrade --install owasp-quiz ./helm/owasp-quiz `
  -f ./helm/owasp-quiz/values.local-kind.yaml
```

Open: https://quiz.localhost (trust the local CA if prompted)

## Production

Point DNS of your domain to the cluster/load balancer, then:

```powershell
helm upgrade --install owasp-quiz ./helm/owasp-quiz `
  -f ./helm/owasp-quiz/values.caddy.yaml `
  --set ingress.host=quiz.example.com
```

Notes:
- With Caddy, leave `ingress.tls.enabled=false` so the controller manages certs automatically.
- Ensure the controller is configured with ACME email and permitted to solve challenges (publicly reachable).
- You can switch back to ingress-nginx any time by setting `ingress.className=nginx` and swapping `ingress.annotations`.
