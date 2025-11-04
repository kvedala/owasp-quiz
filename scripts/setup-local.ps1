param(
  [string]$ClusterName = "owasp-quiz",
  [switch]$RecreateCluster,
  [switch]$BuildImages,
  [string]$Namespace = "owasp-quiz",
  [string]$AppHost = "quiz.localhost"
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
  Write-Host "Detected Docker Desktop Kubernetes." -ForegroundColor Green
  if ($BuildImages) {
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
}

Write-Host "Installing NGINX Ingress Controller via Helm..." -ForegroundColor Green
# Ensure target namespace exists (same as app namespace)
if (-not (Test-Namespace $Namespace)) { 
  Exec kubectl "create namespace $Namespace" 
}

# Uninstall Caddy if present in app namespace
$caddyInApp = & helm list -n $Namespace -q 2>$null
if ($LASTEXITCODE -eq 0 -and $caddyInApp -and ($caddyInApp -split "`n") -contains 'caddy') {
  Write-Host "Uninstalling existing Caddy ingress controller..." -ForegroundColor Yellow
  Exec helm "uninstall caddy -n $Namespace"
}

# Add ingress-nginx Helm repo and install in the app namespace
Exec helm "repo add ingress-nginx https://kubernetes.github.io/ingress-nginx"
Exec helm "repo update"
Exec helm "upgrade --install ingress-nginx ingress-nginx/ingress-nginx --namespace $Namespace --wait --timeout=300s"

Write-Host "NGINX Ingress Controller installed in namespace '$Namespace'." -ForegroundColor Green

$ChartPath = Join-Path $RepoRoot "helm/owasp-quiz"

# Use Docker Desktop values if detected, otherwise use local-kind values
if ($isDockerDesktop) {
    $LocalValues = Join-Path $ChartPath "values.local-docker-desktop.yaml"
}
else {
    $LocalValues = Join-Path $ChartPath "values.local-kind.yaml"
}

if (-not (Test-Path $LocalValues)) { throw "Local values file not found: $LocalValues" }

Write-Host "Updating chart dependencies..." -ForegroundColor Green
Exec helm "dependency update `"$ChartPath`""

Write-Host "Deploying chart to https://$AppHost ..." -ForegroundColor Green
Exec helm "upgrade --install owasp-quiz $ChartPath -n $Namespace --create-namespace -f `"$LocalValues`" --set kubernetes-dashboard.enabled=true --set kubernetes-dashboard.ingress.enabled=true --dependency-update"

Write-Host "Using NGINX Ingress Controller default TLS certificate for local HTTPS." -ForegroundColor Yellow

Write-Host "Waiting for app deployments to become ready..." -ForegroundColor Green
Exec kubectl "-n $Namespace rollout status deploy/quiz-backend --timeout=180s"
Exec kubectl "-n $Namespace rollout status deploy/quiz-frontend --timeout=180s"
try {
  Exec kubectl "-n $Namespace rollout status deploy/kubernetes-dashboard --timeout=180s"
} catch {
  Write-Host "Kubernetes Dashboard deployment not found (may be disabled)." -ForegroundColor Yellow
}

Write-Host "`nDone!" -ForegroundColor Green
Write-Host "- App URL:               https://$AppHost" -ForegroundColor Green
Write-Host "- Kubernetes Dashboard:  https://k8s.localhost" -ForegroundColor Green

try {
  $dashToken = (kubectl -n $Namespace create token admin-user 2>$null)
  if ($LASTEXITCODE -eq 0 -and $dashToken) {
    Write-Host "\nKubernetes Dashboard token:" -ForegroundColor Yellow
    Write-Host $dashToken -ForegroundColor Cyan
  } else {
    Write-Host "\nRun to get dashboard token:" -ForegroundColor Yellow
    Write-Host "kubectl -n $Namespace create token admin-user" -ForegroundColor Cyan
  }
}
catch {
  Write-Host "\nTo get a dashboard token later:" -ForegroundColor Yellow
  Write-Host "kubectl -n $Namespace create token admin-user" -ForegroundColor Cyan
}

Write-Host "`nTips:" -ForegroundColor DarkGray
Write-Host "- Self-signed certs are used locally; add a browser exception if prompted." -ForegroundColor DarkGray
Write-Host "- Both frontend and backend use HTTPS internally for end-to-end encryption." -ForegroundColor DarkGray
