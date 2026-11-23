# Mijn Energie — PWA en infrastructuur

## PWA / mobiele app
De Energie Challenge is een Progressive Web App:
- energie-challenge.webmanifest bevat naam, startadres, thema, weergavemodus en snelkoppelingen.
- energie-challenge-sw.js cachet alleen de publieke app-shell voor offline openen.
- assets/energie-challenge-icon.svg en de PNG app-iconen zijn de app-iconen.
- Android, iPhone en desktop kunnen Mijn Energie toevoegen aan het beginscherm of als app installeren.
- Demo-challenges blijven lokaal in de browser. Ingelogde huishoudprofielen worden bij Supabase opgeslagen en opgehaald.

### Installeren
- Android / Chrome: open de app-URL, kies indien beschikbaar App installeren of via browsermenu Toevoegen aan startscherm.
- iPhone / iPad: open de URL in Safari, kies Deel en daarna Zet op beginscherm.
- Desktop Chrome/Edge: gebruik het installatie-icoon in de adresbalk of browsermenu wanneer dit verschijnt.

## Supabase backend
Het project is aangemaakt in de EU (eu-west-1), actief en gekoppeld aan de publieke frontendconfiguratie in supabase-config.js.

Toegepaste migraties:
- supabase/migrations/202611230001_initial_mijn_energie.sql
- supabase/migrations/202611230002_mijn_energie_security_hardening.sql

De database bevat:
- profielen met unieke nickname;
- huishoudens, leden en woningprofielen;
- integratiemetadata zonder opgeslagen provider-token;
- private meetwaarden en geaggregeerde tijdreeksen;
- openbare en besloten challenges;
- challengeleden en server-berekende scores;
- toestemmingsregistratie.

Alle elf publieke tabellen hebben Row Level Security ingeschakeld. De security advisor gaf na de hardening geen bevindingen. Anonieme rollen hebben geen SELECT-toegang tot de tabellen; challenge-scores zijn ook voor ingelogde gebruikers niet rechtstreeks uitleesbaar. De publieke leaderboard-RPC geeft uitsluitend nicknames en scoregegevens terug.

## Accountlaag
De frontend bevat:
- e-mailregistratie en bevestigingsmail;
- e-mail + wachtwoord inloggen;
- uitloggen;
- wachtwoord-herstellink en nieuw wachtwoord;
- Supabase sessieherstel;
- ophalen en opslaan van het huishoudprofiel, zodat het met dezelfde login op meerdere apparaten beschikbaar is.

De project-URL en publishable key zijn ingevuld in supabase-config.js. De publishable key is bedoeld voor frontendgebruik en mag publiek zijn. Gebruik nooit de service_role key, databasewachtwoord of provider-/Home Assistant-tokens in deze repository.

### Nog handmatig instellen in Supabase Dashboard
De Auth-instellingen kunnen niet via de gekoppelde beheerverbinding worden aangepast. Rond daarom dit laatste dashboardonderdeel af:
1. Open Authentication → URL Configuration.
2. Zet Site URL op:
   https://dullemondbas-dotcom.github.io/duurzaamkompas/
3. Voeg bij Redirect URLs toe:
   https://dullemondbas-dotcom.github.io/duurzaamkompas/energie-challenge.html
   https://dullemondbas-dotcom.github.io/duurzaamkompas/energie-challenge.html?reset=1
4. Open Authentication → Providers → Email en controleer of e-mail/wachtwoord aan staat en e-mailbevestiging is ingeschakeld.
5. Voor publiek gebruik: configureer een eigen SMTP-provider onder Authentication → SMTP Settings. De standaard verzenddienst is alleen geschikt voor beperkte tests.
6. Test registratie, bevestiging, login, wachtwoordherstel en profielsynchronisatie op twee verschillende apparaten.

De app gebruikt een browsergerichte impliciete Auth-flow, zodat een bevestigingslink ook op een ander apparaat kan worden geopend. De Supabase-client detecteert de sessie vanuit de URL-hash. De redirectallowlist hierboven moet dus overeenkomen met de app-URL.

De database is geïnstalleerd, maar bij controle stonden er nog nul app-gebruikers en nul huishoudprofielen in Auth en de publieke tabellen. Er is dus nog geen echte registratie/synchronisatie praktijktest uitgevoerd.

## Dataveiligheid
- Nooit een service_role key of Home Assistant-token in browser-JavaScript, GitHub Pages, localStorage of een openbare repository plaatsen.
- Provider-tokens horen in server-side secret storage, buiten browsercode en publieke tabellen.
- Challenge-ranglijsten tonen geen e-mail, woonadres of ruwe meetdata.
- De service worker cachet geen API-verzoeken of privégegevens.
- Meetdata, aggregaten en scores kunnen niet door gewone clients worden geschreven; ingestie en berekeningen vereisen server-side functies.

## Huidige status
De PWA werkt als installeerbare webapp, maar is geen native app uit de App Store/Google Play. Een native app store release kan later via Capacitor of een andere wrapper worden overwogen.

## Volgende technische fasen
1. Auth redirectinstellingen controleren en eerste testaccount aanmaken.
2. Registratie, login, wachtwoordherstel en profielsync daadwerkelijk testen.
3. Online challenge-aanmaak en deelname koppelen.
4. Server-side P1-ingestie, autorisatie en validatie bouwen.
5. Meetdata-aggregatie en eerlijke challenge-scoreberekening implementeren.
