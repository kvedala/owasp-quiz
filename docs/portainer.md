# Managing this Deployment with Portainer

This guide installs Portainer using Helm and exposes it via the same Ingress Controller (Caddy) you’re using for the app.

## Add the Helm repo

```powershell
helm repo add portainer https://portainer.github.io/k8s/
helm repo update
```

## Local (kind/minikube + Caddy)

```powershell
kubectl create namespace portainer
helm upgrade --install portainer portainer/portainer `
  -n portainer `
  -f ./helm/portainer/values.local-kind.yaml
```

- Open: https://portainer.localhost
- Log in and start managing the cluster resources (namespaces `owasp-quiz` and `portainer`).

## Production (Caddy + ACME)

```powershell
kubectl create namespace portainer
helm upgrade --install portainer portainer/portainer `
  -n portainer `
  -f ./helm/portainer/values.prod-caddy.yaml `
  --set ingress.hosts[0].host=portainer.example.com
```

Make sure:
- DNS points `portainer.example.com` to your cluster/load balancer
- The Caddy Ingress Controller is configured with a valid ACME email.

### Alternative: Serve Portainer under the same host path (/portainer)

If you prefer a single hostname (e.g., `quiz.pspservicesco.com/portainer`), deploy using the subpath values:

```powershell
helm upgrade --install portainer portainer/portainer `
  -n portainer `
  -f ./helm/portainer/values.prod-caddy-subpath.yaml
```

Notes:
- Portainer may require base-path support to serve correctly from `/portainer`. If UI assets fail to load, switch to a dedicated host or consult the Portainer chart/docs for enabling a base path.

## Notes
- The Portainer chart values here assume Caddy; switch to nginx by setting `ingress.ingressClassName=nginx` and using nginx annotations.
- For air-gapped or restricted environments, you can run Portainer without Ingress (NodePort or LoadBalancer). Adjust `service.type` accordingly.
- Portainer is powerful; restrict access carefully in production. Consider SSO/OIDC and RBAC.
