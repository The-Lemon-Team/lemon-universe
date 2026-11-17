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

Write-Host "🚀 Building & starting Lemon Universe stack on $DockerHost ..." -ForegroundColor Cyan
docker compose -p lemon-universe -f docker-compose.remote.yml build postgres api web
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
