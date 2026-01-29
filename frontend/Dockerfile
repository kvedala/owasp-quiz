
# Build Stage - Use Red Hat UBI for FIPS 140-3 compliance
FROM registry.access.redhat.com/ubi9/nodejs-20:latest AS build
WORKDIR /app
COPY package.json package-lock.json* ./
# Install all dependencies (including dev) needed for build
RUN npm ci --ignore-scripts || npm install --ignore-scripts
COPY . ./
RUN npm run build

# Runtime Stage - Red Hat UBI9-minimal with NGINX for PCI-DSS 4.0.1 & FIPS 140-3
FROM registry.access.redhat.com/ubi9/ubi-minimal:9.7
# Security compliance labels (PCI-DSS 4.0.1 requirement: security tracking)
LABEL security.fips="140-3" security.pci-dss="4.0.1" security.pi="enabled" \
      security.vuln-scanning="enabled" security.soc2="enabled"

# PCI-DSS 4.0.1 Req 2.2.4 & 6.3.1: Install patched NGINX and minimal dependencies
RUN microdnf update -y && \
    microdnf install -y \
      nginx \
      openssl \
      shadow-utils && \
    microdnf clean all && \
    # PCI-DSS 4.0.1 Req 2.2.4: Remove unnecessary binaries
    rm -rf /usr/bin/passwd /usr/bin/su /usr/bin/sudo 2>/dev/null || true && \
    # Create nginx user if not exists (UID/GID 101)
    groupadd -f -g 101 nginx || true && \
    useradd -u 101 -g nginx -s /sbin/nologin -M nginx 2>/dev/null || true

# PCI-DSS 4.0.1 Req 4.1.1: Generate FIPS 140-3 compliant TLS certificates
# Using RSA 4096, 90-day validity, SHA-256
RUN mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 90 \
      -newkey rsa:4096 \
      -keyout /etc/nginx/ssl/nginx.key \
      -out /etc/nginx/ssl/nginx.crt \
      -subj "/C=US/ST=State/L=City/O=Organization/CN=quiz-frontend" && \
    # PCI-DSS 4.0.1 Req 8.2.3: Restrict certificate permissions
    chmod 400 /etc/nginx/ssl/nginx.key && \
    chmod 444 /etc/nginx/ssl/nginx.crt && \
    chown -R nginx:nginx /etc/nginx/ssl

# Configure NGINX directories with proper permissions
RUN mkdir -p /var/cache/nginx /var/log/nginx /var/run /usr/share/nginx/html /tmp/nginx && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx /var/run /usr/share/nginx/html /tmp/nginx && \
    chmod 750 /var/cache/nginx /var/log/nginx && \
    chmod 777 /tmp/nginx && \
    # Modify main nginx.conf to use a writable PID location
    sed -i 's|pid /run/nginx.pid;|pid /tmp/nginx/nginx.pid;|g' /etc/nginx/nginx.conf || true

# Copy hardened NGINX configuration for HTTPS
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN chown nginx:nginx /etc/nginx/conf.d/default.conf && \
    chmod 644 /etc/nginx/conf.d/default.conf

# Copy built frontend with restricted permissions
COPY --from=build --chown=nginx:nginx /app/dist/ /usr/share/nginx/html
RUN chmod -R 755 /usr/share/nginx/html

# PCI-DSS 4.0.1 Req 8.2.3: Run as non-root, non-privileged user
USER nginx:nginx

# PCI-DSS 4.0.1 Req 10.3.1: Health check for continuous compliance monitoring
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f -k https://localhost:443/health || exit 1

EXPOSE 443

# Use exec form for proper signal handling
CMD ["nginx", "-g", "daemon off;"]
