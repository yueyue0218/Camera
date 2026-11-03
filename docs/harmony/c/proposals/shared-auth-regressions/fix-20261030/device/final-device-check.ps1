$ErrorActionPreference = 'Stop'
$cEmu = 'C:\Program Files\Huawei\DevEco Studio\tools\emulator\Emulator.exe'
$cHdc = 'C:\Program Files\Huawei\DevEco Studio\sdk\default\openharmony\toolchains\hdc.exe'
$cRun = $PSScriptRoot
function Read-CUi { (& $cEmu -instance 'Mate 90 Pro' -uiLayout -i) -join "`n" }
function Save-CUi([string]$label, [string]$ui) {
  [IO.File]::WriteAllText((Join-Path $cRun ($label + '.md')), $ui)
  Write-Output ($label.ToUpperInvariant() + '=PASS')
}
function Open-CTab([string]$label) {
  $cUi = Read-CUi
  $cMatch = [regex]::Match($cUi, ('Button Button \[id:(\d+)\][^\n]*\r?\n\s+- Text ' + [regex]::Escape($label)))
  if (-not $cMatch.Success) { throw ('Tab missing: ' + $label) }
  $null = & $cEmu -instance 'Mate 90 Pro' -click $cMatch.Groups[1].Value
  Read-CUi
}
function Restart-CApp {
  $null = & $cHdc -t 127.0.0.1:5555 shell aa force-stop com.portra.app
  $null = & $cHdc -t 127.0.0.1:5555 shell aa start -a EntryAbility -b com.portra.app
}
function Assert-CActor([string]$ui) {
  if ($ui -notmatch 'C本地双身份验收用户' -or $ui -notmatch 'Button 切换到摄影师') {
    throw 'Expected dedicated ordinary CUSTOMER identity'
  }
}
$cUi = Open-CTab '我的'
if ($cUi -notmatch 'C本地双身份验收用户') { throw 'Normal test login missing' }
$cSwitch = [regex]::Match($cUi, 'Button 切换到约拍用户 \[id:(\d+)\]')
if ($cSwitch.Success) {
  $null = & $cEmu -instance 'Mate 90 Pro' -click $cSwitch.Groups[1].Value
  $cUi = Read-CUi
}
Assert-CActor $cUi
Save-CUi 'final-normal-login-customer' $cUi
Restart-CApp
$cUi = Open-CTab '我的'
Assert-CActor $cUi
Save-CUi 'final-cold-restored-customer' $cUi
try {
  $null = & $cHdc -t 127.0.0.1:5555 fport rm tcp:18090 tcp:18090
  $cPorts = (& $cHdc -t 127.0.0.1:5555 fport ls) -join "`n"
  if ($cPorts -match 'tcp:18090 tcp:18090') { throw 'Offline mapping removal failed' }
  Restart-CApp
  $cUi = Open-CTab '动态'
  if ($cUi -notmatch 'Button 去登录') { throw 'Offline restore must fail closed' }
  Save-CUi 'final-offline-cold-guest' $cUi
} finally {
  $null = & $cHdc -t 127.0.0.1:5555 rport tcp:18090 tcp:18090
}
Restart-CApp
$cUi = Open-CTab '我的'
Assert-CActor $cUi
Save-CUi 'final-online-recovered-customer' $cUi
$null = & $cHdc -t 127.0.0.1:5555 shell uitest uiInput keyEvent Home
$null = & $cHdc -t 127.0.0.1:5555 shell aa start -a EntryAbility -b com.portra.app
$cUi = Read-CUi
Assert-CActor $cUi
Save-CUi 'final-foreground-customer' $cUi
$null = & $cHdc -t 127.0.0.1:5555 shell uitest uiInput swipe 640 2200 640 750 800
$cUi = Read-CUi
$cLogout = [regex]::Match($cUi, 'Button 退出登录 \[id:(\d+)\] \[top: (\d+)')
if (-not $cLogout.Success -or [int]$cLogout.Groups[2].Value -gt 2650) { throw 'Logout button not visible' }
$null = & $cEmu -instance 'Mate 90 Pro' -click $cLogout.Groups[1].Value
$cUi = Open-CTab '动态'
if ($cUi -notmatch 'Button 去登录') { throw 'Logout did not clear current authentication' }
Save-CUi 'final-logout-guest' $cUi
Restart-CApp
$cUi = Open-CTab '动态'
if ($cUi -notmatch 'Button 去登录' -or $cUi -match 'C本地双身份验收用户') {
  throw 'Signed-out identity restored after cold start'
}
Save-CUi 'final-logout-cold-guest' $cUi
$null = & $cEmu -instance 'Mate 90 Pro' -screenshot -screenshotPath $cRun
Write-Output 'FINAL_NATIVE_AUTH_CHECK=PASS'
