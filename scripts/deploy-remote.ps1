param(
  [string]$DockerContext = "lemon-remote",
  [string]$DockerHost = "",
  [string]$TargetHost = ""
)

$ErrorActionPreference = "Stop"

function Resolve-TargetHost {
  param(
    [string]$ExplicitHost,
    [string]$Endpoint
  )
  if ($ExplicitHost) { return $ExplicitHost }
  if (-not $Endpoint) { return "192.168.1.100" }
  $cleaned = $Endpoint -replace '^(?:tcp|ssh)://', ''
  $cleaned = $cleaned -replace '^[^@]+@', ''
  $cleaned = $cleaned -replace ':\d+$', ''
  $cleaned = $cleaned -replace '/.*$', ''
  if ($cleaned) { return $cleaned }
  return "192.168.1.100"
}

$env:HTTP_PROXY = $null
$env:HTTPS_PROXY = $null
$env:http_proxy = $null
$env:https_proxy = $null

$dockerArgs = @()
if ($DockerHost) {
  $env:DOCKER_HOST = $DockerHost
  $endpoint = $DockerHost
  $dockerTargetLabel = $DockerHost
} else {
  $env:DOCKER_HOST = $null
  $dockerArgs = @("--context", $DockerContext)
  $endpoint = (& docker context inspect $DockerContext --format "{{.Endpoints.docker.Host}}" 2>$null)
  if ($LASTEXITCODE -ne 0 -or -not $endpoint) {
    throw "Docker context '$DockerContext' is not configured. Run: docker context create $DockerContext --docker `"host=ssh://Ilege@192.168.1.100`""
  }
  $dockerTargetLabel = "context '$DockerContext' ($endpoint)"
}

$hostIp = Resolve-TargetHost -ExplicitHost $TargetHost -Endpoint $endpoint
$noProxyItems = @($env:NO_PROXY -split ',' | Where-Object { $_ -and $_.Trim() -ne '' })
foreach ($item in @("localhost", "127.0.0.1", $hostIp)) {
  if ($noProxyItems -notcontains $item) {
    $noProxyItems += $item
  }
}
$env:NO_PROXY = ($noProxyItems -join ',')
$env:no_proxy = $env:NO_PROXY

Write-Host "🏗️ Building Angular production bundle (dist/lemon-universe)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
  throw "Angular build failed with exit code $LASTEXITCODE"
}

Write-Host "🧠 Building local neuron packages & NestJS API (server/dist)..." -ForegroundColor Cyan
$neuronPackages = @(
  "..\lemon-actions\packages\lemon-seasons-neurons",
  "..\lemon-actions\packages\lemon-media-hub-neurons"
)
$depsDir = Join-Path $PSScriptRoot "..\server\.docker-deps"
if (Test-Path $depsDir) { Remove-Item -Recurse -Force $depsDir }
New-Item -ItemType Directory -Path $depsDir | Out-Null

foreach ($pkg in $neuronPackages) {
  $pkgPath = Resolve-Path (Join-Path (Join-Path $PSScriptRoot "..") $pkg)
  npm --prefix $pkgPath run build
  if ($LASTEXITCODE -ne 0) { throw "Build failed for $pkg" }
  Push-Location $depsDir
  npm pack $pkgPath | Out-Null
  Pop-Location
  if ($LASTEXITCODE -ne 0) { throw "npm pack failed for $pkg" }
}

npm --prefix server run build
if ($LASTEXITCODE -ne 0) {
  throw "NestJS server build failed with exit code $LASTEXITCODE"
}

Write-Host "🚀 Building & starting Lemon Universe stack on $dockerTargetLabel ..." -ForegroundColor Cyan
docker @dockerArgs compose -p lemon-universe -f docker-compose.remote.yml build postgres api web
$buildExit = $LASTEXITCODE
if (Test-Path $depsDir) { Remove-Item -Recurse -Force $depsDir }
if ($buildExit -ne 0) { throw "docker compose build failed (exit code $buildExit)" }

docker @dockerArgs compose -p lemon-universe -f docker-compose.remote.yml up -d --remove-orphans
if ($LASTEXITCODE -ne 0) { throw "docker compose up failed" }

Write-Host "✅ Active containers on ${dockerTargetLabel}:" -ForegroundColor Green
docker @dockerArgs compose -p lemon-universe -f docker-compose.remote.yml ps

Write-Host "==> Verifying Lemon Universe endpoints on $hostIp ..." -ForegroundColor Cyan
Start-Sleep -Seconds 3
$health = Invoke-RestMethod -Uri "http://$($hostIp):3010/api/health" -TimeoutSec 10
Write-Host "    API /api/health: $($health | ConvertTo-Json -Compress)" -ForegroundColor Green

$swagger = Invoke-RestMethod -Uri "http://$($hostIp):3010/api/docs-json" -TimeoutSec 10
Write-Host "    Swagger /api/docs-json paths: $($swagger.paths.PSObject.Properties.Count)" -ForegroundColor Green

$mcpHealth = Invoke-RestMethod -Uri "http://$($hostIp):4320/mcp" -TimeoutSec 10
Write-Host "    MCP :4320/mcp: $($mcpHealth | ConvertTo-Json -Compress)" -ForegroundColor Green

$webResp = Invoke-WebRequest -Uri "http://$($hostIp):4210/" -UseBasicParsing -TimeoutSec 10
Write-Host "    Web :4210/ status: $($webResp.StatusCode)" -ForegroundColor Green
