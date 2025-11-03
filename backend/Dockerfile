
# Build
FROM golang:1-alpine AS build
RUN apk add --no-cache git
WORKDIR /src
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    cd backend && go get github.com/go-pdf/fpdf@latest && go get -u ./... && go mod tidy && go build -o /out/server

# Runtime
FROM alpine:latest
RUN apk add --no-cache openssl && \
    addgroup -g 65532 -S nonroot && adduser -u 65532 -S nonroot -G nonroot
WORKDIR /app

# Generate self-signed certificate for internal HTTPS
RUN mkdir -p /app/certs && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /app/certs/server.key \
    -out /app/certs/server.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=quiz-backend" && \
    chown -R nonroot:nonroot /app

COPY --from=build /out/server /app/server

ENV PORT=8443
ENV TLS_CERT=/app/certs/server.crt
ENV TLS_KEY=/app/certs/server.key

USER nonroot:nonroot
EXPOSE 8443
ENTRYPOINT ["/app/server"]
