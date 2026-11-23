$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "run-homewizard-bridge.ps1"
if (!(Test-Path $script)) { throw "Startscript ontbreekt: $script" }
$taskName = "DuurzaamKompas HomeWizard P1"
$arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $script + '"'
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Start de lokale DuurzaamKompas HomeWizard P1-bridge bij aanmelden." -Force | Out-Null
Write-Host "Automatische HomeWizard-synchronisatie is ingesteld bij aanmelden."
