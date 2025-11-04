# Production Deployment (cert-manager + Let’s Encrypt)

This guide covers a production deployment using NGINX Ingress and cert-manager with a ClusterIssuer for Let’s Encrypt.

## Prerequisites
- Kubernetes cluster with external connectivity and DNS pointing to your ingress controller
- Helm v3 and kubectl
- NGINX Ingress Controller (or adapt to your controller)
- cert-manager installed

## Install cert-manager
```
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.15.3/cert-manager.crds.yaml
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm upgrade --install cert-manager jetstack/cert-manager -n cert-manager --create-namespace --set installCRDs=false
```

## Create an ACME Issuer
Use a ClusterIssuer for cluster-wide use (recommended):

```
kubectl apply -f - <<'YAML'
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    email: soc@pspservicesco.com
    server: https://acme-v02.api.letsencrypt.org/directory
    privateKeySecretRef:
      name: letsencrypt-prod-account-key
    solvers:
    - http01:
        ingress:
          class: nginx
YAML
```

If you prefer a namespace-scoped Issuer, change `kind: Issuer` and add `metadata.namespace` to match the target namespace. Update the chart values accordingly.

## Configure chart values
Edit `helm/owasp-quiz/values.prod.yaml`:
- `ingress.host`: `quiz.pspservicesco.com`
- `ingress.komodoHost`: `komodo.quiz.pspservicesco.com`
- `ingress.tls.enabled: true` and `ingress.tls.secretName: quiz-tls`
- `ingress.komodoTls.enabled: true` and `ingress.komodoTls.secretName: komodo-tls`
- `ingress.certManager.enabled: true`
- `ingress.certManager.issuerKind: ClusterIssuer`
- `ingress.certManager.issuerName: letsencrypt-prod`

## Deploy
Use the provided script (recommended):

```powershell
./scripts/deploy-prod.ps1 -Namespace owasp-quiz `
  -AppHost quiz.pspservicesco.com `
  -KomodoHost komodo.quiz.pspservicesco.com `
  -IssuerKind ClusterIssuer `
  -IssuerName letsencrypt-prod `
  -IngressClass nginx `
  -Wait
```

Or Helm directly:
```
helm upgrade --install owasp-quiz ./helm/owasp-quiz \
  -n owasp-quiz --create-namespace \
  -f ./helm/owasp-quiz/values.prod.yaml \
  --set ingress.certManager.enabled=true \
  --set ingress.certManager.issuerKind=ClusterIssuer \
  --set ingress.certManager.issuerName=letsencrypt-prod
```

## Verify
- Check Ingress and Certificate resources:
```
kubectl -n owasp-quiz get ingress
kubectl -n owasp-quiz get certificate,certificateRequest,order,challenge
```
- Open the application URLs:
  - https://quiz.pspservicesco.com
  - https://komodo.quiz.pspservicesco.com

## Notes
- DNS A records must point to your ingress controller’s public IP.
- The chart routes `/api` → backend and `/` → frontend over HTTPS end-to-end.
- cert-manager will keep certificates renewed automatically.
