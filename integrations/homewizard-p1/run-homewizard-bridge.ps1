$ErrorActionPreference = "Stop"
$bridge = Join-Path $PSScriptRoot "dk_homewizard_bridge.py"
$config = Join-Path $PSScriptRoot "duurzaamkompas-homewizard-config.json"
if (!(Test-Path $bridge)) { throw "Bridgebestand ontbreekt: $bridge" }
if (!(Test-Path $config)) { throw "Koppelconfiguratie ontbreekt: $config. Maak die eerst aan in Mijn Kompas." }
Set-Location $PSScriptRoot
python $bridge run --config $config
