# Komodo Integration

[Komodo](https://github.com/mbecker20/komodo) is a modern, lightweight Kubernetes management and deployment tool that provides a UI for managing your clusters, deployments, and resources.

## Features

- **Resource Management**: View and manage pods, deployments, services, and other Kubernetes resources
- **Deployment Tracking**: Monitor deployment status and health
- **Log Viewing**: Stream logs from containers in real-time
- **Lightweight**: Minimal resource footprint compared to traditional K8s dashboards
- **Modern UI**: Clean, responsive interface

## Installation

### Local Development

For local development with Docker Desktop or minikube:

```powershell
.\scripts\setup-local.ps1 -InstallKomodo
```

This will deploy Komodo at `https://komodo.localhost`

### Production - Dedicated Host

For production with a dedicated hostname (e.g., `komodo.example.com`):

```bash
# Update the host in the values file
helm install komodo --create-namespace -n komodo \
  -f helm/komodo/values.prod-caddy.yaml \
  --set ingress.host=komodo.yourdomain.com \
  --set env.KOMODO_HOST=https://komodo.yourdomain.com \
  ./helm/komodo
```

### Production - Subpath

To serve Komodo under a subpath (e.g., `quiz.opencompany.example/komodo`):

```bash
helm install komodo --create-namespace -n komodo \
  -f helm/komodo/values.prod-caddy-subpath.yaml \
  ./helm/komodo
```

**Note**: Subpath deployments may require additional configuration depending on how Komodo handles base paths. Prefer dedicated host if possible.

## Configuration

### Values

Key configuration options in the Helm values:

```yaml
image:
  repository: ghcr.io/mbecker20/komodo
  tag: latest

ingress:
  enabled: true
  className: caddy  # or nginx
  host: komodo.localhost

persistence:
  enabled: true
  size: 1Gi  # Adjust based on needs

resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi

env:
  KOMODO_HOST: "https://komodo.localhost"
```

### NGINX Ingress

If using NGINX Ingress Controller instead of Caddy:

1. Update `ingress.className` to `nginx`
2. Update annotations:
   ```yaml
   annotations:
     cert-manager.io/cluster-issuer: "letsencrypt-prod"
     nginx.ingress.kubernetes.io/ssl-redirect: "true"
   ```

## Access Control

Komodo uses Kubernetes RBAC for access control. By default, it operates with the service account permissions in its namespace. For production:

1. Create a dedicated service account with appropriate RBAC
2. Bind cluster-reader or custom roles as needed
3. Consider enabling authentication/authorization at the ingress level

## Monitoring

Komodo itself is lightweight and requires minimal monitoring. Key metrics to watch:

- Pod status: `kubectl get pods -n komodo`
- Resource usage: `kubectl top pods -n komodo`
- Logs: `kubectl logs -n komodo deployment/komodo`

## Troubleshooting

### Cannot Access UI

1. Check ingress:
   ```bash
   kubectl get ingress -n komodo
   ```

2. Verify service:
   ```bash
   kubectl get svc -n komodo
   ```

3. Check pod status:
   ```bash
   kubectl get pods -n komodo
   kubectl logs -n komodo deployment/komodo
   ```

### Permission Issues

If Komodo cannot access certain resources:

1. Check service account permissions
2. Update RBAC rules as needed
3. Verify the service account is properly bound

## Alternatives

Other Kubernetes dashboard options:

- **Kubernetes Dashboard**: Official K8s dashboard (heavier)
- **Lens**: Desktop application (requires local install)
- **K9s**: Terminal-based dashboard (CLI)
- **Octant**: VMware's K8s dashboard

Komodo is preferred here for its lightweight nature and modern UI.

## Security Considerations

1. **Access Control**: Always enable authentication in production
2. **Network Policy**: Consider restricting Komodo's network access
3. **HTTPS**: Ensure TLS is properly configured
4. **RBAC**: Grant minimum required permissions
5. **Updates**: Keep Komodo updated for security patches

## References

- [Komodo GitHub](https://github.com/mbecker20/komodo)
- [Komodo Documentation](https://github.com/mbecker20/komodo#readme)
