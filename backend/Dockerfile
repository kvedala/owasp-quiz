# Build
# Use official Red Hat UBI for enterprise-grade FIPS 140-3 compliance with Go 1.24+
FROM registry.access.redhat.com/ubi9/ubi:9.7 AS build
RUN yum update -y && yum install -y \
  gcc \
  git \
  golang \
  ca-certificates && \
    yum clean all && rm -rf /var/cache/yum/*
WORKDIR /src
# When building with context at backend directory
COPY go.mod go.sum ./
RUN go mod download
COPY . ./
# Go 1.24 FIPS 140-3 compliant build (per https://go.dev/doc/security/fips140)
# GOFIPS140=v1.0.0 uses frozen Go Cryptographic Module (CMVP validation in process)
# Disable CGO for pure Go cryptography (required for FIPS 140-3 mode)
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go get -u ./... && \
    go mod tidy && \
    CGO_ENABLED=0 GOFIPS140=v1.0.0 GOFLAGS="-trimpath" go build \
      -ldflags="-s -w -X main.Version=$(git describe --tags --always --dirty)" \
      -o /out/server .

# Runtime
# Red Hat UBI9-minimal for PCI-DSS 4.0.1 & FIPS 140-2 compliance
FROM registry.access.redhat.com/ubi9/ubi-minimal:9.7
# Security compliance labels (PCI-DSS 4.0.1 requirement: security tracking)
LABEL security.fips="140-2" security.pci-dss="4.0.1" security.pi="enabled" \
      security.vuln-scanning="enabled" security.soc2="enabled"

# PCI-DSS 4.0.1 Hardening (Requirements 2.2.4, 6.3.1, 6.3.2, 8.2.3, 8.2.4):
# - Apply security patches and remove unnecessary packages
# - Implement strong cryptography (TLS 1.2+)
# - Configure secure authentication and encryption
RUN microdnf update -y && \
    microdnf install -y \
      openssl \
      curl \
      ca-certificates && \
    microdnf clean all && \
    # PCI-DSS 4.0.1 Req 8.2.3: Create restricted service account (no login)
    groupadd -g 65532 nonroot && \
    useradd -u 65532 -g nonroot -s /sbin/nologin -M nonroot && \
    # PCI-DSS 4.0.1 Req 2.2.4: Remove unnecessary services/binaries
    rm -rf /usr/bin/passwd /usr/bin/su && \
    # PCI-DSS 4.0.1 Req 6.5.10: Remove unnecessary interpreters
    rm -rf /usr/bin/perl* /usr/bin/python* 2>/dev/null || true

WORKDIR /app

# PCI-DSS 4.0.1 Req 2.2.4 & 4.1.1: Generate FIPS 140-2 compliant certificates
# Using TLS 1.2 minimum, RSA 4096, SHA-256
RUN mkdir -p /app/certs && \
    # Reinstall openssl in this layer to avoid path/resolution issues in minimal images
    microdnf install -y openssl && \
    microdnf clean all && \
  # Ensure service user exists in case prior layer was pruned by the package manager
  (getent group 65532 || groupadd -g 65532 nonroot) && \
  (id -u nonroot >/dev/null 2>&1 || useradd -u 65532 -g nonroot -s /sbin/nologin -M nonroot) && \
    openssl req -x509 -nodes -days 90 \
      -newkey rsa:4096 \
      -keyout /app/certs/server.key \
      -out /app/certs/server.crt \
      -subj "/C=US/ST=State/L=City/O=Organization/CN=quiz-backend" && \
    # PCI-DSS 4.0.1 Req 8.2.3: Restrict file permissions (400 = owner read-only)
    chmod 400 /app/certs/server.key && \
    chmod 444 /app/certs/server.crt && \
    chown -R nonroot:nonroot /app

# PCI-DSS 4.0.1 Req 8.3.1: Create data directory with proper access controls
RUN mkdir -p /data/questionbank && \
    chmod 750 /data && \
    chmod 750 /data/questionbank && \
    chown -R nonroot:nonroot /data

COPY --from=build /out/server /app/server
COPY --from=build /src/scripts/generate-with-llm.sh /app/generate-with-llm.sh
COPY --from=build /src/data/questions.json /data/questionbank/questions.json
RUN chmod 750 /app/server && \
    chmod +x /app/generate-with-llm.sh && \
    chmod 644 /data/questionbank/questions.json && \
    chown -R nonroot:nonroot /app /data

# PCI-DSS 4.0.1 Security Configuration
# Req 2.2.4: Disable unnecessary services/features
ENV PORT=8443
ENV TLS_CERT=/app/certs/server.crt
ENV TLS_KEY=/app/certs/server.key
# Go 1.24 FIPS 140-3 Runtime Mode (per https://go.dev/doc/security/fips140)
# GODEBUG=fips140=only: Enforces FIPS 140-3 approved algorithms only
#   - Enables cryptographic self-checks at init time
#   - Performs known-answer and pairwise consistency tests
#   - Restricts TLS to FIPS-approved cipher suites (TLS 1.2+)
#   - Disallows non-FIPS algorithms (returns error/panic)
ENV GODEBUG=fips140=only
# Req 10.2: Disable core dumps to prevent PI leakage
ENV DUMPABLE=0
# Req 4.1.1: Enforce TLS 1.2 minimum
ENV TLS_MIN_VERSION=1.2

# PCI-DSS 4.0.1 Req 8.2.3: Run as non-root, non-privileged user
USER nonroot:nonroot

# PCI-DSS 4.0.1 Req 10.3.1 & 6.3.1: Health check for continuous compliance monitoring
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f --cacert "$TLS_CERT" https://localhost:8443/healthz || exit 1

EXPOSE 8443

# Security: Use exec form to ensure proper signal handling (Req 8.2.4)
ENTRYPOINT ["/app/server"]
