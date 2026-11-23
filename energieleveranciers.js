(() => {
  const providers = [
    {name:"Frank Energie",status:"verified",contract:"Dynamisch contract",control:"Openbare compatibiliteitslijst",summary:"Publiceert een bijgewerkte lijst met batterijmerken en modelvoorwaarden. Sommige systemen worden rechtstreeks gekoppeld; andere via Bliq, Eniris of Accuselect.",source:"https://www.frankenergie.nl/nl/compatibele-apparaten?category=homeBatteries",sourceText:"Compatibele thuisbatterijen",checked:"12 november 2026"},
    {name:"Tibber",status:"verified",contract:"Dynamisch contract",control:"Ondersteunde batterijen, slimme sturing en Grid Rewards",summary:"Ondersteunt geselecteerde batterijen en omvormers. De beschikbare functies verschillen per merk, model en integratie.",source:"https://support.tibber.com/hc/nl/articles/48376513853969-Ondersteunde-thuisbatterijen",sourceText:"Ondersteunde thuisbatterijen",checked:"22 oktober 2026"},
    {name:"Eneco",status:"verified",contract:"Vast, variabel of VoordeelMomenten bij BatterijSturing",control:"BatterijSturing via batterijpartner",summary:"De productvoorwaarden van september 2026 beschrijven een specifieke dienst voor batterijaansturing. De dienst werkt volgens die voorwaarden niet met een dynamisch Eneco-contract.",source:"https://www.eneco.nl/-/media/eneco-nl/files/energieproducten/batterijsturing/voorwaarden-batterijsturing-sep2026.pdf?rev=c6b6fc81f85c4638a0733e007a3945d5&sc_lang=nl-nl",sourceText:"Eneco BatterijSturing voorwaarden",checked:"september 2026"},
    {name:"Zonneplan",status:"review",contract:"Controleer huidig contractaanbod",control:"Eigen batterij- en energiediensten; externe compatibiliteit nog te controleren",summary:"Relevante partij vanwege het eigen batterij- en energieaanbod. Specifieke ondersteuning van externe merken wordt pas toegevoegd na controle van de actuele productvoorwaarden.",source:"https://www.zonneplan.nl/",sourceText:"Website Zonneplan",checked:"Externe compatibiliteit nog te controleren"},
    {name:"NextEnergy",status:"review",contract:"Controleer huidig contractaanbod",control:"Batterijsturing nog te verifiëren",summary:"Wordt opgenomen in de leveranciersinventarisatie. Aansturingsmarkten, batterijmerken, vergoedingen en voorwaarden moeten nog met actuele primaire bronnen worden bevestigd.",source:"https://www.nextenergy.nl/",sourceText:"Website NextEnergy",checked:"Nog te controleren"},
    {name:"ANWB Energie",status:"review",contract:"Controleer huidig contractaanbod",control:"Batterijsturing nog te verifiëren",summary:"Consumentenmerk met een juridische vergunninghouder die in de ACM-lijst staat. Mogelijkheden voor batterijaansturing worden nog onderzocht.",source:"https://www.anwb.nl/energie",sourceText:"Website ANWB Energie",checked:"Nog te controleren"},
    {name:"Budget Energie",status:"review",contract:"Controleer huidig contractaanbod",control:"Batterijsturing nog te verifiëren",summary:"Wordt opgenomen voor contract- en dienstenvergelijking. Handelsnaam en juridische vergunninghouder kunnen verschillen.",source:"https://www.budgetthuis.nl/energie",sourceText:"Website Budget Thuis",checked:"Nog te controleren"},
    {name:"DELTA Energie",status:"review",contract:"Controleer huidig contractaanbod",control:"Batterijsturing nog te verifiëren",summary:"Wordt opgenomen voor vergelijking van contracten en mogelijke koppelingen met slimme apparaten.",source:"https://www.deltaenergie.nl/",sourceText:"Website DELTA Energie",checked:"Nog te controleren"},
    {name:"Essent",status:"review",contract:"Controleer huidig contractaanbod",control:"Batterijsturing nog te verifiëren",summary:"De mogelijkheden voor batterijaansturing, slimme diensten en eventuele partnerkoppelingen moeten nog worden vastgesteld.",source:"https://www.essent.nl/",sourceText:"Website Essent",checked:"Nog te controleren"},
    {name:"Greenchoice",status:"review",contract:"Controleer huidig contractaanbod",control:"Batterijsturing nog te verifiëren",summary:"Wordt meegenomen in de leveranciersinventarisatie. Compatibiliteit wordt pas na controle op modelniveau ingevuld.",source:"https://www.greenchoice.nl/",sourceText:"Website Greenchoice",checked:"Nog te controleren"},
    {name:"Oxxio",status:"review",contract:"Controleer huidig contractaanbod",control:"Batterijsturing nog te verifiëren",summary:"Wordt opgenomen voor contract- en dienstenvergelijking. Specifieke batterijintegraties zijn nog niet bevestigd.",source:"https://www.oxxio.nl/",sourceText:"Website Oxxio",checked:"Nog te controleren"},
    {name:"Powerpeers",status:"review",contract:"Controleer huidig contractaanbod",control:"Batterijsturing nog te verifiëren",summary:"Wordt opgenomen voor contract- en dienstenvergelijking. Specifieke batterijintegraties zijn nog niet bevestigd.",source:"https://www.powerpeers.nl/",sourceText:"Website Powerpeers",checked:"Nog te controleren"},
    {name:"Pure Energie",status:"review",contract:"Controleer huidig contractaanbod",control:"Batterijsturing nog te verifiëren",summary:"Wordt opgenomen voor contract- en dienstenvergelijking. Specifieke batterijintegraties zijn nog niet bevestigd.",source:"https://pure-energie.nl/",sourceText:"Website Pure Energie",checked:"Nog te controleren"},
    {name:"Vandebron",status:"review",contract:"Controleer huidig contractaanbod",control:"Batterijsturing nog te verifiëren",summary:"Wordt opgenomen voor contract- en dienstenvergelijking. Specifieke batterijintegraties zijn nog niet bevestigd.",source:"https://vandebron.nl/",sourceText:"Website Vandebron",checked:"Nog te controleren"},
    {name:"Vattenfall",status:"review",contract:"Controleer huidig contractaanbod",control:"Batterijsturing nog te verifiëren",summary:"Wordt meegenomen voor contractvergelijking en eventuele slimme energiediensten. Compatibiliteit moet nog worden onderzocht.",source:"https://www.vattenfall.nl/",sourceText:"Website Vattenfall",checked:"Nog te controleren"}
  ];

  const matrix = [
    {brand:"AEG",frank:"Met voorwaarden",f:"conditional",tibber:"Niet bevestigd",t:"unknown",note:"Controleer exacte modelcode en voorwaarden."},
    {brand:"AlphaESS",frank:"Ondersteund",f:"supported",tibber:"Niet bevestigd",t:"unknown",note:"Frank noemt AlphaESS; controleer de betreffende serie."},
    {brand:"Anker SOLIX",frank:"Met voorwaarden",f:"conditional",tibber:"Niet bevestigd",t:"unknown",note:"Frank noemt voorwaarden; check uitvoering."},
    {brand:"Deye",frank:"Via Bliq en Eniris",f:"bridge",tibber:"Niet bevestigd",t:"unknown",note:"Extra tussenpartij / controller kan nodig zijn."},
    {brand:"Enphase",frank:"Ondersteund",f:"supported",tibber:"Niet bevestigd",t:"unknown",note:"Controleer de exacte IQ Battery-generatie."},
    {brand:"FoxESS",frank:"Ondersteund",f:"supported",tibber:"Niet bevestigd",t:"unknown",note:"Exact model en firmware verifiëren."},
    {brand:"GoodWe",frank:"Met voorwaarden",f:"conditional",tibber:"GoodWe Labs via Bridge",t:"bridge",note:"Functies verschillen per model en integratie."},
    {brand:"Huawei",frank:"Via Bliq en Eniris",f:"bridge",tibber:"Via Huawei Cloud",t:"bridge",note:"Controleer omvormerreeks, cloudkoppeling en functies."},
    {brand:"KOSTAL",frank:"Niet bevestigd",f:"unknown",tibber:"Via Tibber Bridge",t:"bridge",note:"Tibber noemt een Bridge-route; controleer systeemversie."},
    {brand:"SAJ",frank:"Via Bliq en Eniris",f:"bridge",tibber:"Via Tibber Bridge",t:"bridge",note:"Controleer de combinatie van omvormer en batterij."},
    {brand:"Sessy",frank:"Ondersteund",f:"supported",tibber:"Niet bevestigd",t:"unknown",note:"Frank noemt Sessy als ondersteund."},
    {brand:"Sigenergy",frank:"Ondersteund",f:"supported",tibber:"Via Tibber Bridge",t:"bridge",note:"Controleer exacte SigenStor-variant en koppelfuncties."},
    {brand:"SMA",frank:"Via Eniris",f:"bridge",tibber:"Niet bevestigd",t:"unknown",note:"Frank vermeldt een route via Eniris."},
    {brand:"SolarEdge",frank:"Ondersteund",f:"supported",tibber:"Via SolarEdge Cloud",t:"bridge",note:"Tibber-koppeling via cloud; functies modelafhankelijk."},
    {brand:"SolaX",frank:"Ondersteund",f:"supported",tibber:"Via Tibber Bridge",t:"bridge",note:"Controleer exacte omvormer- en batterijreeks."},
    {brand:"Solis",frank:"Via Eniris of Bliq; eigen koppeling gepland",f:"conditional",tibber:"Via Tibber Bridge",t:"bridge",note:"Frank noemt partnerroute; geplande directe ondersteuning apart controleren."},
    {brand:"Homevolt",frank:"Niet bevestigd",f:"unknown",tibber:"Ondersteund via Tibber-app",t:"supported",note:"Tibber vermeldt Homevolt-ondersteuning; productbeschikbaarheid controleren."},
    {brand:"Tibber Smart Battery System",frank:"Niet bevestigd",f:"unknown",tibber:"Eigen systeem",t:"supported",note:"Controleer actuele Nederlandse beschikbaarheid en voorwaarden."}
  ];

  const licenses = [
    "ANWB Energie B.V.","AllureNRG B.V.","Audax Renewables Nederland B.V.","Budget Thuis B.V.","CEN B.V.","Chiriqui B.V.","Clean Energy B.V.","ConceptsnSolutions B.V.","Coöperatieve Duurzame Energie Unie U.A.","Coöperatieve vereniging NLD energie U.A.","DELTA Energie B.V.","DigiWatt Energie B.V.","e-Energy Europe B.V.","ELIX B.V.","Eneco Consumenten B.V.","Eneco Zakelijk B.V.","Greenchoice Solutions B.V.","Greenchoice Zakelijk N.V.","HalloStroom Energie B.V.","Hezelaer Energy B.V.","Innova Energie B.V.","Kikker Energie B.V.","Mega Energie B.V.","NextEnergy B.V.","Noord Energie KZ B.V.","Nieuw Hollands Energiebedrijf B.V.","OpenSource Energie","OXXIO Nederland B.V.","Powerpeers B.V.","Pure Energie Levering B.V.","Scholt Energy B.V.","SEFE Energy Limited","ServiceHouse B.V.","Slim met Energie B.V.","Tibber Netherlands B.V.","Vandebron Energie B.V.","Vattenfall Sales Nederland N.V.","VanHelder B.V.","Ventum B.V.","Vrij Op Naam B.V.","Zonneplan Energie B.V."
  ];

  const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const providerGrid = document.querySelector("#provider-grid");
  const providerSearch = document.querySelector("#provider-search");
  const providerFilter = document.querySelector("#provider-filter");
  function renderProviders() {
    if (!providerGrid) return;
    const q = (providerSearch.value || "").toLocaleLowerCase("nl").trim();
    const mode = providerFilter.value || "all";
    const list = providers.filter(p => (mode === "all" || p.status === mode) && [p.name,p.contract,p.control,p.summary].join(" ").toLocaleLowerCase("nl").includes(q));
    providerGrid.innerHTML = list.length ? list.map(p => '<article class="market-card"><div class="market-card-top"><span class="market-badge ' + (p.status === "verified" ? "" : "warning") + '">' + (p.status === "verified" ? "Openbare informatie gevonden" : "Nader te onderzoeken") + '</span></div><h3>' + esc(p.name) + '</h3><p>' + esc(p.summary) + '</p><div class="market-card-meta"><div><small>Contract</small><b>' + esc(p.contract) + '</b></div><div><small>Batterijaansturing</small><b>' + esc(p.control) + '</b></div><div><small>Bron gecontroleerd</small><b>' + esc(p.checked) + '</b></div></div><a href="' + esc(p.source) + '" target="_blank" rel="noopener">' + esc(p.sourceText) + ' ↗</a></article>').join("") : '<div class="market-empty">Geen leveranciers gevonden. Probeer een andere zoekterm.</div>';
  }
  function renderMatrix() {
    const target = document.querySelector("#compatibility-matrix");
    if (!target) return;
    const q = (document.querySelector("#matrix-search").value || "").toLocaleLowerCase("nl").trim();
    const mode = document.querySelector("#matrix-filter").value || "all";
    const items = matrix.filter(m => {
      const matches = (m.brand + " " + m.note).toLocaleLowerCase("nl").includes(q);
      const hasFrank = m.f !== "unknown", hasTibber = m.t !== "unknown";
      const matchesMode = mode === "all" || (mode === "frank" && hasFrank) || (mode === "tibber" && hasTibber) || (mode === "both" && hasFrank && hasTibber);
      return matches && matchesMode;
    });
    const badge = (value,type) => '<span class="matrix-status ' + type + '">' + esc(value) + '</span>';
    target.innerHTML = items.map(m => '<tr><th>' + esc(m.brand) + '</th><td>' + badge(m.frank,m.f) + '</td><td>' + badge(m.tibber,m.t) + '</td><td>' + esc(m.note) + '</td></tr>').join("") || '<tr><td colspan="4" class="market-empty">Geen resultaten gevonden.</td></tr>';
  }
  const licenseList = document.querySelector("#license-list");
  function renderLicenses() {
    if (!licenseList) return;
    const q = (document.querySelector("#license-search").value || "").toLocaleLowerCase("nl").trim();
    const list = licenses.filter(name => name.toLocaleLowerCase("nl").includes(q));
    licenseList.innerHTML = list.map(name => "<li>" + esc(name) + "</li>").join("") || "<li>Geen vergunninghouder gevonden.</li>";
  }
  providerSearch && providerSearch.addEventListener("input",renderProviders);
  providerFilter && providerFilter.addEventListener("change",renderProviders);
  document.querySelector("#matrix-search").addEventListener("input",renderMatrix);
  document.querySelector("#matrix-filter").addEventListener("change",renderMatrix);
  document.querySelector("#license-search").addEventListener("input",renderLicenses);
  renderProviders(); renderMatrix(); renderLicenses();
})();