$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$stateFile = Join-Path $projectRoot '.runtime\processes.json'
if (!(Test-Path -LiteralPath $stateFile)) { Write-Host 'No managed IntervueX processes found.'; exit }
$entries = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
foreach ($entry in ($entries | Sort-Object @{Expression={ if ($_.name -eq 'mongodb') { 1 } else { 0 } }})) {
    $process = Get-Process -Id $entry.pid -ErrorAction SilentlyContinue
    if (!$process -or $process.StartTime.ToUniversalTime().ToString('o') -ne $entry.started) { continue }
    if ($entry.name -eq 'mongodb') {
        Push-Location $projectRoot
        try { node scripts\stop-mongo.cjs } finally { Pop-Location }
        if ($LASTEXITCODE -ne 0) { throw 'Could not cleanly stop MongoDB. No database process was forcibly terminated.' }
    } else {
        # Only terminate the process tree recorded by this launcher and validated above.
        & taskkill.exe /PID $entry.pid /T /F | Out-Null
    }
}
'[]' | Set-Content -LiteralPath $stateFile
Write-Host 'IntervueX stopped. MongoDB data is preserved in .data\mongodb.'
