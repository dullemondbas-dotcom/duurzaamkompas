# DuurzaamKompas

DuurzaamKompas is een gratis Nederlandstalig consumentenplatform over energie thuis en de Nederlandse energietransitie. De ambitie is om praktisch vooradvies, hulpmiddelen, onafhankelijke redactionele duiding en begrijpelijke kennis samen te brengen.

**Positionering:** grip op energie begint met inzicht. Eerst begrijpen, dan vergelijken en pas daarna beslissen.

**Website:** https://dullemondbas-dotcom.github.io/duurzaamkompas/

## Platformstructuur

- `index.html` — homepage en ingang naar het platform
- `slimme-apparaten.html` + `slimme-apparaten.js` — overzicht van slimme apparaten voor energie, comfort, automatisering, huishouden en veiligheid; filterbare apparaatbibliotheek met eerste aandachtspunten per categorie
- `advies.html` + `advies.js` — interactieve vooradviesroute op basis van woning, aansluiting, verbruik, doelen en plannen. De uitkomst is een eerste, regelgebaseerde richting; geen technisch ontwerp of persoonlijk financieel advies. Antwoorden blijven lokaal in de browser.
- `tools.html` — overzicht van de gratis hulpmiddelen en hun huidige status
- `vergelijker.html` + `vergelijker.js` — thuisbatterijcatalogus, zoeken, vergelijken en indicatieve scenariocalculator; onderdeel van de bredere bibliotheek Slimme apparaten
- `nieuws.html` — redactioneel overzicht van nieuws, achtergronden en uitlegdossiers. Dit is momenteel geen live nieuwsfeed.
- `verdieping.html` — geselecteerde externe podcasts, webinars, kennisartikelen en onderzoeken met een eigen korte toelichting, doelgroep- en belangencontext
- `kijken.html` + `kijken.js` — interactieve bibliotheek met video’s, webinars en podcasts; onderwerpfilters, zoekfunctie, lokale kijklijst en korte kennistest
- `onderzoek.html` — synthese van praktijkproeven, modelstudies, marktdata en wetenschappelijke publicaties; begint met conclusies in gewone taal, met uitklapbare onderzoeksblokken en bronnenregister voor wie dieper wil lezen
- `kennisbank.html` — beginnersvriendelijke consumentenkennisbank: per onderwerp eerst een korte uitleg in gewone taal, daarna optioneel open te klappen technische verdieping, voorbeelden en bronnen; inclusief eenvoudige begrippenlijst
- `regelgeving.html` — salderen, terugleveren, contracttypen, registratie, batterij-integratie, flexibiliteitsvergoedingen en relevante consumenteninformatie
- `keuzehulp.html` + `keuzehulp.js` — interactieve checklist om een aankoop- of offertegesprek voor te bereiden; de vinkjes worden lokaal opgeslagen
- `bronnen.html` — bronbeleid, redactionele werkwijze, commerciële transparantie en publicatiestatus
- `over.html` — missie, visie, platformprincipes en ontwikkelrichting

## Redactionele uitgangspunten

1. Consumentenbelang eerst: begin bij de woning, het verbruik, het doel en de echte vraag van de bezoeker.
2. Geen aankoop als standaardadvies: extra meten, de bestaande installatie optimaliseren of voorlopig niets kopen kan de beste eerste stap zijn.
3. Geen overstapwedstrijd: we zetten mensen niet aan tot voortdurend wisselen van energieleverancier of aansturingspartij.
4. Bronnen en belangen zichtbaar: onderscheid primaire onderzoeken, peer-reviewed publicaties, officiële instanties, journalistieke samenvattingen en commerciële bijdragen.
5. Geen schijnzekerheid: modelberekeningen, praktijkproeven en marktverwachtingen beantwoorden verschillende vragen. Benoem meetperiode, aannames, opdrachtgever en beperkingen.
6. Geen betaalde inhoudelijke voorkeur: eventuele commerciële samenwerkingen moeten herkenbaar zijn en mogen technische gegevens, beoordelingen of vergelijkingsposities niet beïnvloeden.
7. Correcties en controledatums: veranderlijke informatie moet opnieuw gecontroleerd worden; verouderde informatie mag niet als actueel worden gepresenteerd.

## Huidige technische status

De website is een statische site die via GitHub Actions op GitHub Pages wordt gepubliceerd vanuit de `main`-branch. De workflow staat in `.github/workflows/deploy.yml`. De huidige architectuur is bewust eenvoudig en kosteloos.

Op dit moment zijn er geen gebruikersaccounts, centrale database, live energieprijs-API, gekoppelde slimme meter, automatische nieuwsfeed, reviewformulier, nieuwsbriefsysteem of redactie-CMS. De adviesroute verwerkt antwoorden lokaal in de browser. De batterijcalculator geeft een scenario-indicatie op basis van ingevoerde aannames; geen garantie op besparing of terugverdientijd.

De nieuws-, onderzoeks-, verdiepings- en kijk/luisterpagina's zijn handmatig onderhouden. Externe podcasts, webinars en artikelen worden niet gekopieerd of gehost; de site biedt een korte eigen toelichting en linkt naar de oorspronkelijke maker. Video's en audio kunnen door de externe aanbieder worden gewijzigd of verwijderd.

## Product- en onderzoeksinformatie

- Productgegevens alleen publiceren voor een exact identificeerbare uitvoering en met een herleidbare fabrikantbron.
- Onbekende of onbevestigde kenmerken niet invullen met aannames.
- Geen marktgemiddelden, gebruikerservaringen of installatiedata suggereren zonder controleerbare herkomst en passende toestemming.
- Voor thuisbatterijen onderscheid maken tussen zelfconsumptie, day-aheadhandel, onbalanssturing en netbewuste flexibiliteit.
- Marktinkomsten als onzeker scenario presenteren en niet als gegarandeerde basis van een businesscase.
- Veiligheidsinformatie koppelen aan officiële bronnen zoals NIPV en Brandweer; geen algemene plaatsingsvoorschriften afleiden uit een incidentrapport.
- Bij RVO, ACM, CE Delft, TNO, NIPV, universiteiten en fabrikanten waar mogelijk direct linken naar primaire publicaties.

## Gratis publiceren

GitHub Pages wordt via GitHub Actions gepubliceerd vanuit branch `main`. Er worden geen betaalde functies of externe databasekosten gebruikt. Eventuele toekomstige uitbreiding met formulieren, accounts, live data of een CMS moet apart worden beoordeeld op kosten, privacy, onderhoud en betrouwbaarheid.

## Aandachtspunten voor vervolg

1. De batterij- en EMS-database uitbreiden met exacte Nederlandse modelvarianten en gecontroleerde compatibiliteit.
2. De onderzoeks- en kennisbibliotheek periodiek actualiseren, inclusief nieuwe webinars, publicaties en officiële cijfers.
3. Nieuwsartikelen voorzien van een auteur, publicatiedatum, controledatum, bronnen en correctiehistorie zodra een redactionele workflow beschikbaar is.
4. Een veilig en privacyvriendelijk systeem ontwerpen voor bezoekersinzendingen, offertes of meetdata voordat dergelijke gegevens worden verzameld.
5. Een eventuele nieuwsbrief pas toevoegen met een passende privacyverklaring en expliciete toestemming.
6. Voor live gegevens en een geautomatiseerde nieuwsvoorziening pas infrastructuur kiezen als er voldoende gebruik, onderhoudscapaciteit en budget is.

