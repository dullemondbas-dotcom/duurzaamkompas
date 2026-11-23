# Mijn Energie — PWA en infrastructuur

## PWA / mobiele app
De Energie Challenge is voorbereid als Progressive Web App:
- energie-challenge.webmanifest bevat naam, startadres, thema, weergavemodus en snelkoppelingen.
- energie-challenge-sw.js cachet alleen de publieke app-shell voor offline openen.
- assets/energie-challenge-icon.svg en de PNG app-iconen zijn de app-iconen.
- energie-challenge.html bevat installatie-informatie en mobiele navigatie.
- Het profiel en zelfgemaakte demo-challenges worden nog lokaal in de browser bewaard.

### Installeren
- Android / Chrome: open de app-URL, kies indien beschikbaar App installeren of via browsermenu Toevoegen aan startscherm.
- iPhone / iPad: open de URL in Safari, kies Deel en daarna Zet op beginscherm.
- Desktop Chrome/Edge: gebruik het installatie-icoon in de adresbalk of browsermenu wanneer dit verschijnt.

PWA-installatie vereist HTTPS. De publieke GitHub Pages-URL gebruikt HTTPS.

## Supabase backend
Een voorbereid databaseschema staat in:
supabase/migrations/202611230001_initial_mijn_energie.sql

Het schema bevat:
- profielen met unieke nickname;
- huishoudens, leden en woningprofielen;
- integratiemetadata zonder opgeslagen provider-token;
- private meetwaarden en geaggregeerde tijdreeksen;
- openbare en besloten challenges;
- challengeleden en server-berekende scores;
- toestemmingsregistratie en beperkte intrekkingsfunctie.

Row Level Security staat aan voor alle tabellen. Meetdata, aggregaten, integratie-credentials en scores hebben geen schrijfbeleid voor gewone gebruikers. De daarvoor bedoelde verwerking moet via gecontroleerde server-side functies gebeuren.

### Nog benodigde handelingen voordat echte accounts werken
1. Maak een apart Supabase-project aan.
2. Pas de SQL-migratie toe via Supabase SQL Editor of Supabase CLI.
3. Stel Auth e-mailbevestiging, wachtwoordbeleid en redirect-URL's in.
4. Voeg alleen de Supabase project-URL en anon/publishable key toe aan de frontendconfiguratie; de service-role key blijft uitsluitend server-side.
5. Test RLS met minimaal twee testaccounts en huishoudens voordat echte gebruikers worden toegelaten.
6. Voeg accountaanmaak, login, wachtwoordherstel en profielsynchronisatie toe aan de app.
7. Voeg beveiligde server-side meetdata-ingestie en Home Assistant-authorisatie toe.

## Dataveiligheid
- Nooit een service-role key of Home Assistant-token in browser-JavaScript, GitHub Pages, localStorage of een openbare repository plaatsen.
- Provider-tokens worden niet in de publieke database opgeslagen. Ze horen in een server-side secret store of beveiligde vault, buiten de browser en de publieke tabellen.
- Challenge-ranglijsten worden via een nickname-only RPC opgehaald; er wordt geen e-mail, woonadres of ruwe meetdata teruggegeven.
- De service worker cachet geen API-verzoeken of privégegevens.
- De huidige app bewaart huishoudprofiel en test-challenges lokaal. Gebruik dit prototype niet voor gevoelige gegevens tot accountsynchronisatie en privacyprocessen actief zijn.

## Huidige status
De PWA is voorbereid voor mobiel en desktop, maar is geen native app uit de App Store/Google Play. De eerste versie blijft via de browser installeerbaar. Een native app store release kan later via Capacitor of een andere wrapper worden overwogen.


## Accountlaag (frontend gereed, backend nog te activeren)
De app bevat nu een accountvenster met:
- e-mailregistratie en bevestigingsmail (client-side browserflow);
- e-mail + wachtwoord inloggen;
- uitloggen;
- wachtwoord-herstellink en nieuw wachtwoord;
- Supabase sessieherstel op hetzelfde apparaat;
- ophalen en opslaan van het huishoudprofiel in de database, zodat het met dezelfde login op een tweede apparaat beschikbaar is.

### Frontendconfiguratie
Bestand: supabase-config.js. Vul na het aanmaken van het Supabase-project uitsluitend in:
- projectUrl: de Project URL uit Project Settings → API;
- publishableKey: de publieke publishable key (of legacy anon key als het dashboard die nog toont).

Deze twee waarden zijn bedoeld voor frontendgebruik. Gebruik nooit de service_role key, databasewachtwoord of provider-/Home Assistant-tokens in dit bestand.

### Supabase-project instellen
1. Maak een project aan in Supabase.
2. Open SQL Editor en voer de volledige migratie uit: supabase/migrations/202611230001_initial_mijn_energie.sql.
3. Stel Authentication → URL Configuration in:
   - Site URL: https://dullemondbas-dotcom.github.io
   - Redirect URL: https://dullemondbas-dotcom.github.io/duurzaamkompas/energie-challenge.html
   - Password reset URL: https://dullemondbas-dotcom.github.io/duurzaamkompas/energie-challenge.html?reset=1
4. Laat e-mailbevestiging ingeschakeld. Configureer voor productie een eigen SMTP-provider; de standaard verzenddienst heeft beperkte testquota.
5. Vul de project-URL en publishable key in supabase-config.js.
6. Test registratie, bevestiging, login, wachtwoordreset en profielsync met twee testaccounts en op twee verschillende apparaten.

De publieke GitHub Pages-app is een client-only SPA. Daarom wordt de Supabase JavaScript client in implicit browser-flow gebruikt; PKCE vereist voor de e-mailbevestiging een server-side token-exchange endpoint of een aparte verifyOtp callback. De resetflow gebruikt de door Supabase teruggegeven recovery-sessie.

De registratie- en logininterface is gepubliceerd, maar accountaanmaak en synchronisatie blijven uitgeschakeld zolang bovenstaande projectconfiguratie ontbreekt. De frontend laat dat expliciet zien.
