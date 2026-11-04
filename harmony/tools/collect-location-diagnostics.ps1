param(
  [string]$Hdc = 'hdc',
  [string]$DeviceId = '',
  [string]$OutputPath = './location-diagnostics.json'
)
$ErrorActionPreference = 'Stop'
$targetArgs = @()
if ($DeviceId) { $targetArgs = @('-t', $DeviceId) }
# Read existing logs only. Never start an emulator, app, permission prompt or location request.
$raw = (& $Hdc @targetArgs shell hilog -x -t PortraPerf) -join "`n"
if ($LASTEXITCODE -ne 0) { throw 'Unable to read existing location diagnostics' }
$pattern = 'location\.(?:switch\.(?:unknown|on|off)|permission\.(?:result|dialog|reason)\.[0-9truefals.\-]+|permission\.(?:granted|denied)|coordinates\.(?:start|valid)|geocoder\.(?:start|resolved)|region\.published|(?:switch|permission|coordinates|geocoder|normalize|stale)\.failed\.\d+|failure\.[a-z\-]+\.code\.\d+|observer\.failed)'
$events = @([regex]::Matches($raw, $pattern) | ForEach-Object { $_.Value })
$buildRaw = (& $Hdc @targetArgs shell hilog -x -t PortraBuild) -join "`n"
$builds = @([regex]::Matches($buildRaw, '(?<![0-9a-f])[0-9a-f]{40}(?![0-9a-f])') | ForEach-Object { $_.Value } | Select-Object -Unique)
$record = [ordered]@{
  capturedAt = [DateTimeOffset]::Now.ToString('o')
  source = 'Existing device logs; no location request issued by this script'
  sourceCommits = $builds
  events = $events
  acceptance = 'Manual review required; log presence alone is not a passed scenario'
}
$record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $OutputPath -Encoding utf8
Write-Output "Saved $($events.Count) sanitized location events. No coordinates, addresses or credentials were collected."
