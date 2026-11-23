# Mijn Kompas V3 — implementatie in de GitHub Pages-site

## Wat is toegevoegd

- \`mijn-kompas.html\`: persoonlijke energieomgeving op hetzelfde Supabase-project als de bestaande Mijn Energie-omgeving.
- \`integrations/homewizard-p1/\`: opt-in lokale HomeWizard P1-bridge, certificaatinstallatie, voorbeeldconfiguratie, dependencies en normalisatietests.
- \`supabase/migrations/20261123185840_add_household_tariffs_and_cloud_scenario_history.sql\`: persoonlijke huishoudtarieven en cloudopslag van scenarioresultaten.
- \`supabase/migrations/20261123190218_index_energy_scenario_snapshots_created_by.sql\`: index voor accountgebonden scenariohistorie.

## Datastromen

1. De browser gebruikt de centrale \`supabase-config.js\` en alleen de openbare publishable key.
2. Supabase Auth identificeert de gebruiker; RLS beperkt data tot leden en beheerders van het eigen huishouden.
3. Persoonlijke energietarieven worden opgeslagen in \`household_energy_tariffs\`.
4. Rekentooluitkomsten worden opgeslagen in \`energy_scenario_snapshots\`; deze blijven scenario's en worden niet als gerealiseerde besparing gepresenteerd.
5. De lokale bridge stuurt alleen genormaliseerde meetwaarden via HTTPS naar de bestaande Edge Function \`ingest-energy-reading\`. De database bewaart alleen een hash van de intrekbare DuurzaamKompas-koppelsleutel; de HomeWizard-apparaat-token blijft lokaal.
6. De bestaande aggregatie-, persoonlijke referentie- en weektip-engine blijft de bron voor dashboardmetingen en adviezen.

## Supabase-configuratie

De twee SQL-migraties in deze change zijn al toegepast op het gekoppelde project \`qntmcqrwftrrrbyjlqis\`. De migrationbestanden staan ook in deze repository voor reproduceerbaarheid. Voer ze niet opnieuw handmatig uit op de bestaande database.

## Lokale controles

\`\`\`bash
python -m py_compile integrations/homewizard-p1/dk_homewizard_bridge.py integrations/homewizard-p1/install_cert.py
python -m unittest discover -s integrations/homewizard-p1 -p 'test_*.py'
\`\`\`

Open de app via GitHub Pages of een lokale HTTP-server; \`file://\` kan ES-modules en browserauthenticatie blokkeren.

## Nog nodig voor een echte live meting

- Een fysieke HomeWizard P1-meter op hetzelfde thuisnetwerk als de bridgecomputer.
- Fysieke bevestiging van de pairing op de P1-meter.
- Een testaccount en echte P1-metingen om de volledige end-to-end-route te valideren.

## Licentiegrens HomeWizard

De huidige lokale HomeWizard API-licentie is voor persoonlijk, niet-commercieel gebruik en verleent geen sublicentierecht of recht op omzetgeneratie met API-afhankelijke software. Gebruik deze route niet voor openbare of commerciële DuurzaamKompas-dienstverlening zonder schriftelijke toestemming of een passende commerciële overeenkomst. Voor een SaaS-route moet eerst een toegestane commerciële of partnerintegratie worden gekozen.
