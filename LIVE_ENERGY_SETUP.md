# Live energiedashboard — installatie

Het dashboard haalt gegevens server-side op en publiceert alleen een openbare JSON-snapshot op `data/energy-live.json`. API-sleutels worden nooit in browsercode opgenomen.

## 1. GitHub Actions secrets toevoegen

Open de repository **Settings → Secrets and variables → Actions → New repository secret** en voeg deze geheimen toe:

- `NED_API_KEY`: API-sleutel van je persoonlijke Nationaal Energie Dashboard-account. De API-handleiding vermeldt dat deze sleutel via de header `X-AUTH-TOKEN` wordt meegestuurd.
- `KNMI_API_KEY`: API-sleutel voor de KNMI EDR API (ook een anonieme sleutel kan worden aangevraagd).
- `TENNET_API_KEY`: API-sleutel voor TenneT Settlement Prices API, gevraagd via het officiële developerportaal.

De waarden zijn persoonlijk en horen niet in bestanden of chatberichten te worden gezet. Deel ze niet met bezoekers.

## 2. Eenmalig de workflow starten

Ga naar **Actions → Refresh public energy dashboard → Run workflow**. De workflow wordt daarna iedere 15 minuten ingepland. GitHub Actions kan geplande workflows soms later uitvoeren.

## 3. Wat wordt gepubliceerd

- NED: Nederlandse zonne-opwek, windopwek en elektriciteitsvraag. De API bevat near-real-time gegevens op 10-minutenniveau.
- KNMI: temperatuur, globale zonnestraling en windsnelheid bij station De Bilt uit het 10-minutendataset. Dit zijn snelle, nog niet gevalideerde waarnemingen.
- TenneT: laatst gepubliceerde onbalans-settlementprijzen per balanceringsperiode; deze zijn niet hetzelfde als actuele consumentenprijzen.
- PVGIS: langjarige referentieberekening van 1 kWp in Midden-Nederland, zuidgericht op 35 graden met 14% systeemverlies. Dit is een modeluitkomst, geen live meting. Deze uitkomst wordt maximaal eens per 30 dagen ververst.

## 4. Publicatie

De workflow commit alleen de JSON-snapshot. De bestaande GitHub Pages-deployworkflow publiceert die wijziging automatisch. Als een bron niet is geconfigureerd of tijdelijk niet bereikbaar is, toont het dashboard de status in plaats van fictieve waarden.
