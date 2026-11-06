$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $projectRoot '.runtime'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$stateFile = Join-Path $runtime 'processes.json'
if (Test-Path -LiteralPath $stateFile) {
    $old = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    foreach ($entry in $old) {
        $existing = Get-Process -Id $entry.pid -ErrorAction SilentlyContinue
        if ($existing -and $existing.StartTime.ToUniversalTime().ToString('o') -eq $entry.started) {
            throw 'IntervueX processes are already running. Use scripts\stop.ps1 first.'
        }
    }
}
$processes = [System.Collections.Generic.List[object]]::new()
function Start-TrackedProcess($name, $executable, $arguments, $directory) {
    $process = Start-Process -FilePath $executable -ArgumentList $arguments -WorkingDirectory $directory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime "$name.log") -RedirectStandardError (Join-Path $runtime "$name.error.log")
    $processes.Add([pscustomobject]@{ name=$name; pid=$process.Id; started=$process.StartTime.ToUniversalTime().ToString('o') })
    ConvertTo-Json -InputObject @($processes.ToArray()) | Set-Content -LiteralPath $stateFile
}
function Wait-Port($port) {
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        $client = [Net.Sockets.TcpClient]::new()
        try { $client.Connect('127.0.0.1', $port); return } catch { Start-Sleep -Milliseconds 500 } finally { $client.Dispose() }
    }
    throw "Port $port did not become ready. Check .runtime logs."
}
$node = (Get-Command node -ErrorAction Stop).Source
$npmCli = Join-Path (Split-Path -Parent (Get-Command npm.cmd -ErrorAction Stop).Source) 'node_modules\npm\bin\npm-cli.js'
if (!(Test-Path -LiteralPath $npmCli)) { throw 'Could not locate npm-cli.js beside npm.cmd.' }
$backendEnv = Join-Path $projectRoot 'Backend\.env'
if (!(Test-Path -LiteralPath $backendEnv)) { throw 'Create Backend\.env using .env.example first.' }
$localDatabase = Select-String -LiteralPath $backendEnv -Pattern '^MONGO_URI=mongodb://127\.0\.0\.1:27017/' -Quiet
if ($localDatabase) {
    if (Get-NetTCPConnection -LocalPort 27017 -State Listen -ErrorAction SilentlyContinue) {
        throw 'Port 27017 is already occupied. This launcher will not take over an existing database.'
    }
    $mongod = Get-ChildItem (Join-Path $projectRoot '.tools') -Recurse -Filter mongod.exe | Select-Object -First 1
    if (!$mongod) { throw 'Portable MongoDB is missing from .tools.' }
    $dbPath = Join-Path $projectRoot '.data\mongodb'
    New-Item -ItemType Directory -Path $dbPath -Force | Out-Null
    Start-TrackedProcess 'mongodb' $mongod.FullName @('--dbpath', "`"$dbPath`"", '--bind_ip', '127.0.0.1', '--port', '27017') $projectRoot
    Wait-Port 27017
}
$apiPortLine = Select-String -LiteralPath $backendEnv -Pattern '^PORT=(\d+)$'
$apiPort = if ($apiPortLine) { [int]$apiPortLine.Matches.Groups[1].Value } else { 3000 }
foreach ($port in @($apiPort, 5173)) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
        throw "Port $port is already occupied. Check .runtime logs and stop the conflicting app."
    }
}
Start-TrackedProcess 'backend' $node @("`"$npmCli`"", 'run', 'dev') (Join-Path $projectRoot 'Backend')
Wait-Port $apiPort
Start-TrackedProcess 'frontend' $node @("`"$npmCli`"", 'run', 'dev') (Join-Path $projectRoot 'Frontend')
Wait-Port 5173
Write-Host 'IntervueX is running at http://localhost:5173'
Write-Host 'Logs: .runtime | Stop: powershell -ExecutionPolicy Bypass -File .\scripts\stop.ps1'
