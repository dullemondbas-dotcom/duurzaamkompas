# Energie Challenge — status eerste prototype

## Wat is gebouwd
- Een responsive Mijn Energie-interface in de bestaande DuurzaamKompas-huisstijl.
- Dashboard met expliciet fictieve voorbeeldwaarden.
- Huishoudenprofiel met woning- en apparatuurvragen.
- Lokale opslag van profielinstellingen in de browser.
- Challenges-overzicht met demo-ranglijst, filters en lokaal aanmaken van een testchallenge.
- Koppelingenpagina met uitleg over de beoogde Home Assistant-integratie.
- Link vanaf de publieke homepage en hoofdmenu.

## Wat werkt
- Navigeren tussen de vier app-onderdelen.
- Profiel invullen, opslaan en opnieuw laden op hetzelfde apparaat/browserprofiel.
- Nickname doorvoeren naar de dashboardkop en voorbeeldranglijst.
- Demo-challenges filteren en lokaal aanmaken.
- Prototype-notitie verbergen en lokaal resetten.

## Wat nadrukkelijk nog niet werkt
- Geen echte accounts of centrale database.
- Geen online groepscompetities, uitnodigingen of gedeelde ranglijsten.
- Geen echte energiemetingen, slimme-meterkoppeling of Home Assistant-verbinding.
- Geen echte besparingsberekeningen of betrouwbare challenge-score.
- Geen synchronisatie tussen apparaten of gebruikers.
- Geen e-mail, marketing, partnerverwijzingen of betaalfuncties.

## Volgende noodzakelijke technische stap
1. Supabase-project configureren voor Auth en PostgreSQL.
2. Schema en Row Level Security policies ontwerpen en testen.
3. Publieke app-URL en redirect/callback-instellingen vastleggen.
4. Frontend verbinden met Supabase zonder service-role key in browsercode.
5. Home Assistant-integratie met afzonderlijke intrekbare per-huishouden toegangssleutel ontwikkelen.
6. Datavalidatie, meetfrequenties, privacy, bewaartermijnen en verwijderprocessen testen.
7. Echte competitie-resultaten pas activeren als datakwaliteit en scoreformule zijn gevalideerd.

**Waarschuwing:** dit prototype gebruikt localStorage. Dit is uitsluitend geschikt voor demonstratie en niet voor gevoelige energiegegevens of productieaccounts. De app mag daarom nog niet als live accountplatform worden gepresenteerd.
