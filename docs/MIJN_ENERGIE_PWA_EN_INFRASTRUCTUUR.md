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
Het project is actief in de EU (eu-west-1) en gekoppeld aan de publieke frontendconfiguratie in supabase-config.js.

Toegepaste migraties:
- supabase/migrations/202611230001_initial_mijn_energie.sql
- supabase/migrations/202611230002_mijn_energie_security_hardening.sql
- supabase/migrations/202611230003_challenge_member_index.sql
- supabase/migrations/202611230004_household_creation_rpc.sql
- supabase/migrations/202611230005_household_creation_rpc_permissions.sql
- supabase/migrations/202611230006_refresh_household_rpc_schema_cache.sql

De database bevat:
- profielen met unieke nickname;
- huishoudens, leden en woningprofielen;
- integratiemetadata zonder opgeslagen provider-token;
- private meetwaarden en geaggregeerde tijdreeksen;
- openbare en besloten challenges;
- challengeleden en server-berekende scores;
- toestemmingsregistratie.

Alle elf publieke tabellen hebben Row Level Security ingeschakeld. De security advisor gaf na de hardening geen RLS-bevindingen; de huidige waarschuwing betreft alleen de optionele controle op gelekte wachtwoorden. Anonieme rollen hebben geen SELECT-toegang tot de tabellen; challenge-scores zijn ook voor ingelogde gebruikers niet rechtstreeks uitleesbaar. De publieke leaderboard-RPC geeft uitsluitend nicknames en scoregegevens terug.

## Accountlaag
De frontend bevat:
- e-mailregistratie en bevestigingsmail;
- e-mail + wachtwoord inloggen;
- uitloggen;
- wachtwoord-herstellink en nieuw wachtwoord;
- Supabase sessieherstel;
- ophalen en opslaan van het huishoudprofiel, zodat het met dezelfde login op meerdere apparaten beschikbaar is.

Huishoudens worden aangemaakt via de RPC `create_my_household`. Deze functie haalt de eigenaar uitsluitend uit `auth.uid()` en accepteert geen gebruikers-ID vanuit de browser. De beveiligde hulpfunctie staat in het niet-blootgestelde `private`-schema. Alleen de ingelogde rol mag de RPC aanroepen. Dit voorkomt dat de browser rechtstreeks een eigenaar kan kiezen en lost de geconstateerde RLS-blokkade bij het aanmaken van huishoudens op.

De project-URL en publishable key zijn ingevuld in supabase-config.js. De publishable key is bedoeld voor frontendgebruik en mag publiek zijn. Gebruik nooit de service_role key, databasewachtwoord of provider-/Home Assistant-tokens in deze repository.

### Auth-instellingen in Supabase Dashboard
De Auth-instellingen kunnen niet via de gekoppelde beheerverbinding worden aangepast. De gebruikte URL-instellingen zijn:
- Site URL: https://dullemondbas-dotcom.github.io/duurzaamkompas/
- Redirect URL: https://dullemondbas-dotcom.github.io/duurzaamkompas/energie-challenge.html
- Password reset redirect: https://dullemondbas-dotcom.github.io/duurzaamkompas/energie-challenge.html?reset=1

E-mail/wachtwoord en e-mailbevestiging zijn voor de testomgeving ingeschakeld. Voor publiek gebruik moet nog een eigen SMTP-provider onder Authentication → SMTP Settings worden geconfigureerd; de standaard verzenddienst is alleen geschikt voor beperkte tests.

## Dataveiligheid
- Nooit een service_role key of Home Assistant-token in browser-JavaScript, GitHub Pages, localStorage of een openbare repository plaatsen.
- Provider-tokens horen in server-side secret storage, buiten browsercode en publieke tabellen.
- Challenge-ranglijsten tonen geen e-mail, woonadres of ruwe meetdata.
- De service worker cachet geen API-verzoeken of privégegevens.
- Meetdata, aggregaten en scores kunnen niet door gewone clients worden geschreven; ingestie en berekeningen vereisen server-side functies.

## Huidige status
De PWA werkt als installeerbare webapp, maar is geen native app uit de App Store/Google Play. Het eerste testaccount is aangemaakt en e-mailbevestiging en inloggen zijn gecontroleerd. De eerste opslagpogingen van het huishoudprofiel liepen vast doordat de directe huishoudinsert door RLS werd geweigerd. De beveiligde huishoud-RPC is toegevoegd; de volledige profielopslag moet na deze wijziging opnieuw met het testaccount worden gevalideerd.

Er is nog geen live meterdata, geen Home Assistant-ingestie en geen gedeelde live challenge-competitie.

## Volgende technische fasen
1. Huishoudprofiel opslaan en synchronisatie op een tweede apparaat controleren.
2. Home Assistant/P1-ingestie server-side bouwen, inclusief autorisatie en validatie.
3. Meetdata-aggregatie en persoonlijke energie-inzichten implementeren.
4. Online challenge-aanmaak, deelname en eerlijke scoreberekening implementeren.
