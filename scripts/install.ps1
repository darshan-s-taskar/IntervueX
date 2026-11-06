$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$env:npm_config_cache = Join-Path $projectRoot '.cache\npm'
Push-Location $projectRoot
try {
    npm.cmd ci --prefix Backend --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed.' }
    npm.cmd ci --prefix Frontend --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
    node scripts\configure-env.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Environment initialization failed.' }
} finally { Pop-Location }
