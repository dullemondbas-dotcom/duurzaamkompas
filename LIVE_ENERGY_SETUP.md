# Live energiedashboard — installatie

Het dashboard haalt KNMI-waarnemingen server-side op en publiceert alleen een openbare JSON-snapshot op `data/energy-live.json`. De KNMI API-sleutel wordt alleen in GitHub Actions gebruikt en nooit naar de browser gestuurd.

## 1. KNMI API-sleutel toevoegen

Open de repository in GitHub: **Settings → Secrets and variables → Actions → New repository secret**.

Voeg deze repository secret toe:

- `KNMI_API_KEY`: API-sleutel voor de KNMI EDR API. KNMI biedt ook een anonieme sleutel aan voor normaal gebruik. De dataset wordt gebruikt onder de datasetlicentie; voor de meeste KNMI-datasets is dat CC BY 4.0. De website vermeldt KNMI als bron en linkt naar de dataset.

## 2. Eenmalig de workflow starten

Ga naar **Actions → Refresh public energy dashboard → Run workflow**. De workflow wordt daarna iedere 15 minuten ingepland. GitHub Actions kan geplande workflows soms later uitvoeren.

## 3. Waarom NED en TenneT nog niet live worden doorgegeven

De algemene voorwaarden van Nationaal Energie Dashboard verbieden het kopiëren of distribueren van hun Product aan derden zonder voorafgaande toestemming. De API-sleutel is bovendien persoonlijk. TenneT verbiedt het distribueren of delen van API-data met derden, tenzij dit expliciet is toegestaan in de API-documentatie.

DuurzaamKompas is een openbaar platform. Daarom publiceren we geen NED- of TenneT-API-data voordat de benodigde schriftelijke toestemming of overeenkomst is geregeld. De pagina toont de bronstatus en verwijst naar de voorwaarden. Er wordt geen persoonlijke API-sleutel van NED of TenneT opgevraagd of in GitHub opgeslagen.

Officiële voorwaarden:
- [NED algemene voorwaarden](https://ned.nl/nl/algemene-voorwaarden)
- [TenneT API Fair Use Policy](https://developer.tennet.eu/fair-use-policy)

## 4. Wat wordt gepubliceerd

- KNMI: temperatuur, globale zonnestraling en windsnelheid bij station De Bilt uit het 10-minutendataset. Dit zijn snelle, nog niet gevalideerde waarnemingen.
- PVGIS: langjarige referentieberekening van 1 kWp in Midden-Nederland, zuidgericht, 35° helling en 14% systeemverlies. Dit is een modeluitkomst, geen live meting. Deze uitkomst wordt maximaal eens per 30 dagen opnieuw berekend.
- NED en TenneT: broninformatie en statusmelding totdat openbare doorgifte schriftelijk is toegestaan.

## 5. Publicatie

De workflow commit de JSON-snapshot en publiceert het dashboard opnieuw via GitHub Pages wanneer gegevens veranderen. Bij een ontbrekende sleutel of tijdelijke storing toont het dashboard de status in plaats van fictieve waarden.
