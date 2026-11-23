# Mijn Energie — besparingsmodel, persoonlijk advies en interactie

**Status:** ontwerpuitgangspunten voor de volgende ontwikkelfase  
**Doel:** een rustig, begrijpelijk persoonlijk energieoverzicht met controleerbare berekeningen. Geen cijfers tonen die de meetdata niet kan dragen.

## 1. Productuitgangspunt

Mijn Energie moet in één oogopslag drie vragen beantwoorden:

1. Hoe ontwikkelt mijn energiegebruik en wat heb ik aantoonbaar bespaard?
2. Wat betekent dit in euro's en milieueffect, met welke aannames?
3. Wat is één haalbare stap die ik deze week kan zetten?

Het startscherm blijft rustig. Technische details, uitgebreide grafieken en uitleg zijn beschikbaar achter een doorklik, niet allemaal tegelijk.

## 2. Vier verschillende uitkomsten — niet door elkaar halen

### A. Energiebesparing
Dit is de verandering in hoeveelheid energie, los van de energietarieven.

Voor een vergelijkbare periode:

`Besparing (kWh) = Genormaliseerd referentieverbruik - Gemeten werkelijk verbruik`

Voor gas geldt hetzelfde principe in m³. Negatieve uitkomsten blijven zichtbaar als hoger verbruik; de app poetst ze niet weg.

### B. Financieel effect
Een lagere rekening is niet automatisch een energiebesparing. De berekening moet daarom de prijscomponent afzonderlijk tonen.

- Bij een vast/variabel tarief: de bespaarde hoeveelheid vermenigvuldigen met het relevante marginale tarief.
- Bij een dynamisch tarief: het werkelijke verbruiksprofiel met de op dat tijdstip geldende tarieven vergelijken met het referentieprofiel.
- Vaste leveringskosten, netbeheerkosten en belastingkortingen niet presenteren als door de gebruiker gerealiseerde besparing.
- Teruglevering en eventuele terugleverkosten apart modelleren.
- Als tariefdata ontbreekt: wel kWh/m³ tonen, maar euro's als indicatie of niet beschikbaar markeren.

### C. Energie slimmer verschuiven
Een batterij of slim apparaat kan verbruik verplaatsen zonder minder kWh te gebruiken. Dat is geen energiebesparing. Toon dit apart als:
- verschoven verbruik (kWh);
- verandering in piekvermogen (kW);
- mogelijk financieel effect door andere gebruikstijden.

### D. CO₂-effect
Pas toevoegen wanneer de app actuele, passende emissiefactoren heeft per energiedrager en periode. Toon factor, bron en peildatum. Gebruik geen vaste universele factor zonder context.

## 3. Persoonlijke referentie en normalisatie

De eerste keuze is altijd het eigen huishouden als referentie, niet alleen een landelijk gemiddelde.

### Datavolwassenheid
- **Geen meterdata:** profielgebaseerde indicaties en praktische adviezen; nooit 'daadwerkelijk bespaard' claimen.
- **Korte meetreeks (minder dan 28 complete dagen):** alleen verbruikstrends; nog geen betrouwbare besparingsscore.
- **28 dagen tot 12 maanden:** voorlopige vergelijking met een vergelijkbare voorgaande periode en correctie voor weekdagen/meetdekking. Duidelijk labelen als indicatie.
- **12 maanden of langer:** seizoensvergelijking met dezelfde periode van het vorige jaar, met weerscorrectie voor weersafhankelijk gasverbruik. Dit is de basis voor sterkere uitspraken.
- **Na grote verandering:** bij verhuizing, extra bewoner, elektrische auto, warmtepomp, zonnepanelen, batterij of andere grote woningwijziging een nieuwe referentie voorstellen of de oude reeks segmenteren.

### Correcties
- **Weer:** gebruik graaddagen of een beter lokaal verwarmingsmodel voor ruimteverwarming. Corrigeer alleen het weersafhankelijke deel van gas; koken en warm tapwater worden niet blind mee-genormaliseerd.
- **Bewoners:** rekening houden met gewijzigde bewonersaantallen of een duidelijke wijziging in aanwezigheid wanneer de gebruiker dit aangeeft.
- **Woning:** woningtype, oppervlakte, bouwperiode, isolatie en verwarming helpen om adviezen en plausibiliteit te bepalen. Ze zijn geen vervanging voor gemeten referentiedata.
- **Opwek en opslag:** grid-import alleen is geen totaal huishoudverbruik. Voor een correcte elektriciteitsbalans moeten import, export, lokale opwek en batterijstromen uit elkaar worden gehouden.
- **EV en warmtepomp:** deze nieuwe elektrische belastingen segmenteren of als expliciete wijziging modelleren; anders lijkt extra elektrificatie ten onrechte op verslechtering.

### Datakwaliteit
Elke uitkomst krijgt intern een betrouwbaarheidsscore op basis van meetdekking, duur van de referentie, sensorvaliditeit, tijdsynchronisatie en toegepaste correcties. De interface toont een eenvoudig label zoals 'eerste indicatie', 'goede vergelijking' of 'nog onvoldoende gegevens' plus één zin uitleg.

Geen besparingsranglijst tonen als het huishouden niet aan de minimale datadekking en vergelijkbaarheid voldoet.

## 4. Hoe de gemiddelde besparing wordt berekend

De engine berekent eerst per energiedrager en dag:
- werkelijk netverbruik en teruglevering;
- werkelijk gasverbruik;
- lokaal opgewekte stroom en, waar beschikbaar, eigen verbruik;
- piekvermogen en laad-/ontlaadprofiel waar sensoren bestaan.

Daarna berekent hij een referentieverbruik voor dezelfde omstandigheden. Voor een huishouden met voldoende historie wordt het referentiemodel gebaseerd op eerdere meetperioden. Voor gas wordt de verwarmingscomponent gecorrigeerd voor buitentemperatuur/graaddagen. Voor elektriciteit worden veranderingen in bewoners en nieuwe elektrische apparaten herkenbaar gemaakt.

Per dag/maand wordt de afwijking berekend. De gemiddelden worden alleen over complete, geldige dagen genomen; gaten worden niet als nulverbruik behandeld. In weken en maanden met onvolledige data staat de datadekking naast de uitkomst.

**Belangrijk:** een daling van afname van het net kan ook komen door eigen zonnestroom of batterijgebruik. De app noemt dit pas verbruiksbesparing wanneer de totale energiebalans dit ondersteunt. Anders noemt zij het lagere netafname of slimmer gebruik.

## 5. Gepersonaliseerde verduurzamingstip per week

De eerste versie gebruikt een uitlegbare regels-engine, geen ondoorzichtige AI-selectie. Iedere tip bestaat uit:
- één concreet advies en één kleine actie;
- waarom deze tip bij deze woning of meettrend past;
- wat de gebruiker kan verwachten (indicatie of meetbaar doel);
- moeite, eventuele kosten en relevante randvoorwaarden;
- bron/onderbouwing en datum van laatste controle;
- knoppen: **Ga ik doen**, **Bewaar voor later**, **Past niet bij mij**.

### Voorbeelden van triggers
- Hoog nachtelijk basisverbruik → controleer apparaten die onnodig continu aanstaan.
- Veel zonnestroom terugleveren en een flexibel verbruiksmoment → verplaats een geschikt apparaat naar zonne-uren.
- Hoge piekbelasting → spreid niet-noodzakelijk gelijktijdig gebruik.
- Hoog weersgenormaliseerd gasverbruik → onderzoek eerst de grootste warmteverliezen of instellingen, afgestemd op het verwarmingssysteem.
- Geen meterdata → profielgebaseerde tip op basis van isolatie, verwarming of aanwezige apparaten; expliciet als profieladvies labelen.

Een tip wordt niet iedere week herhaald. Het systeem onthoudt wat getoond, uitgevoerd, uitgesteld of afgewezen is. Na een uitgevoerde tip volgt een terugblik op een vergelijkbare periode. Het effect wordt alleen gemeten als de meetdekking voldoende is en andere grote veranderingen zijn meegewogen.

## 6. Besparingsgeschiedenis en lichte interactie

De geschiedenis wordt één eenvoudige tijdlijn met filters voor week, maand en jaar:
- werkelijk stroom- en gasverbruik;
- vergelijking met de eigen referentie;
- eventuele financiële indicatie;
- uitgevoerde acties en de datum;
- meetdekking en datakwaliteit.

Kleine mijlpalen kunnen worden toegevoegd, bijvoorbeeld een maand met geldige metingen, een actie afgerond of een eigen doel gehaald. Geen punten of badges uitdelen op basis van fictieve demo-data of onbewezen besparingen.

Een doel kan bijvoorbeeld zijn: '5% minder gas per graaddag deze winter'. Doelen worden gekoppeld aan een geldige referentie, anders zijn ze alleen informatief.

## 7. Rustige schermstructuur

### Overzicht
Bovenaan maximaal drie compacte kaarten:
1. **Energie deze maand** — werkelijk verbruik en verandering versus eigen referentie.
2. **Besparing** — kWh/m³ en apart een euro-indicatie.
3. **Datakwaliteit** — hoe betrouwbaar is deze vergelijking?

Daaronder:
- één prominente weektip;
- een compacte 8–12 weken trendgrafiek;
- link **Bekijk mijn geschiedenis**.

### Geschiedenis
Een eenvoudige lijn-/staafgrafiek en een lijst met veranderingen en uitgevoerde acties. Niet meerdere dashboards boven elkaar.

### Huishouden
Woning- en apparatuursituatie, plus wijzigingen die van invloed zijn op de referentie.

### Koppelingen
Verbindingstatus, toestemming en intrekken per gegevensbron.

### Challenges
Een aparte sociale ruimte. Challenges mogen persoonlijke ruwe meetdata niet tonen.

## 8. Interne beheerapplicatie

Een afgeschermde beheeromgeving moet beheerders in staat stellen om:
- de tipbibliotheek te beheren en tips per woningtype/installatie te activeren;
- de regels, drempels en versies van de besparingsberekening te beheren;
- energieprijzen en emissiefactoren inclusief bron en geldigheidsperiode te beheren;
- datakwaliteit, mislukte ingestie en achterstallige berekeningen te monitoren;
- wijzigingen in regels en factoren te auditen.

Beheerders wijzigen nooit stilzwijgend ruwe huishoudmeetdata. Nieuwe rekenregels krijgen een versie; herberekeningen bewaren welke versie en welke factoren zijn gebruikt.

## 9. Voorgestelde bouwvolgorde

1. **Datalaag:** dagaggregaten, referentieperioden, datakwaliteit en versiebeheer voor tarieven/emissiefactoren.
2. **Besparingsengine:** eerst kWh/m³ versus persoonlijke referentie; daarna weerscorrectie en financiële effecten.
3. **Geschiedenis:** eerste echte grafiek en tijdlijn op basis van meetdata.
4. **Tipbibliotheek:** inhoud, bronnen en uitlegbare regels; één tip per week, met feedback en actiestatus.
5. **Beheeromgeving:** tipbeheer, rekenfactoren, kwaliteitsmonitoring en auditlog.
6. **Interactie:** doelen en kleine mijlpalen zodra echte meetwaarden beschikbaar zijn.

Pas nadat een volledige meetketen end-to-end getest is, vervangen echte waarden de huidige demo-weergave.

## 10. Bronnen en technische randvoorwaarden

- Home Assistant HomeWizard-integratie: https://www.home-assistant.io/integrations/homewizard/
- HomeWizard API-voorwaarden en technische beperkingen: https://api-documentation.homewizard.com/docs/introduction/
- Measurement & Verification-baselines en normalisatie: https://www.energy.gov/sites/default/files/2024-03/femp-mv-5-0-guidelines_DRAFT.pdf

Dit zijn ontwerpprincipes. De definitieve algoritmen, Nederlandse emissiefactoren en tarieven moeten voor implementatie met actuele, passende Nederlandse bronnen worden ingevuld.
