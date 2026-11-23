/* DuurzaamKompas: accessible navigation and local site search. No tracking or server calls. */
(() => {
  const nav = document.querySelector(".nav");
  const menuButton = document.querySelector(".menu-toggle");
  const searchOpen = document.querySelector("#site-search-open");
  const searchLayer = document.querySelector("#site-search");
  const searchInput = document.querySelector("#site-search-query");
  const searchResults = document.querySelector("#site-search-results");
  const searchClose = [...document.querySelectorAll("[data-search-close]")];

  const entries = [
    {title:"Thuisbatterij: hoe werkt het?",section:"Thuisbatterijen",url:"kennisbank.html#thuisbatterij",description:"De basis: stroom opslaan, capaciteit, vermogen en noodstroom.",tags:"thuisbatterij accu batterij opslag kwh vermogen noodstroom"},
    {title:"Plug-in thuisbatterijen",section:"Slimme apparaten",url:"kennisbank.html#plug-in-batterij",description:"Wat is een stekkerbatterij en waar moet je op letten?",tags:"plug-in stekkerbatterij stopcontact batterij plug in"},
    {title:"Slimme aansturing van batterijen",section:"Energiemanagement",url:"kennisbank.html#slimme-sturing",description:"Wat doet een batterij wanneer hij slim wordt aangestuurd?",tags:"slimme sturing batterij ems laden ontladen ai"},
    {title:"Geld verdienen met energiehandel",section:"Energiehandel",url:"kennisbank.html#energiehandel",description:"Het verschil tussen omzet, bruto-opbrengst, besparing en nettoresultaat.",tags:"energiehandel onbalans day ahead intraday geld verdienen winst opbrengst handelen"},
    {title:"Je batterij koppelen aan een energiedienst",section:"Koppelen & aanmelden",url:"kennisbank.html#batterij-koppelen",description:"Wie moet de koppeling activeren en welke toestemming is nodig?",tags:"batterij koppelen energieleverancier app aggreg ator service aanmelden koppeling tibber"},
    {title:"Energiecontracten uitgelegd",section:"Contracten & tarieven",url:"kennisbank.html#energiecontracten",description:"Vast, variabel en dynamisch: wat betekent het voor jouw rekening?",tags:"energiecontract vast variabel dynamisch tarieven stroomprijs leverancier"},
    {title:"Wat verandert er bij salderen in 2027?",section:"Regelgeving",url:"kennisbank.html#saldering-2027",description:"Terugleveren, vergoeding en direct eigen verbruik in gewone taal.",tags:"salderen 2027 1 januari teruglevering terugleververgoeding zonnepanelen"},
    {title:"Zonnepanelen en omvormers",section:"Opwekken",url:"kennisbank.html#zonnepanelen",description:"Van zonlicht naar stroom en wat je met het overschot kunt doen.",tags:"zonnepanelen omvormer pv opwek zonnestroom"},
    {title:"Energiemanagementsysteem (EMS)",section:"Slim aansturen",url:"kennisbank.html#ems",description:"Hoe een EMS apparaten in huis met elkaar laat samenwerken.",tags:"ems energiemanagementsysteem home energy management he m s"},
    {title:"Kwartierdata en eigen stroomverbruik",section:"Meten & inzicht",url:"kennisbank.html#kwartierdata",description:"Wat kun je leren van stroomgegevens per kwartier?",tags:"kwartierdata p1 meter meten data verbruik afname teruglevering csv stroomanalyse"},
    {title:"Netcongestie in gewone taal",section:"Elektriciteitsnet",url:"kennisbank.html#net",description:"Waarom het stroomnet soms vol zit en wat flexibiliteit doet.",tags:"netcongestie elektriciteitsnet piekbelasting flexibel netbeheer"},
    {title:"Laadpalen en slim laden",section:"Elektrisch rijden",url:"kennisbank.html#laden",description:"Je elektrische auto laden met oog voor je woning en energiegebruik.",tags:"laadpaal elektrisch rijden slim laden ev auto v2g v2h"},
    {title:"Warmtepompen en slim verwarmen",section:"Verwarmen & comfort",url:"slimme-apparaten.html#warmtepompen",description:"Waar je op let bij techniek, comfort en samenwerking met andere apparaten.",tags:"warmtepomp thermostaat boiler verwarming"},
    {title:"Veiligheid van thuisbatterijen",section:"Veiligheid",url:"kennisbank.html#veiligheid",description:"Plaatsing, installatie, brandveiligheid en aandachtspunten.",tags:"veiligheid brand brandweer nipv batterij accu"},
    {title:"Slimme apparaten voor je woning",section:"Apparatenbibliotheek",url:"slimme-apparaten.html",description:"Van zonnepanelen en batterijen tot verlichting en beveiliging.",tags:"slimme apparaten smart home apparaten overzicht"},
    {title:"Persoonlijk vooradvies",section:"Aan de slag",url:"advies.html",description:"Beantwoord vragen over je woning en ontdek een logische vervolgstap.",tags:"advies persoonlijke woning start keuze hulp"},
    {title:"Gratis tools en berekeningen",section:"Hulpmiddelen",url:"tools.html",description:"Bekijk welke hulpmiddelen vandaag beschikbaar zijn en wat nog gepland staat.",tags:"tools calculator rekenen berekening hulpmiddelen"},
    {title:"Offerte- en aankoopchecklist",section:"Voorbereiden",url:"keuzehulp.html",description:"Een checklist met vragen over techniek, installatie, kosten en aansturing.",tags:"offerte checklist aankoop installateur vragen"},
    {title:"Onderzoeken en cijfers",section:"Verdieping",url:"onderzoek.html",description:"Bekijk conclusies in gewone taal en open daarna de technische onderbouwing.",tags:"onderzoek cijfers studie rapporten data"},
    {title:"Kijken en luisteren",section:"Video & podcast",url:"kijken.html",description:"Uitlegvideo's, webinars, podcasts en korte kennistests.",tags:"video podcast webinar youtube quiz"},
    {title:"Nieuws en ontwikkelingen",section:"Actualiteit",url:"nieuws.html",description:"Wat verandert er in de energiewereld en wat betekent dat thuis?",tags:"nieuws actualiteit ontwikkelingen energie"},
    {title:"Bronnen en transparantie",section:"Redactionele werkwijze",url:"bronnen.html",description:"Hoe we bronnen, commerciële belangen en onzekerheden beoordelen.",tags:"bronnen transparantie onafhankelijk affiliate reclame"},
    {title:"Over DuurzaamKompas",section:"Het platform",url:"over.html",description:"Onze missie, uitgangspunten en wat de website wel en niet doet.",tags:"over missie visie platform"}
  ];

  const normalize = (value) => String(value || "").toLocaleLowerCase("nl").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const popular = ["thuisbatterij", "salderen 2027", "slimme sturing", "energiecontract"];

  function showResults(query) {
    if (!searchResults) return;
    searchResults.replaceChildren();
    const q = normalize(query.trim());
    if (q.length < 2) {
      const hint = document.createElement("p");
      hint.className = "site-search-hint";
      hint.textContent = "Populaire onderwerpen: " + popular.join(" · ");
      searchResults.append(hint);
      return;
    }
    const matches = entries.map(entry => {
      const corpus = normalize([entry.title, entry.section, entry.description, entry.tags].join(" "));
      const words = q.split(/\s+/).filter(Boolean);
      const score = words.reduce((total, word) => total + (corpus.includes(word) ? 1 : 0), 0);
      return {entry, score};
    }).filter(result => result.score > 0).sort((a,b) => b.score-a.score).slice(0,10);
    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "site-search-empty";
      empty.textContent = "Geen resultaten gevonden. Probeer een andere zoekterm, bijvoorbeeld batterij, zonnepanelen of contract.";
      searchResults.append(empty);
      return;
    }
    matches.forEach(({entry}) => {
      const link = document.createElement("a");
      link.className = "site-search-result";
      link.href = entry.url;
      const category = document.createElement("small");
      category.textContent = entry.section;
      const title = document.createElement("b");
      title.textContent = entry.title;
      const description = document.createElement("span");
      description.textContent = entry.description;
      link.append(category,title,description);
      searchResults.append(link);
    });
  }

  function openSearch() {
    if (!searchLayer) return;
    searchLayer.hidden = false;
    document.body.classList.add("search-is-open");
    showResults("");
    window.setTimeout(() => searchInput?.focus(), 30);
  }
  function closeSearch() {
    if (!searchLayer) return;
    searchLayer.hidden = true;
    document.body.classList.remove("search-is-open");
    searchOpen?.focus();
  }
  searchOpen?.addEventListener("click", openSearch);
  searchInput?.addEventListener("input", () => showResults(searchInput.value));
  searchInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      const first = searchResults?.querySelector("a");
      if (first) window.location.href = first.href;
    }
  });
  searchClose.forEach(button => button.addEventListener("click", closeSearch));

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (searchLayer && !searchLayer.hidden) closeSearch();
      nav?.querySelectorAll("details[open]").forEach(group => { group.open = false; });
    }
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const active = document.activeElement;
      const typing = active && (active.matches("input, textarea, select") || active.isContentEditable);
      if (!typing) {
        event.preventDefault();
        openSearch();
      }
    }
  });

  document.addEventListener("click", event => {
    if (nav && !nav.contains(event.target) && !event.target.closest(".menu-toggle")) {
      nav.querySelectorAll("details[open]").forEach(group => { group.open = false; });
    }
  });

  if (nav) {
    const currentFile = location.pathname.split("/").pop() || "index.html";
    nav.querySelectorAll("a[href]").forEach(link => {
      const target = (link.getAttribute("href") || "").split("#")[0];
      if (target === currentFile) {
        link.setAttribute("aria-current","page");
        const parent = link.closest("details.nav-group");
        if (parent) {
          parent.dataset.current = "true";
          parent.querySelector("summary")?.setAttribute("aria-current","page");
        }
      }
    });
    nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
      nav.querySelectorAll("details[open]").forEach(group => { group.open = false; });
      if (menuButton && nav.classList.contains("open")) {
        nav.classList.remove("open");
        menuButton.setAttribute("aria-expanded","false");
        menuButton.setAttribute("aria-label","Menu openen");
        menuButton.textContent = "☰";
      }
    }));
  }

  if (menuButton && nav) {
    menuButton.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      menuButton.setAttribute("aria-expanded",String(open));
      menuButton.setAttribute("aria-label",open ? "Menu sluiten" : "Menu openen");
      menuButton.textContent = open ? "×" : "☰";
    });
  }
})();