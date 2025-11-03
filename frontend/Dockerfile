
FROM node:alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install
COPY frontend/ ./
RUN npm run build

FROM nginx:1-alpine
# Install OpenSSL for certificate generation
RUN apk add --no-cache openssl

# Generate self-signed certificate for internal HTTPS
RUN mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/nginx.key \
    -out /etc/nginx/ssl/nginx.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=quiz-frontend"

# Copy custom NGINX config for HTTPS
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built frontend
COPY --from=build /app/dist/ /usr/share/nginx/html

EXPOSE 443
