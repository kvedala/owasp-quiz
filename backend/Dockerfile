
# Build
FROM golang:1.22-alpine AS build
WORKDIR /src
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod     --mount=type=cache,target=/root/.cache/go-build     cd backend && go build -o /out/server

# Runtime
FROM gcr.io/distroless/base-debian12
WORKDIR /app
COPY --from=build /out/server /app/server
ENV PORT=8080
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app/server"]
