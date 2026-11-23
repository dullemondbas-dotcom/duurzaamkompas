# DuurzaamKompas · lokale HomeWizard P1-bridge

Deze connector leest de eigen HomeWizard P1-meter lokaal uit en stuurt uitsluitend genormaliseerde meetwaarden via HTTPS naar DuurzaamKompas. Het HomeWizard-apparaat-token blijft op de computer of mini-pc in het thuisnetwerk.

## Voorwaarden

- Gebruik dit alleen voor je eigen meter en voor persoonlijk, niet-commercieel gebruik zolang HomeWizard geen andere schriftelijke licentie of overeenkomst heeft verstrekt.
- P1-meter en bridgecomputer moeten op hetzelfde lokale netwerk zitten.
- Python 3.11 of hoger.
- De app moet een eenmalige DuurzaamKompas-koppelsleutel hebben aangemaakt.

De huidige HomeWizard API-licentie is persoonlijk en niet-commercieel. Er bestaat geen sublicentierecht of recht op omzetgeneratie met API-afhankelijke software. Gebruik deze connector niet voor een openbare of commerciële SaaS-integratie zonder afzonderlijke schriftelijke toestemming of een passende commerciële overeenkomst.

## Installatie

1. Download deze map met de bestanden \`dk_homewizard_bridge.py\`, \`install_cert.py\`, \`requirements.txt\` en \`config.example.json\` naar één map op een computer of mini-pc in hetzelfde netwerk als de P1-meter.
2. Kopieer het eenmalig gedownloade bestand \`duurzaamkompas-homewizard-config.json\` naar die map. Hernoem dit bestand niet. Het bestand \`config.example.json\` bevat alleen voorbeeldwaarden.
3. Open een terminal in die map en voer uit:

   \`\`\`bash
   python -m pip install -r requirements.txt
   python install_cert.py
   python dk_homewizard_bridge.py discover
   \`\`\`

4. Als precies één P1-meter wordt gevonden, vult de ontdekking het IP-adres en serienummer automatisch in. Bij meerdere meters moet je het juiste apparaat handmatig kiezen in het configuratiebestand.
5. Koppel de meter en bevestig dit fysiek op de P1-meter:

   \`\`\`bash
   python dk_homewizard_bridge.py pair
   \`\`\`

6. Start de synchronisatie:

   \`\`\`bash
   python dk_homewizard_bridge.py run
   \`\`\`

   De standaardinterval is 30 seconden. De computer of mini-pc moet ingeschakeld blijven.

## Intrekken en opruimen

1. Trek de integratie in Mijn Kompas in. Daarmee wordt de server-side koppelcode ongeldig.
2. Stop de bridge met \`Ctrl+C\`.
3. Verwijder ook de lokale HomeWizard-gebruiker en het lokale apparaattoken:

   \`\`\`bash
   python dk_homewizard_bridge.py disconnect
   \`\`\`

De HomeWizard-token wordt opgeslagen in \`~/.duurzaamkompas/homewizard-device.json\` (bestandsrechten 0600 waar ondersteund). De DuurzaamKompas-koppelsleutel staat in het apart gedownloade configuratiebestand. Deel of commit geen van deze bestanden.

## Gegevens en beperkingen

- De bridge stuurt P1-vermogens en cumulatieve stroomtellerstanden door; gas wordt alleen meegestuurd als de P1/API dit beschikbaar maakt.
- De backend accepteert meetmomenten binnen een beperkt tijdvenster en begrenst de ingestiefrequentie.
- Historische gegevens beginnen pas wanneer de bridge actief is. De lokale API-koppeling haalt geen oude meetgeschiedenis uit de meter op.
- Een verschil in netafname is niet automatisch hetzelfde als een verandering van het totale huishoudelijke stroomverbruik, zeker niet met zonnepanelen of een thuisbatterij.
- Meetkwaliteit en datadekking bepalen of gegevens als bruikbaar worden getoond.

## Veiligheid

- Plaats nooit een apparaattoken of connector-key in de frontend, publieke bestanden, issues of screenshots.
- Het CA-certificaat wordt lokaal opgehaald via HTTPS met de officiële HomeWizard-documentatie-URL.
- De bridge logt meetstatussen, geen connector-key of apparaattoken.
