param(
    [string]$ClusterName = "owasp-quiz",
    [switch]$RecreateCluster,
    [switch]$InstallKomodo,
    [string]$Namespace = "owasp-quiz",
    [string]$AppHost = "quiz.localhost",
    [string]$KomodoHost = "komodo.localhost"
)

$ErrorActionPreference = "Stop"

function Test-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Exec($cmd, $arguments) {
    Write-Host "==> $cmd $arguments" -ForegroundColor Cyan
    $p = Start-Process -FilePath $cmd -ArgumentList $arguments -NoNewWindow -PassThru -Wait
    if ($p.ExitCode -ne 0) { throw "Command failed: $cmd $args (exit $($p.ExitCode))" }
}

function Test-Namespace($n) {
    try {
        $ErrorActionPreference = "SilentlyContinue"
        kubectl get ns $n *>$null
        return ($LASTEXITCODE -eq 0)
    }
    finally {
        $ErrorActionPreference = "Stop"
    }
}

Write-Host "Validating prerequisites..." -ForegroundColor Green
if (-not (Test-Command kubectl)) { throw "'kubectl' is required but not found in PATH. Please install it and retry." }
if (-not (Test-Command helm)) { throw "'helm' is required but not found in PATH. Please install it and retry." }

# Resolve repo root from this script's location
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..")

## 1) Cluster management removed: assumes existing cluster and context

# Check if running on Docker Desktop
$currentContext = kubectl config current-context 2>$null
$isDockerDesktop = $currentContext -eq "docker-desktop"

if ($isDockerDesktop) {
    Write-Host "Detected Docker Desktop Kubernetes - building images locally..." -ForegroundColor Green
    
    Push-Location $RepoRoot
    try {
        Write-Host "Building backend image..." -ForegroundColor Cyan
        Exec docker "build -t owasp-quiz-backend:latest -f backend/Dockerfile ."

        Write-Host "Building frontend image..." -ForegroundColor Cyan
        Exec docker "build -t owasp-quiz-frontend:latest -f frontend/Dockerfile ."
    }
    finally {
        Pop-Location
    }
}

Write-Host "Installing Caddy Ingress Controller via Helm..." -ForegroundColor Green
# Create caddy-system namespace if it doesn't exist
if (-not (Test-Namespace "caddy-system")) { 
    Exec kubectl "create namespace caddy-system" 
}

# Add Caddy Helm repo and install
Exec helm "repo add caddy https://caddyserver.github.io/ingress/"
Exec helm "repo update"
Exec helm "upgrade --install caddy caddy/caddy-ingress-controller --namespace caddy-system --wait --timeout=180s"

Write-Host "Caddy Ingress Controller installed successfully." -ForegroundColor Green

$ChartPath = Join-Path $RepoRoot "helm/owasp-quiz"

# Use Docker Desktop values if detected, otherwise use local-kind values
if ($isDockerDesktop) {
    $LocalValues = Join-Path $ChartPath "values.local-docker-desktop.yaml"
}
else {
    $LocalValues = Join-Path $ChartPath "values.local-kind.yaml"
}

if (-not (Test-Path $LocalValues)) { throw "Local values file not found: $LocalValues" }

Write-Host "Deploying chart to https://$AppHost ..." -ForegroundColor Green
Exec helm "upgrade --install owasp-quiz $ChartPath -f `"$LocalValues`""

Write-Host "Waiting for app deployments to become ready..." -ForegroundColor Green
Exec kubectl "-n $Namespace rollout status deploy/quiz-backend --timeout=180s"
Exec kubectl "-n $Namespace rollout status deploy/quiz-frontend --timeout=180s"

# 4) Optional: Install Komodo
if ($InstallKomodo.IsPresent) {
    Write-Host "Installing Komodo (Caddy, local HTTPS) ..." -ForegroundColor Green
    if (-not (Test-Namespace "komodo")) { Exec kubectl "create namespace komodo" }
    $KomodoValues = Join-Path $RepoRoot "helm/komodo/values.local.yaml"
    if (-not (Test-Path $KomodoValues)) { throw "Komodo values not found: $KomodoValues" }
    
    # Create a simple deployment for Komodo (since there's no official Helm chart yet)
    @"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: komodo
  namespace: komodo
spec:
  replicas: 1
  selector:
    matchLabels:
      app: komodo
  template:
    metadata:
      labels:
        app: komodo
    spec:
      containers:
      - name: komodo
        image: ghcr.io/mbecker20/komodo:latest
        ports:
        - containerPort: 9120
        env:
        - name: KOMODO_HOST
          value: https://$KomodoHost
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
---
apiVersion: v1
kind: Service
metadata:
  name: komodo
  namespace: komodo
spec:
  selector:
    app: komodo
  ports:
  - port: 9120
    targetPort: 9120
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: komodo
  namespace: komodo
  annotations:
    kubernetes.io/ingress.class: caddy
    caddy.ingress.kubernetes.io/enable-tls: "true"
    caddy.ingress.kubernetes.io/tls: internal
spec:
  ingressClassName: caddy
  rules:
  - host: $KomodoHost
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: komodo
            port:
              number: 9120
"@ | kubectl apply -f -
    
    Write-Host "Komodo installed. Waiting for deployment..." -ForegroundColor Green
    Exec kubectl "-n komodo rollout status deploy/komodo --timeout=180s"
}

Write-Host "`nDone!" -ForegroundColor Green
Write-Host "- App URL:        https://$AppHost" -ForegroundColor Green
if ($InstallKomodo) {
    Write-Host "- Komodo URL:     https://$KomodoHost" -ForegroundColor Green
}

Write-Host "`nTips:" -ForegroundColor DarkGray
Write-Host "- If the browser warns about local CA, trust Caddy's local CA for development." -ForegroundColor DarkGray
Write-Host "- Both frontend and backend now use HTTPS internally for end-to-end encryption." -ForegroundColor DarkGray
