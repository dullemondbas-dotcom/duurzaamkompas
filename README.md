# DuurzaamKompas

Gratis Nederlandstalig consumentenplatform over thuisbatterijen, zonnepanelen, energiemanagement, laadoplossingen en de Nederlandse energiemarkt.

## Pagina's
- `index.html` — homepage en platformoverzicht
- `advies.html` + `advies.js` — interactieve vooradviesroute op basis van de woning, het verbruik, de doelen en de oriëntatiefase; antwoorden blijven in de browser
- `vergelijker.html` + `vergelijker.js` — batterijcatalogus, zoeken, vergelijken en scenariorekentool
- `kennisbank.html` — uitleg over batterijen, zonnepanelen, EMS, netcongestie, laden en veiligheid
- `regelgeving.html` — salderen, terugleveren, energiecontracten, registratie en regionale flexibiliteitsregelingen
- `keuzehulp.html` + `keuzehulp.js` — interactieve offerte- en aanschafchecklist
- `bronnen.html` — bronvermelding, redactionele werkwijze en commerciële transparantie
- `over.html` — missie en positionering
- `styles.css` — vormgeving en responsive layout
- `site.js` — navigatie, delen en automatisch jaartal
- `favicon.svg`, `robots.txt`, `sitemap.xml` — basis voor herkenning en vindbaarheid

## Gratis publiceren
GitHub Pages wordt via GitHub Actions gepubliceerd vanuit branch `main`. De workflow staat in `.github/workflows/deploy.yml`.

Website: https://dullemondbas-dotcom.github.io/duurzaamkompas/

## Adviesfilosofie
- Eerst de huishoudsituatie en het doel begrijpen, daarna pas producten of technieken vergelijken.
- De adviesroute mag ook concluderen dat extra meetgegevens of geen aankoop de verstandigste eerste stap is.
- Geen ranglijst die consumenten aanzet tot voortdurend wisselen van energieleverancier of aansturingspartij.
- Leveranciers en EMS-oplossingen worden alleen besproken op technische compatibiliteit, voorwaarden en relevante verschillen.
- Antwoorden uit de advieswizard worden lokaal in de browser verwerkt; ze gaan niet naar een server.

## Werkwijze voor inhoud
- Productwaarden alleen opnemen als de exacte modelvariant en fabrikantbron duidelijk zijn.
- Onbevestigde gegevens tonen als niet bevestigd.
- Regelgeving en marktinformatie voorzien van controledatum en primaire bron.
- Commerciële samenwerkingen later duidelijk labelen; ze mogen geen invloed hebben op technische gegevens of vergelijkingspositie.
- Rekentools als scenario-indicaties presenteren, niet als persoonlijk financieel advies.

## Belangrijke aandachtspunten voor vervolg
1. De productcatalogus uitbreiden met meer fabrikanten en per exacte uitvoering officiële datasheets controleren.
2. De dynamische gegevens (prijzen, garantie, compatibiliteit, softwarefuncties) periodiek controleren.
3. Verdere detailartikelen, een redactionele nieuwssectie en beheerfunctionaliteit toevoegen.
4. Contactgegevens en een privacyverklaring toevoegen voordat bezoekersgegevens of formulieren worden verzameld.

De website gebruikt momenteel geen account, database, nieuwsbriefinschrijving of analytische tracking. De checklist wordt alleen tijdelijk op de pagina bijgehouden en niet naar een server verzonden.
