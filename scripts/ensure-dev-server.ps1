# Start the local site on http://127.0.0.1:5173/ if it is not already up.
# Windows runs this at sign-in, and again every few minutes, so a shutdown
# does not leave the address refused.
$ErrorActionPreference = 'Stop'

$project = 'C:\Users\ytt\Desktop\chinese-workbench'
$logDir = Join-Path $env:LOCALAPPDATA 'zhiwei-dev'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir 'ensure.log'
$mutex = New-Object System.Threading.Mutex($false, 'Local\ZhiweiDevEnsure')

function Write-Log([string]$message) {
  $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message
  Add-Content -Path $log -Value $line -Encoding utf8
}

function Test-Site {
  try {
    $response = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 3
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not $mutex.WaitOne(0)) {
  exit 0
}

try {
  if (Test-Site) {
    Write-Log 'already up'
    exit 0
  }

  $node = @(
    'C:\Program Files\nodejs\node.exe',
    (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe')
  ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

  $vite = Join-Path $project 'node_modules\vite\bin\vite.js'
  if (-not $node) {
    Write-Log 'node.exe not found'
    exit 1
  }
  if (-not (Test-Path $vite)) {
    Write-Log 'vite.js not found'
    exit 1
  }

  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $outLog = Join-Path $logDir "vite-$stamp.out.log"
  $errLog = Join-Path $logDir "vite-$stamp.err.log"
  Write-Log "starting $vite"
  Start-Process -FilePath $node `
    -ArgumentList @($vite, '--host', '127.0.0.1', '--port', '5173', '--strictPort') `
    -WorkingDirectory $project `
    -WindowStyle Hidden `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog

  $deadline = (Get-Date).AddSeconds(30)
  do {
    Start-Sleep -Seconds 1
    if (Test-Site) {
      Write-Log 'ready'
      exit 0
    }
  } while ((Get-Date) -lt $deadline)

  Write-Log 'timed out waiting for port 5173'
  exit 1
} finally {
  $mutex.ReleaseMutex() | Out-Null
  $mutex.Dispose()
}
