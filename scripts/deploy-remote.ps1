param(
  [string]$DockerHost = "tcp://192.168.1.100:2375"
)

$ErrorActionPreference = "Stop"

$hostIp = ($DockerHost -replace '^tcp://', '' -replace ':\d+$', '')
$noProxyItems = @($env:NO_PROXY -split ',' | Where-Object { $_ -and $_.Trim() -ne '' })
if ($noProxyItems -notcontains $hostIp) {
  $noProxyItems += $hostIp
}
$env:NO_PROXY = ($noProxyItems -join ',')
$env:no_proxy = $env:NO_PROXY
$env:HTTP_PROXY = $null
$env:HTTPS_PROXY = $null
$env:http_proxy = $null
$env:https_proxy = $null
$env:DOCKER_HOST = $DockerHost

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

Write-Host "🚀 Building & starting Lemon Universe stack on $DockerHost ..." -ForegroundColor Cyan
docker compose -p lemon-universe -f docker-compose.remote.yml build postgres api web
if (Test-Path $depsDir) { Remove-Item -Recurse -Force $depsDir }
if ($LASTEXITCODE -ne 0) { throw "docker compose build failed" }

docker compose -p lemon-universe -f docker-compose.remote.yml up -d --remove-orphans
if ($LASTEXITCODE -ne 0) { throw "docker compose up failed" }

Write-Host "✅ Active containers on ${DockerHost}:" -ForegroundColor Green
docker compose -p lemon-universe -f docker-compose.remote.yml ps

Write-Host "==> Verifying Lemon Universe endpoints on $hostIp ..." -ForegroundColor Cyan
Start-Sleep -Seconds 3
$health = Invoke-RestMethod -Uri "http://$($hostIp):3010/api/health" -TimeoutSec 10
Write-Host "    API /api/health: $($health | ConvertTo-Json -Compress)" -ForegroundColor Green

$webResp = Invoke-WebRequest -Uri "http://$($hostIp):4210/" -UseBasicParsing -TimeoutSec 10
Write-Host "    Web :4210/ status: $($webResp.StatusCode)" -ForegroundColor Green
