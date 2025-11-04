param(
  [string]$Namespace = "owasp-quiz",
  [string]$AppHost = "quiz.pspservicesco.com",
  [string]$KomodoHost = "komodo.quiz.pspservicesco.com",
  [ValidateSet("ClusterIssuer","Issuer")]
  [string]$IssuerKind = "ClusterIssuer",
  [string]$IssuerName = "letsencrypt-prod",
  [string]$IngressClass = "nginx",
  [switch]$InstallIngress,
  [switch]$CreateClusterIssuer,
  [switch]$Wait
)

$ErrorActionPreference = "Stop"

function Test-Command($name) { [bool](Get-Command $name -ErrorAction SilentlyContinue) }

function Exec($cmd, $arguments) {
  Write-Host "==> $cmd $arguments" -ForegroundColor Cyan
  $p = Start-Process -FilePath $cmd -ArgumentList $arguments -NoNewWindow -PassThru -Wait
  if ($p.ExitCode -ne 0) { throw "Command failed: $cmd $arguments (exit $($p.ExitCode))" }
}

if (-not (Test-Command kubectl)) { throw "'kubectl' is required but not found in PATH." }
if (-not (Test-Command helm)) { throw "'helm' is required but not found in PATH." }

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..")
$ChartPath = Join-Path $RepoRoot "helm/owasp-quiz"
$ValuesPath = Join-Path $ChartPath "values.prod.yaml"
if (-not (Test-Path $ValuesPath)) { throw "Missing values file: $ValuesPath" }

# Ensure namespace exists
$ns = & kubectl get ns $Namespace --ignore-not-found -o name 2>$null
if (-not $ns) { Exec kubectl "create namespace $Namespace" }

if ($InstallIngress) {
  Write-Host "Installing NGINX Ingress Controller (prod) ..." -ForegroundColor Yellow
  Exec helm "repo add ingress-nginx https://kubernetes.github.io/ingress-nginx"
  Exec helm "repo update"
  Exec helm "upgrade --install ingress-nginx ingress-nginx/ingress-nginx --namespace $Namespace --wait --timeout=300s"
  Write-Host "NGINX Ingress Controller installed in namespace '$Namespace'." -ForegroundColor Green
} else {
  Write-Host "Skipping ingress controller install (assumed pre-provisioned)." -ForegroundColor Yellow
}

if ($CreateClusterIssuer) {
  Write-Host "Creating $IssuerKind '$IssuerName' for Let's Encrypt (HTTP-01 via $IngressClass) ..." -ForegroundColor Yellow
  $issuerYaml = @"
apiVersion: cert-manager.io/v1
kind: $IssuerKind
metadata:
  name: $IssuerName
  namespace: $Namespace
spec:
  acme:
    email: soc@pspservicesco.com
    server: https://acme-v02.api.letsencrypt.org/directory
    privateKeySecretRef:
      name: ${IssuerName}-account-key
    solvers:
    - http01:
        ingress:
          class: $IngressClass
"@
  $issuerYaml | kubectl apply -f - | Out-Null
}

Write-Host "Deploying OWASP Quiz to https://$AppHost ..." -ForegroundColor Green
$setArgs = @(
  "--set", "ingress.host=$AppHost",
  "--set", "ingress.className=$IngressClass",
  "--set", "ingress.certManager.enabled=true",
  "--set", "ingress.certManager.issuerKind=$IssuerKind",
  "--set", "ingress.certManager.issuerName=$IssuerName",
  "--set", "ingress.tls.enabled=true"
)
if ($KomodoHost) {
  $setArgs += @("--set", "ingress.komodoHost=$KomodoHost", "--set", "ingress.komodoTls.enabled=true")
}

$helmArgs = @(
  "upgrade", "--install", "owasp-quiz", $ChartPath,
  "-n", $Namespace,
  "--create-namespace",
  "-f", $ValuesPath
) + $setArgs

Exec helm ($helmArgs -join ' ')

if ($Wait) {
  Write-Host "Waiting for deployments to be ready..." -ForegroundColor Green
  Exec kubectl "-n $Namespace rollout status deploy/quiz-backend --timeout=300s"
  Exec kubectl "-n $Namespace rollout status deploy/quiz-frontend --timeout=300s"
  Exec kubectl "-n $Namespace rollout status deploy/komodo --timeout=300s"
}

Write-Host "\nProd deploy complete." -ForegroundColor Green
Write-Host ("- App URL:        https://{0}" -f $AppHost) -ForegroundColor Green
if ($KomodoHost) { Write-Host ("- Komodo URL:     https://{0}" -f $KomodoHost) -ForegroundColor Green }

Write-Host "\nNotes:" -ForegroundColor DarkGray
Write-Host "- Ensure DNS A records for the host(s) point to your ingress controller." -ForegroundColor DarkGray
Write-Host "- cert-manager must be installed in the cluster; this script can create the issuer if you pass -CreateClusterIssuer." -ForegroundColor DarkGray
