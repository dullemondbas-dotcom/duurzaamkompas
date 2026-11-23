$ErrorActionPreference = "Stop"
$taskName = "DuurzaamKompas HomeWizard P1"
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "Automatische starttaak verwijderd."
