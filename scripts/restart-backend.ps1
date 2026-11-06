$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $projectRoot '.runtime'
$stateFile = Join-Path $runtime 'processes.json'
$entries = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
$backend = $entries | Where-Object { $_.name -eq 'backend' }
if ($backend) {
    $process = Get-Process -Id $backend.pid -ErrorAction SilentlyContinue
    if ($process -and $process.StartTime.ToUniversalTime().ToString('o') -eq $backend.started) {
        & taskkill.exe /PID $backend.pid /T /F | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Unable to stop the managed backend.' }
    }
}
$node = (Get-Command node -ErrorAction Stop).Source
$npmCli = Join-Path (Split-Path -Parent (Get-Command npm.cmd -ErrorAction Stop).Source) 'node_modules\npm\bin\npm-cli.js'
$newProcess = Start-Process -FilePath $node -ArgumentList @("`"$npmCli`"", 'run', 'dev') -WorkingDirectory (Join-Path $projectRoot 'Backend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'backend.log') -RedirectStandardError (Join-Path $runtime 'backend.error.log')
$updated = @($entries | Where-Object { $_.name -ne 'backend' }) + @([pscustomobject]@{
    name = 'backend'; pid = $newProcess.Id; started = $newProcess.StartTime.ToUniversalTime().ToString('o')
})
ConvertTo-Json -InputObject $updated | Set-Content -LiteralPath $stateFile
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
        $health = Invoke-RestMethod 'http://localhost:3000/api/health'
        if ($health.database -eq 'connected') {
            Write-Host "Backend restarted. MongoDB connected; Gemini key present: $($health.geminiConfigured)."
            exit 0
        }
    } catch { Start-Sleep -Milliseconds 500 }
}
throw 'Backend did not become ready. Check .runtime logs.'
