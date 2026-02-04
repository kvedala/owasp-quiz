# Security Features

This document outlines the comprehensive security features implemented in the OWASP Quiz application.

## Overview

The application follows OWASP security best practices with multiple layers of defense:
- Content Security Policy (CSP)
- Security headers
- Build-time security
- Privacy-first design

---

## Content Security Policy (CSP)

The application implements a strict Content Security Policy to mitigate XSS and data injection attacks:

```
default-src 'self'
script-src 'self' 'unsafe-inline'
style-src 'self' 'unsafe-inline'
img-src 'self' data: https:
font-src 'self' data:
connect-src 'self'
frame-ancestors 'none'
base-uri 'self'
form-action 'self'
```

**Note:** `'unsafe-inline'` is currently required for React's inline styles and scripts. Consider using a nonce-based approach or migrating to external stylesheets for stricter security.

## Security Headers

### X-Frame-Options: DENY
Prevents the application from being embedded in frames/iframes, protecting against clickjacking attacks.

### X-Content-Type-Options: nosniff
Prevents browsers from MIME-sniffing responses away from the declared content type, reducing the risk of content-type confusion attacks.

### X-XSS-Protection: 1; mode=block
Enables the browser's built-in XSS filter (legacy support for older browsers).

### Referrer-Policy: strict-origin-when-cross-origin
Controls how much referrer information is sent with requests:
- Same-origin: Full URL
- Cross-origin HTTPS→HTTPS: Origin only
- Cross-origin HTTPS→HTTP: No referrer

### Permissions-Policy
Restricts access to browser features:
- `geolocation=()` - Blocks geolocation access
- `microphone=()` - Blocks microphone access
- `camera=()` - Blocks camera access

### Strict-Transport-Security (HSTS)
Forces browsers to use HTTPS for all future requests:
- `max-age=31536000` - 1 year duration
- `includeSubDomains` - Applies to all subdomains
- `preload` - Eligible for browser HSTS preload list

## TLS/SSL Configuration

### Protocol Support
- TLS 1.2 and TLS 1.3 only
- Older protocols (SSL, TLS 1.0, TLS 1.1) are disabled

### Cipher Suites
- Only HIGH-strength ciphers allowed
- NULL and MD5 ciphers explicitly blocked
- Server cipher preference enabled

### Certificates
- Development: Use HTTPS via Vite's built-in dev server
- Production: Use certificates from your hosting provider (automatic with GitHub Pages, Netlify, Vercel, etc.)
- Docker/Self-hosted: Use cert-manager with Let's Encrypt or certificates from your CA (see [DOCKER.md](DOCKER.md))

---

## Static Hosting Security Headers

Most static hosting platforms support custom security headers:

### Netlify

Create `_headers` file in `frontend/public/`:
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

Or use `netlify.toml`:
```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(), microphone=(), camera=()"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
```

### Vercel

Create `vercel.json` in project root:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "geolocation=(), microphone=(), camera=()" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" }
      ]
    }
  ]
}
```

### Cloudflare Pages

Create `_headers` file in `frontend/public/` (same format as Netlify).

Or configure via Cloudflare Dashboard:
1. Go to Pages > Your Project > Settings
2. Add Transform Rules for security headers

### GitHub Pages

GitHub Pages has limited header control. Options:
- Use Cloudflare as a proxy (recommended)
- Use a service worker to inject headers client-side (limited effectiveness)
- Consider alternative hosting with better header support

### AWS S3 + CloudFront

Configure headers in CloudFront distribution:
1. Create a Response Headers Policy
2. Add security headers
3. Attach policy to CloudFront behavior

---

## Docker/NGINX Deployment

For self-hosted deployments with full control over security headers, see [DOCKER.md](DOCKER.md).

---

## Build Security

### Source Maps
Source maps are disabled in production builds (`sourcemap: false`) to prevent exposing source code.

### Content Hashing
All assets are hashed during build for cache busting and integrity:
```javascript
entryFileNames: 'assets/[name].[hash].js'
chunkFileNames: 'assets/[name].[hash].js'
assetFileNames: 'assets/[name].[hash].[ext]'
```

---

## Development Server

The Vite dev server includes the same security headers as production for consistency:
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Referrer-Policy
- Permissions-Policy

## Recommendations for Production

### 1. Use HTTPS
All modern hosting platforms provide automatic HTTPS:
- GitHub Pages: Automatic with custom domains
- Netlify/Vercel: Automatic Let's Encrypt certificates
- Cloudflare Pages: Automatic with Cloudflare SSL
- Docker: See [DOCKER.md](DOCKER.md) for certificate configuration

### 2. Tighten CSP
Remove `'unsafe-inline'` by implementing:
- Nonce-based script execution
- External stylesheets instead of inline styles
- CSS-in-JS solutions that support CSP nonces

### 3. Add Subresource Integrity (SRI)
For any external resources, add SRI hashes:
```html
<script src="https://cdn.example.com/lib.js" 
        integrity="sha384-..." 
        crossorigin="anonymous"></script>
```

### 4. Implement Rate Limiting
Add rate limiting at the ingress/load balancer level:
- Limit requests per IP
- Implement WAF rules
- Add DDoS protection

### 5. Regular Security Audits
- Run `npm audit` regularly
- Update dependencies promptly
- Monitor security advisories for React and Vite
- Use tools like OWASP ZAP or Burp Suite for penetration testing

### 6. Content Security Policy Reporting
Add CSP reporting to monitor policy violations:
```
Content-Security-Policy: ...; report-uri /csp-report
```

### 7. Additional Headers
Consider adding:
- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`

## Testing Security Headers

Test your security headers using:
- [Mozilla Observatory](https://observatory.mozilla.org/)
- [Security Headers](https://securityheaders.com/)
- [SSL Labs](https://www.ssllabs.com/ssltest/)

## Compliance

These security features help meet requirements for:
- OWASP Top 10
- GDPR (data protection)
- PCI DSS (if handling payment data)
- SOC 2 compliance
- NIST Cybersecurity Framework
