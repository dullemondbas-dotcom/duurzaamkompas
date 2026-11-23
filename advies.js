(() => {
  const form = document.querySelector("#advice-form");
  if (!form) return;

  const steps = [...document.querySelectorAll(".advice-step")];
  const back = document.querySelector("#wizard-back");
  const next = document.querySelector("#wizard-next");
  const submit = document.querySelector("#wizard-submit");
  const result = document.querySelector("#advice-result");
  let currentStep = 1;

  const checkedValue = name => form.querySelector(`input[name="${name}"]:checked`)?.value || "";
  const checkedValues = name => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(el => el.value);
  const numberValue = id => {
    const el = document.getElementById(id);
    if (!el || el.value.trim() === "") return null;
    const n = Number(el.value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const textValue = id => (document.getElementById(id)?.value || "").trim();

  function showStep(step) {
    currentStep = Math.max(1, Math.min(4, step));
    steps.forEach(section => {
      const active = Number(section.dataset.step) === currentStep;
      section.classList.toggle("active", active);
      section.hidden = !active;
    });
    document.querySelectorAll("[data-label-step]").forEach(label => {
      const n = Number(label.dataset.labelStep);
      label.classList.toggle("active", n === currentStep);
      label.classList.toggle("completed", n < currentStep);
    });
    const percent = currentStep * 25;
    document.querySelector("#step-caption").textContent = `STAP ${currentStep} VAN 4`;
    document.querySelector("#step-percent").textContent = percent + "%";
    document.querySelector("#wizard-fill").style.width = percent + "%";
    back.disabled = currentStep === 1;
    next.hidden = currentStep === 4;
    submit.hidden = currentStep !== 4;
    document.querySelector("#start-advies").scrollIntoView({behavior:"smooth",block:"start"});
  }

  back.addEventListener("click", () => showStep(currentStep - 1));
  next.addEventListener("click", () => showStep(currentStep + 1));
  submit.addEventListener("click", buildAdvice);

  function addListItems(id, items) {
    const ul = document.getElementById(id);
    ul.innerHTML = "";
    items.forEach(text => {
      const li = document.createElement("li");
      li.textContent = text;
      ul.appendChild(li);
    });
  }

  function buildAdvice() {
    const a = {
      solar: checkedValue("solarStatus"),
      battery: checkedValue("batteryStatus"),
      phase: checkedValue("phase"),
      consumption: numberValue("annual-consumption"),
      production: numberValue("annual-solar"),
      export: numberValue("annual-export"),
      inverter: textValue("inverter-brand"),
      goals: checkedValues("goals"),
      contract: document.querySelector("#contract-kind").value,
      future: document.querySelector("#future-plan").value,
      stage: checkedValue("stage"),
      context: textValue("extra-context")
    };

    let type = "Eerst inzicht verzamelen";
    let title = "Begin met je energiegegevens. Nog geen reden om direct een batterij te kiezen.";
    let copy = "Op basis van de ingevulde gegevens is nog niet goed vast te stellen of opslag bij je woning past. Dat is geen gemiste kans: met een paar concrete meetgegevens voorkom je dat je een systeem kiest dat niet aansluit op je verbruik.";
    let confidence = "Advieszekerheid: beperkt — er ontbreken nog gegevens over je dagelijkse verbruik en/of teruglevering.";
    const actions = [];
    const watchouts = [];
    const questions = [];

    if (a.battery === "yes") {
      type = "Optimaliseer wat je al hebt";
      title = "Kijk eerst naar de prestaties en instellingen van je bestaande systeem.";
      copy = "Je hebt al een thuisbatterij. Een tweede batterij of grotere opslag is niet automatisch de beste vervolgstap. Begin met inzicht in de huidige laad- en ontlaadstrategie, het eigen verbruik en de samenwerking met je andere apparaten.";
      confidence = "Advieszekerheid: voorlopig — de instellingen, capaciteit en meetgegevens van je bestaande systeem zijn niet uitgelezen.";
      actions.push("Bekijk per dag hoeveel energie je batterij laadt en ontlaadt en hoeveel daarvan in je woning wordt gebruikt.");
      actions.push("Controleer of de batterij op de juiste momenten wordt aangestuurd en of de instellingen passen bij jouw gebruik.");
      actions.push("Onderzoek eerst of aanpassing van het energiemanagement meer oplevert dan uitbreiding van de opslag.");
      watchouts.push("Voeg niet zomaar extra capaciteit toe zonder te controleren of de bestaande batterij vaak genoeg wordt benut.");
      watchouts.push("Controleer garantie, maximale energiedoorvoer en compatibiliteit voordat je componenten combineert.");
      questions.push("Kunnen we de laad- en ontlaadgegevens van mijn batterij over meerdere maanden bekijken?");
      questions.push("Welke instelling of EMS-aanpassing is mogelijk zonder de bestaande installatie te vervangen?");
    } else if (a.solar === "no" && a.solar !== "planned") {
      type = "Eerst je energiebehoefte bepalen";
      title = "Zonder zonnepanelen is een thuisbatterij niet vanzelfsprekend de eerste stap.";
      copy = "Een batterij kan ook stroom uit het net opslaan, maar de waarde daarvan hangt sterk af van je contract, aansturing, verliezen en verbruiksmomenten. Begin met het doel en de beschikbare meetgegevens. Laat een businesscase niet uitsluitend op verwachte handelsinkomsten rusten.";
      confidence = "Advieszekerheid: voorlopig — zonder verbruiksprofiel en concreet doel is een productkeuze niet verantwoord.";
      actions.push("Bepaal eerst of je vooral noodstroom, verbruikssturing of opslag op basis van tarieven zoekt.");
      actions.push("Bekijk je verbruik per uur of kwartier en onderzoek welke apparaten op andere momenten kunnen draaien.");
      actions.push("Als zonnepanelen op korte termijn gepland zijn, neem die toekomstige installatie direct mee in het ontwerp.");
      watchouts.push("Dynamische prijzen of verwachte handelsopbrengsten zijn geen gegarandeerd rendement.");
      watchouts.push("Noodstroom vraagt om een geschikte back-upfunctie en installatie; een standaard batterij levert niet automatisch stroom bij netuitval.");
      questions.push("Welke concrete energiekosten of gebruiksproblemen lost de batterij in mijn situatie op?");
      questions.push("Welke kosten, verliezen en beperkingen zijn meegenomen in de berekening?");
    } else if (a.solar === "planned") {
      type = "Ontwerp zonnepanelen en opslag in samenhang";
      title = "Neem een eventuele batterij nu mee in het ontwerp, maar koop niet op voorhand te groot.";
      copy = "Als je zonnepanelen nog moet laten plaatsen, is dit het juiste moment om na te denken over omvormerkeuze, uitbreidbaarheid en energiemanagement. Je hoeft de batterij niet direct mee te kopen. Zorg wel dat je later niet onnodig vastzit aan een incompatibele combinatie.";
      confidence = "Advieszekerheid: redelijk voor de ontwerpvolgorde; de uiteindelijke capaciteit vraagt om verbruiks- en opwekgegevens.";
      actions.push("Vraag om een installatieontwerp dat rekening houdt met een mogelijke latere batterij.");
      actions.push("Laat uitleggen wat de gevolgen zijn van een hybride omvormer of AC-gekoppelde opslag.");
      actions.push("Verzamel eerst een realistische verwachting van je jaarlijkse opwek en dagelijkse verbruik.");
      watchouts.push("Een grotere batterij is niet automatisch toekomstbestendiger of financieel beter.");
      watchouts.push("Controleer of uitbreiden later technisch, financieel en binnen de garantievoorwaarden mogelijk is.");
      questions.push("Welke uitbreidingsmogelijkheden blijven beschikbaar als ik de batterij pas later aanschaf?");
      questions.push("Welke omvormer- en EMS-keuzes beperken of verruimen mijn toekomstige opties?");
    } else if (a.solar === "yes" && a.export !== null && a.export >= 1000 && a.goals.includes("selfuse")) {
      type = "Onderzoek of thuisopslag bij je past";
      title = "Je teruglevering maakt een batterijonderzoek zinvol — maar nog niet automatisch een aankoop.";
      copy = "Je geeft aan dat je zonnepanelen hebt, een duidelijke hoeveelheid stroom teruglevert en meer eigen zonnestroom wilt gebruiken. Dat maakt het zinvol om te onderzoeken of opslag past. De doorslag geeft hoeveel van die teruglevering op andere momenten in je woning kan worden benut, rekening houdend met seizoenen, batterijverliezen en kosten.";
      confidence = "Advieszekerheid: redelijk voor een vervolgonderzoek; een passend formaat of financieel voordeel is hiermee nog niet vastgesteld.";
      actions.push("Gebruik kwartier- of uurdata om te zien wanneer je teruglevert en wanneer je later stroom afneemt.");
      actions.push("Vergelijk een batterijscenario met slimmer gebruik overdag, bijvoorbeeld laden of apparaten anders plannen.");
      actions.push("Vraag om een berekening met jouw echte contracttarieven, terugleverkosten, rendement en installatiekosten.");
      watchouts.push("Jaarlijkse teruglevering alleen zegt niet genoeg om de batterijcapaciteit te bepalen.");
      watchouts.push("Vanaf 2027 verandert de salderingsregeling. Beoordeel contractvoorwaarden en terugleververgoeding apart.");
      questions.push("Hoeveel van mijn teruggeleverde stroom kan technisch en praktisch later door mijn woning worden gebruikt?");
      questions.push("Welke netto besparing blijft over na verliezen, kosten, degradatie en de volledige installatieprijs?");
    } else if (a.solar === "yes" && a.production !== null && a.consumption !== null && a.production > a.consumption) {
      type = "Breng je werkelijke teruglevering in kaart";
      title = "Je opwek is hoger dan je jaarverbruik. Kijk eerst wanneer die stroom beschikbaar is.";
      copy = "Een jaarlijks overschot kan een reden zijn om opslag te onderzoeken, maar zegt nog niet hoeveel energie je op geschikte momenten teruglevert. Vergelijk je opwek en afname per uur of kwartier voordat je een batterij kiest.";
      confidence = "Advieszekerheid: voorlopig — jaarcijfers tonen geen timing of gelijktijdigheid.";
      actions.push("Zoek je werkelijke teruglevering op de jaarafrekening of in je energiedashboard.");
      actions.push("Bekijk of overdag slim laden of verbruik verschuiven al een deel van het overschot kan benutten.");
      actions.push("Maak pas daarna een scenario voor opslag en energiemanagement.");
      watchouts.push("Jaaropwek min jaarverbruik is niet hetzelfde als bruikbaar batterijoverschot.");
      watchouts.push("Zomeroverschot en winterverbruik vallen niet automatisch tegen elkaar weg met een thuisbatterij.");
      questions.push("Kunnen we mijn opwek, teruglevering en afname in één overzicht naast elkaar zetten?");
      questions.push("Welke capaciteit volgt uit mijn dagelijkse overschot en niet alleen uit mijn jaarcijfers?");
    } else {
      type = "Eerst je verbruiksprofiel scherp krijgen";
      title = "Verzamel een paar meetgegevens voordat je systemen gaat vergelijken.";
      copy = "Een goede keuze begint met inzicht in de momenten waarop je stroom opwekt, teruglevert en gebruikt. Met alleen een jaarverbruik of een aantal zonnepanelen kun je geen betrouwbaar formaat of financieel voordeel bepalen.";
      confidence = "Advieszekerheid: beperkt — de beschikbare gegevens zijn nog niet voldoende voor een gerichte systeemkeuze.";
      actions.push("Verzamel je jaarlijkse afname, zonne-opwek en teruglevering.");
      actions.push("Bekijk je kwartier- of uurprofiel om te zien wanneer je stroom gebruikt en teruglevert.");
      actions.push("Bepaal welk probleem je wilt oplossen: eigen verbruik, piekbelasting, noodstroom of integratie van apparaten.");
      watchouts.push("Laat een aanbieder geen standaard batterijcapaciteit adviseren alleen op basis van het aantal zonnepanelen.");
      watchouts.push("Vergelijk geen terugverdientijden zonder dezelfde aannames en alle kosten te gebruiken.");
      questions.push("Welke meetgegevens zijn gebruikt om de voorgestelde capaciteit te bepalen?");
      questions.push("Welke alternatieven zijn bekeken, inclusief geen batterij aanschaffen?");
    }

    if (a.goals.includes("backup")) {
      actions.push("Laat een aparte noodstroomoplossing beoordelen: omschakeling, geselecteerde groepen en beschikbaar vermogen.");
      watchouts.push("Vraag welke apparaten daadwerkelijk blijven werken bij netuitval en hoe lang.");
      questions.push("Welke groepen blijven bij een stroomstoring actief en wat is het beschikbare continue vermogen?");
    }
    if (a.goals.includes("ev") || a.goals.includes("heatpump") || a.future !== "none") {
      actions.push("Neem toekomstige elektrische verbruikers mee in het ontwerp van de aansluiting en energiesturing.");
      watchouts.push("Controleer of laadpaal, warmtepomp, omvormer en batterij door hetzelfde EMS ondersteund worden.");
      questions.push("Welke apparaten kan het EMS gelijktijdig aansturen en welke vermogensgrenzen gelden?");
    }
    if (a.contract === "dynamic") {
      watchouts.push("Bij dynamische prijzen kunnen tarieven sterk wisselen. Een slim aangestuurde batterij biedt geen gegarandeerde opbrengst.");
      questions.push("Welke prijs-, onbalans- of netdiensten worden precies gebruikt en welke kosten of beperkingen gelden?");
    }
    if (a.stage === "quote") {
      actions.push("Leg de offerte naast je eigen meetgegevens en controleer of de voorgestelde oplossing het doel echt ondersteunt.");
      questions.push("Welke onderdelen, installatiewerkzaamheden, abonnementen en garantievoorwaarden zitten in de totaalprijs?");
    }
    if (a.stage === "compare") {
      actions.push("Vergelijk de voorstellen op dezelfde uitgangspunten: capaciteit, continu vermogen, rendement, garantie, EMS en totale installatiekosten.");
    }
    if (a.inverter) {
      watchouts.push("Laat compatibiliteit controleren met je bestaande omvormer (" + a.inverter + ") en de exacte softwareversie.");
    }
    if (a.phase === "unknown") {
      actions.push("Controleer bij je netbeheerder of in de meterkast of je aansluiting 1-fase of 3-fase is.");
    }

    if (actions.length === 0) actions.push("Verzamel je energiegegevens en beschrijf eerst welk probleem je wilt oplossen.");
    if (watchouts.length === 0) watchouts.push("Vraag om fabrikantdocumentatie, duidelijke garantievoorwaarden en een volledig overzicht van installatiekosten.");
    if (questions.length < 2) questions.push("Welke technische beperkingen en aannames zijn gebruikt in het advies?");
    if (questions.length < 3) questions.push("Wat is de beste vervolgstap als ik nu nog geen batterij aanschaf?");

    document.querySelector("#result-title").textContent = "Je eerste richting is bepaald.";
    document.querySelector("#result-summary").textContent = a.context ? "We hebben rekening gehouden met je ingevulde situatie en aanvullende opmerking." : "Dit advies is gebaseerd op jouw antwoorden. Het is bedoeld om je te helpen bepalen wat je als volgende stap kunt onderzoeken.";
    document.querySelector("#result-type").textContent = type;
    document.querySelector("#result-recommendation-title").textContent = title;
    document.querySelector("#result-recommendation-copy").textContent = copy;
    document.querySelector("#result-confidence").textContent = confidence;
    addListItems("result-actions", [...new Set(actions)]);
    addListItems("result-watchouts", [...new Set(watchouts)]);
    addListItems("result-questions-list", [...new Set(questions)].slice(0,5));

    form.closest(".wizard").hidden = true;
    result.hidden = false;
    result.scrollIntoView({behavior:"smooth",block:"start"});
  }

  document.querySelector("#print-advice").addEventListener("click", () => window.print());
  document.querySelector("#restart-advice").addEventListener("click", () => {
    form.reset();
    result.hidden = true;
    form.closest(".wizard").hidden = false;
    showStep(1);
  });
  showStep(1);
})();