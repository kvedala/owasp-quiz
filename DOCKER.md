# Docker Deployment Guide

This guide covers deploying the OWASP Quiz application using Docker with NGINX for full control over security headers and server configuration.

## Quick Start

### Prerequisites
- Docker installed
- Basic knowledge of Docker and NGINX

### Build and Run

```bash
# Clone the repository
git clone https://github.com/kvedala/owasp-quiz.git
cd owasp-quiz

# Build the application
cd frontend
npm ci
npm run build

# Create Dockerfile (see below)
# Build Docker image
docker build -t owasp-quiz .

# Run container
docker run -d \
  --name owasp-quiz \
  -p 80:80 \
  -p 443:443 \
  owasp-quiz

# Access the application
open https://localhost
```

---

## Dockerfile

Create `frontend/Dockerfile`:

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Install OpenSSL for generating self-signed certificates
RUN apk add --no-cache openssl

# Create SSL directory
RUN mkdir -p /etc/nginx/ssl

# Generate self-signed certificate (for development/testing)
# Replace with proper certificates in production
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/key.pem \
    -out /etc/nginx/ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Create a non-root user to run nginx
RUN addgroup -g 101 -S nginx-user && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx-user -g nginx-user nginx-user

# Set proper permissions
RUN chown -R nginx-user:nginx-user /usr/share/nginx/html && \
    chown -R nginx-user:nginx-user /var/cache/nginx && \
    chown -R nginx-user:nginx-user /etc/nginx/ssl && \
    chmod -R 755 /usr/share/nginx/html && \
    touch /var/run/nginx.pid && \
    chown -R nginx-user:nginx-user /var/run/nginx.pid

# Switch to non-root user
USER nginx-user

# Expose HTTP and HTTPS ports
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider https://localhost/health --no-check-certificate || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

---

## NGINX Configuration

Create `frontend/nginx.conf`:

```nginx
# HTTP server - redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name _;
    
    location /health {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name _;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    root /usr/share/nginx/html;
    index index.html;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
    
    # HSTS (HTTP Strict Transport Security)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Remove server header
    server_tokens off;

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }

    # Main application
    location / {
        try_files $uri $uri/ /index.html;
        
        # Cache control for static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            
            # Re-add security headers for cached assets
            add_header X-Frame-Options "DENY" always;
            add_header X-Content-Type-Options "nosniff" always;
            add_header X-XSS-Protection "1; mode=block" always;
        }

        # No cache for HTML files
        location ~* \.(html)$ {
            expires -1;
            add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
            
            # Re-add security headers
            add_header X-Frame-Options "DENY" always;
            add_header X-Content-Type-Options "nosniff" always;
            add_header X-XSS-Protection "1; mode=block" always;
        }
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json image/svg+xml;
    gzip_disable "msie6";
}
```

---

## Docker Compose (Optional)

Create `docker-compose.yml` for easier management:

```yaml
version: '3.8'

services:
  owasp-quiz:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: owasp-quiz
    ports:
      - "80:80"
      - "443:443"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "https://localhost/health", "--no-check-certificate"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
```

Run with:
```bash
docker-compose up -d
```

---

## Production TLS Certificates

### Option 1: Let's Encrypt with Certbot

```bash
# Install certbot
apt-get update && apt-get install certbot

# Generate certificate
certbot certonly --standalone -d yourdomain.com

# Update nginx.conf
ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

# Mount certificates in Docker
docker run -d \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  -p 80:80 -p 443:443 \
  owasp-quiz
```

### Option 2: Kubernetes with cert-manager

If deploying to Kubernetes, use cert-manager for automatic certificate management:

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: owasp-quiz-tls
spec:
  secretName: owasp-quiz-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - yourdomain.com
```

### Option 3: Cloudflare SSL

Use Cloudflare as a reverse proxy:
1. Point your domain to Cloudflare
2. Enable SSL/TLS in Cloudflare dashboard
3. Use origin certificates between Cloudflare and your server

---

## Kubernetes Deployment

Create `k8s-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: owasp-quiz
spec:
  replicas: 2
  selector:
    matchLabels:
      app: owasp-quiz
  template:
    metadata:
      labels:
        app: owasp-quiz
    spec:
      containers:
      - name: owasp-quiz
        image: owasp-quiz:latest
        ports:
        - containerPort: 80
        - containerPort: 443
        livenessProbe:
          httpGet:
            path: /health
            port: 443
            scheme: HTTPS
          initialDelaySeconds: 5
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 443
            scheme: HTTPS
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: owasp-quiz
spec:
  selector:
    app: owasp-quiz
  ports:
  - name: http
    port: 80
    targetPort: 80
  - name: https
    port: 443
    targetPort: 443
  type: LoadBalancer
```

Deploy:
```bash
kubectl apply -f k8s-deployment.yaml
```

---

## Security Best Practices

### 1. Use Non-Root User
The Dockerfile runs NGINX as a non-root user (UID/GID 101) for enhanced security.

### 2. Minimal Base Image
Uses `nginx:alpine` for a smaller attack surface.

### 3. Multi-Stage Build
Separates build and runtime environments to keep the final image lean.

### 4. Health Checks
Includes health check endpoint at `/health` for monitoring and orchestration.

### 5. Regular Updates
```bash
# Update base images regularly
docker pull node:20-alpine
docker pull nginx:alpine
docker build --no-cache -t owasp-quiz .
```

### 6. Scan for Vulnerabilities
```bash
# Use Docker scan or Trivy
docker scan owasp-quiz
# or
trivy image owasp-quiz
```

---

## Monitoring and Logging

### Access Logs
```bash
docker logs owasp-quiz
```

### NGINX Access Logs
```bash
docker exec owasp-quiz tail -f /var/log/nginx/access.log
```

### Health Check
```bash
curl -k https://localhost/health
```

---

## Troubleshooting

**Q: Certificate errors in browser?**  
A: Self-signed certificates will show warnings. For production, use proper certificates from Let's Encrypt or a trusted CA.

**Q: Permission denied errors?**  
A: Ensure the non-root user has proper permissions. Check the RUN commands in the Dockerfile.

**Q: Container won't start?**  
A: Check logs with `docker logs owasp-quiz`. Common issues:
- Port 80/443 already in use
- Invalid NGINX configuration
- Missing files or permissions

**Q: How to update the application?**  
A: Rebuild and restart:
```bash
docker build -t owasp-quiz .
docker stop owasp-quiz
docker rm owasp-quiz
docker run -d --name owasp-quiz -p 80:80 -p 443:443 owasp-quiz
```

---

## Alternative: Static File Server

For simpler deployments without NGINX configuration:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM lipanski/docker-static-website:latest
COPY --from=builder /app/dist /home/static
```

This uses a minimal static file server without manual NGINX configuration.

---

## See Also

- [SECURITY.md](SECURITY.md) - Comprehensive security documentation
- [README.md](README.md) - General setup and deployment
- [NGINX Documentation](https://nginx.org/en/docs/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
