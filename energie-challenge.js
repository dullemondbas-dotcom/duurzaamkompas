/* DuurzaamKompas Mijn Energie — navigation, demo interactions and authenticated household data. */
(() => {
  "use strict";
  const PROFILE_KEY = "dk_energy_profile_v1";
  const CHALLENGES_KEY = "dk_energy_challenges_v1";
  const NOTE_KEY = "dk_energy_note_hidden";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2800);
  }
  function readStore(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed === null ? fallback : parsed;
    } catch (_) { return fallback; }
  }
  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { showToast("Opslaan in deze browser is niet gelukt."); return false; }
  }
  function profile() { return readStore(PROFILE_KEY, null); }

  function setView(view) {
    const target = document.getElementById("view-" + view);
    if (!target) {
      console.warn("Onbekende Mijn Energie-pagina:", view);
      return false;
    }
    document.querySelectorAll(".view").forEach(section => {
      section.classList.toggle("active", section === target);
    });
    document.querySelectorAll(".nav-tab").forEach(button => {
      button.classList.toggle("active", button.dataset.view === view);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    return true;
  }
  window.DK_APP = Object.freeze({ navigateToView: setView });
  document.querySelectorAll(".nav-tab").forEach(button => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  const requestedView = new URLSearchParams(location.search).get("view");
  if (["dashboard","history","household","challenges","connections","admin"].includes(requestedView)) setView(requestedView);
  $$("[data-go]").forEach(button => button.addEventListener("click", () => setView(button.dataset.go)));

  const note = $(".prototype-note");
  if (readStore(NOTE_KEY, false) && note) note.hidden = true;
  $("#dismissNote")?.addEventListener("click", () => {
    if (note) note.hidden = true;
    writeStore(NOTE_KEY, true);
  });

  function updateNickname(name) {
    const nickname = name || "Demo gebruiker";
    $("#headerNickname").textContent = nickname;
    $("#welcomeNickname").textContent = ", " + nickname;
    $("#avatarInitial").textContent = nickname.slice(0, 1).toUpperCase();
    $("#leaderNickname").textContent = nickname;
  }
  function fillProfileForm(data) {
    const form = $("#householdForm");
    if (!form || !data) return;
    Object.entries(data).forEach(([key, value]) => {
      const field = form.elements.namedItem(key) || (key === "localConsent" ? form.elements.namedItem("profileConsent") : null);
      if (!field) return;
      if (field.type === "checkbox") field.checked = Boolean(value);
      else field.value = value == null ? "" : String(value);
    });
  }

  // Progressive Web App: install prompt, offline app shell and iOS guidance.
  let deferredInstallPrompt = null;
  const installButton = $("#installAppButton");
  const installHelpButton = $("#installHelpButton");
  const installHelpText = $("#installHelpText");
  const installCard = $("#installAppCard");
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (isStandalone && installCard) installCard.hidden = true;

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (installButton) installButton.hidden = false;
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    if (installCard) installCard.hidden = true;
    showToast("Mijn Energie is toegevoegd aan je apparaat.");
  });
  installButton?.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      if (installHelpText) installHelpText.hidden = false;
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (installButton) installButton.hidden = true;
  });
  installHelpButton?.addEventListener("click", () => {
    if (installHelpText) installHelpText.hidden = !installHelpText.hidden;
  });

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./energie-challenge-sw.js", { scope: "./" })
        .catch(() => showToast("Offline-modus kon niet worden geactiveerd. De app blijft online te gebruiken."));
    });
  }

  window.addEventListener("dk-account-changed", event => {
    const accountProfile = event.detail?.profile;
    if (event.detail?.user && accountProfile) {
      const localProfile = profile();
      const remoteHasHousehold = ["homeType","residents","area","buildPeriod","insulation","heating","solar","battery","ev","chargePoint","heatPump","smartControl","solarKwp","batteryKwh","municipality","contract"]
        .some(key => accountProfile[key] !== undefined && accountProfile[key] !== null && accountProfile[key] !== "" && accountProfile[key] !== false);
      if (localProfile && !remoteHasHousehold) {
        fillProfileForm(localProfile);
        const consentField = $("#householdForm")?.elements.namedItem("profileConsent");
        if (consentField) consentField.checked = false;
        $("#profileStatus").textContent = "Je eerder lokaal opgeslagen huishouden staat klaar. Controleer opnieuw je toestemming en sla het daarna op bij je account.";
      } else {
        fillProfileForm(accountProfile);
        if (remoteHasHousehold) localStorage.removeItem(PROFILE_KEY);
        $("#profileStatus").textContent = remoteHasHousehold
          ? "Je huishoudenprofiel is gekoppeld aan je account."
          : "Je account is gekoppeld. Vul je huishouden in of zet je lokale profiel over.";
      }
      if (accountProfile.nickname) updateNickname(accountProfile.nickname);
      const consentLabel = $('label.consent-line span');
      if (consentLabel) consentLabel.textContent = "Ik geef toestemming om mijn huishoudprofiel aan mijn account te koppelen en beveiligd op te slaan. Mijn adres wordt niet gevraagd en mijn profiel wordt niet openbaar getoond.";
    } else if (!event.detail?.user) {
      const consentLabel = $('label.consent-line span');
      if (consentLabel) consentLabel.textContent = "Ik begrijp dat dit profiel lokaal op dit apparaat wordt opgeslagen. Maak een account om het tussen apparaten te synchroniseren.";
      const localProfile = profile();
      if (localProfile) {
        fillProfileForm(localProfile);
        updateNickname(localProfile.nickname);
      } else {
        updateNickname("Demo gebruiker");
      }
      $("#profileStatus").textContent = "";
    }
  });

  const consentLabel = $('label.consent-line span');
  if (consentLabel) consentLabel.textContent = window.DK_ACCOUNT?.isSignedIn()
    ? "Ik geef toestemming om mijn huishoudprofiel aan mijn account te koppelen en beveiligd op te slaan. Mijn adres wordt niet gevraagd."
    : "Ik begrijp dat dit profiel lokaal op dit apparaat wordt opgeslagen. Maak een account om het tussen apparaten te synchroniseren.";

  const savedProfile = profile();
  if (savedProfile) {
    updateNickname(savedProfile.nickname);
    fillProfileForm(savedProfile);
    $("#profileStatus").textContent = "Je profiel staat lokaal opgeslagen in deze browser.";
  }

  $("#householdForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = {};
    [...form.elements].forEach(field => {
      if (!field.name) return;
      data[field.name] = field.type === "checkbox" ? field.checked : field.value.trim();
    });
    if (!data.profileConsent) return;
    if (window.DK_ACCOUNT?.isSignedIn()) {
      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      $("#profileStatus").textContent = "Je huishouden wordt beveiligd opgeslagen…";
      try {
        await window.DK_ACCOUNT.saveHousehold(data);
        localStorage.removeItem(PROFILE_KEY);
        updateNickname(data.nickname);
        $("#profileStatus").textContent = "Je profiel is opgeslagen bij je account en wordt gesynchroniseerd tussen je apparaten.";
        showToast("Je huishouden is online opgeslagen.");
      } catch (error) {
        console.error("Opslaan huishouden:", error);
        $("#profileStatus").textContent = error.message || "Online opslaan is niet gelukt.";
        showToast("Opslaan is niet gelukt. Controleer je accountinstellingen.");
      } finally {
        submitButton.disabled = false;
      }
      return;
    }
    if (!writeStore(PROFILE_KEY, data)) return;
    updateNickname(data.nickname);
    $("#profileStatus").textContent = "Opgeslagen op dit apparaat. Maak een account om het op meerdere apparaten te gebruiken.";
    showToast("Je huishouden is lokaal opgeslagen.");
  });

  const filterButtons = $$(".filter");
  filterButtons.forEach(button => button.addEventListener("click", () => {
    filterButtons.forEach(item => item.classList.toggle("active", item === button));
    const filter = button.dataset.filter;
    $$(".challenge-card", $("#challengeList")).forEach(card => {
      card.hidden = filter !== "all" && card.dataset.type !== filter;
    });
  }));

  const createPanel = $("#createChallengePanel");
  $("#showCreateChallenge")?.addEventListener("click", () => {
    createPanel.hidden = false;
    createPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  $("#closeCreateChallenge")?.addEventListener("click", () => { createPanel.hidden = true; });

  function renderCreatedChallenges() {
    const list = $("#challengeList");
    const items = readStore(CHALLENGES_KEY, []);
    items.forEach(item => {
      if ($('[data-local-id="' + item.id + '"]', list)) return;
      const card = document.createElement("article");
      card.className = "challenge-card";
      card.dataset.type = item.type;
      card.dataset.localId = item.id;
      const cover = document.createElement("div");
      cover.className = "challenge-cover " + (item.type === "public" ? "neighborhood-cover" : "friends-cover");
      const badge = document.createElement("span");
      badge.textContent = item.type === "public" ? "OPENBAAR · LOKAAL" : "BESLOTEN · LOKAAL";
      const symbol = document.createElement("b");
      symbol.textContent = item.type === "public" ? "🏡" : "⚡";
      cover.append(badge, symbol);
      const body = document.createElement("div");
      body.className = "challenge-body";
      const meta = document.createElement("div");
      meta.className = "challenge-meta";
      meta.textContent = item.duration + " · 1 deelnemer";
      const heading = document.createElement("h2");
      heading.textContent = item.title;
      const description = document.createElement("p");
      description.textContent = item.goal + ". Deze challenge is alleen op dit apparaat opgeslagen.";
      const bottom = document.createElement("div");
      bottom.className = "challenge-bottom";
      const tag = document.createElement("span");
      tag.className = "challenge-category";
      tag.textContent = "Eigen challenge";
      const button = document.createElement("button");
      button.className = "btn btn-small btn-secondary";
      button.type = "button";
      button.textContent = "Lokaal aangemaakt";
      bottom.append(tag, button);
      body.append(meta, heading, description, bottom);
      card.append(cover, body);
      list.prepend(card);
    });
  }
  renderCreatedChallenges();

  $("#createChallengeForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const entry = {
      id: "local-" + Date.now(),
      title: form.elements.title.value.trim(),
      type: form.elements.type.value,
      duration: form.elements.duration.value,
      goal: form.elements.goal.value
    };
    const items = readStore(CHALLENGES_KEY, []);
    items.push(entry);
    if (!writeStore(CHALLENGES_KEY, items)) return;
    renderCreatedChallenges();
    $("#challengeStatus").textContent = "Aangemaakt in deze browser. Nog niet zichtbaar voor anderen.";
    form.reset();
    showToast("Je challenge is lokaal aangemaakt.");
  });

  $$(".join-challenge").forEach(button => button.addEventListener("click", () => {
    const names = { neighborhood: "Buurt in beweging", friends: "Vrienden besparen samen", solar: "Meer uit je eigen zon" };
    showToast(names[button.dataset.id] + " is een fictieve demo-challenge. Online deelnemen is nog niet actief.");
  }));

  const integrationLabels = { home_assistant: "Home Assistant", homewizard: "HomeWizard P1" };
  const integrationByProvider = {};

  function integrationStatusText(item) {
    if (!item) return "Nog geen koppeling aangemaakt.";
    if (item.status === "connected") {
      const seen = item.last_seen_at ? new Date(item.last_seen_at).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" }) : "onbekend tijdstip";
      return "Verbonden · laatste meetwaarde ontvangen: " + seen + ".";
    }
    if (item.status === "pending") return "Koppelcode aangemaakt · wacht op de eerste meetwaarde.";
    if (item.status === "degraded") return "Er is eerder data ontvangen, maar de verbinding vraagt aandacht.";
    if (item.status === "revoked") return "Toegang ingetrokken. Je kunt later een nieuwe koppelcode maken.";
    return "De koppeling heeft aandacht nodig. Maak eventueel een nieuwe koppelcode.";
  }

  async function refreshIntegrationStatuses() {
    const statusNodes = $("[data-provider-status]");
    if (!window.DK_ACCOUNT?.isSignedIn?.()) {
      statusNodes.forEach(node => { node.textContent = "Log in om de koppelstatus te bekijken."; });
      $("[data-revoke-provider]").forEach(button => { button.hidden = true; });
      return;
    }
    try {
      const items = await window.DK_ACCOUNT.listEnergyIntegrations();
      Object.keys(integrationByProvider).forEach(key => delete integrationByProvider[key]);
      items.forEach(item => { integrationByProvider[item.provider] = item; });
      statusNodes.forEach(node => { node.textContent = integrationStatusText(integrationByProvider[node.dataset.providerStatus]); });
      $("[data-revoke-provider]").forEach(button => {
        const item = integrationByProvider[button.dataset.revokeProvider];
        button.hidden = !item || item.status === "revoked";
      });
      $("[data-connect-provider]").forEach(button => {
        const item = integrationByProvider[button.dataset.connectProvider];
        button.textContent = item && item.status !== "revoked" ? "Vervang koppelcode" : "Maak koppelcode";
      });
    } catch (error) {
      console.warn("Mijn Energie integratiestatus:", error);
      statusNodes.forEach(node => { node.textContent = "De koppelstatus kon niet worden opgehaald."; });
    }
  }

  function makeIntegrationToken() {
    if (!window.crypto?.getRandomValues || !window.crypto?.subtle) throw new Error("Je browser ondersteunt de beveiligde codegeneratie niet.");
    return Array.from(window.crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
  }

  async function hashIntegrationToken(token) {
    const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  }

  function showIntegrationToken(provider, token) {
    $("#integrationTokenTitle").textContent = integrationLabels[provider] + " · je koppelcode";
    $("#integrationTokenCode").textContent = token;
    $("#integrationTokenStatus").textContent = "Kopieer en bewaar deze code nu. Sluit je dit venster, dan tonen we de code niet opnieuw.";
    $("#integrationTokenInstructions").textContent = provider === "home_assistant"
      ? "Bewaar deze code straks als geheim in Home Assistant. We leveren de precieze YAML en sensorselectie zodra je installatie klaarstaat."
      : "Bewaar deze code voor de lokale HomeWizard-verbinding. De eerste route gebruikt Home Assistant als lokale brug; de losse brug bouwen we later.";
    $("#integrationTokenPanel").hidden = false;
    $("#integrationTokenPanel").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  $("[data-connect-provider]").forEach(button => button.addEventListener("click", async () => {
    const provider = button.dataset.connectProvider;
    if (!window.DK_ACCOUNT?.isSignedIn?.()) {
      showToast("Log eerst in om een persoonlijke koppelcode te maken.");
      $("#accountOpenButton")?.click();
      return;
    }
    if (!$("#energyDataConsent")?.checked) {
      showToast("Geef eerst toestemming voor het delen van energiemetingen.");
      $("#energyDataConsent")?.focus();
      return;
    }
    const existing = integrationByProvider[provider];
    if (existing && existing.status !== "revoked" && !window.confirm("De huidige koppelcode wordt direct vervangen. Een bestaande verbinding met de oude code stopt dan. Doorgaan?")) return;
    const previousLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Veilige code maken…";
    try {
      const token = makeIntegrationToken();
      const tokenHash = await hashIntegrationToken(token);
      await window.DK_ACCOUNT.createEnergyIntegration(provider, integrationLabels[provider], tokenHash);
      showIntegrationToken(provider, token);
      await refreshIntegrationStatuses();
      showToast("De persoonlijke koppelcode is aangemaakt.");
    } catch (error) {
      console.error("Mijn Energie: koppeling voorbereiden:", error);
      showToast(error?.message || "De koppeling kon niet worden voorbereid.");
    } finally {
      button.disabled = false;
      await refreshIntegrationStatuses();
    }
  }));

  $("[data-revoke-provider]").forEach(button => button.addEventListener("click", async () => {
    const provider = button.dataset.revokeProvider;
    const item = integrationByProvider[provider];
    if (!item) return;
    if (!window.confirm("Weet je zeker dat je " + integrationLabels[provider] + " wilt ontkoppelen? De huidige koppelcode wordt direct ongeldig.")) return;
    button.disabled = true;
    try {
      await window.DK_ACCOUNT.revokeEnergyIntegration(item.id);
      await refreshIntegrationStatuses();
      showToast("De koppeling is ingetrokken. Nieuwe meetgegevens worden niet meer geaccepteerd.");
    } catch (error) {
      showToast(error?.message || "Ontkoppelen is niet gelukt.");
    } finally { button.disabled = false; }
  }));

  $("#copyIntegrationToken")?.addEventListener("click", async () => {
    const token = $("#integrationTokenCode")?.textContent || "";
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      $("#integrationTokenStatus").textContent = "Gekopieerd. Bewaar de code op een veilige plek.";
    } catch (_) {
      $("#integrationTokenStatus").textContent = "Automatisch kopiëren lukte niet. Selecteer de code en kopieer deze handmatig.";
    }
  });
  $("#hideIntegrationToken")?.addEventListener("click", () => {
    $("#integrationTokenCode").textContent = "";
    $("#integrationTokenPanel").hidden = true;
  });
  function localDateKey(date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    const part = key => parts.find(item => item.type === key)?.value || "";
    return part("year") + "-" + part("month") + "-" + part("day");
  }

  function setMetricValue(id, value, unit, decimals = 1) {
    const node = $("#" + id);
    if (!node) return;
    node.replaceChildren();
    const strongText = document.createTextNode(value == null || !Number.isFinite(Number(value))
      ? "—" : new Intl.NumberFormat("nl-NL", { maximumFractionDigits: decimals }).format(Number(value)));
    node.append(strongText);
    const small = document.createElement("small");
    small.textContent = unit;
    node.append(small);
  }

  function renderEnergyChart(rows) {
    const columns = $("#energyChartColumns");
    const yAxis = $("#energyChartYAxis");
    if (!columns || !yAxis) return;
    columns.replaceChildren();

    const today = new Date();
    const dates = [];
    for (let offset = 7; offset >= 1; offset--) {
      dates.push(localDateKey(new Date(today.getTime() - offset * 86400000)));
    }
    const byDate = new Map(rows.map(row => [localDateKey(new Date(row.bucket_start)), row]));
    const validValues = dates.map(date => {
      const row = byDate.get(date);
      return row && Number(row.grid_coverage_ratio) >= 0.8 && row.grid_import_kwh != null
        ? Number(row.grid_import_kwh) : null;
    });
    const maximum = Math.max(0, ...validValues.filter(value => value != null));
    const scale = maximum > 0 ? Math.ceil(maximum * 1.15 * 10) / 10 : 5;
    const ticks = [scale, scale * 0.75, scale * 0.5, scale * 0.25, 0];
    yAxis.replaceChildren();
    ticks.forEach((tick, index) => {
      const label = document.createElement("span");
      label.textContent = index === 4 ? "0 kWh" : new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 }).format(tick);
      yAxis.append(label);
    });
    dates.forEach((date, index) => {
      const value = validValues[index];
      const group = document.createElement("div");
      group.className = "bar-group";
      const bars = document.createElement("div");
      bars.className = "bars";
      const bar = document.createElement("i");
      bar.className = "bar current";
      const height = value == null ? 0 : Math.max(2, (value / scale) * 100);
      bar.style.height = height + "%";
      bar.title = value == null ? "Geen complete meting" : new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 2 }).format(value) + " kWh";
      bars.append(bar);
      const label = document.createElement("small");
      const dayDate = new Date(date + "T12:00:00+01:00");
      label.textContent = new Intl.DateTimeFormat("nl-NL", {
        weekday: "short", day: "numeric", timeZone: "Europe/Amsterdam"
      }).format(dayDate);
      group.append(bars, label);
      columns.append(group);
    });
    const validCount = validValues.filter(value => value != null).length;
    $("#energyChartLabel").textContent = validCount ? validCount + " meetdagen" : "Geen data";
    $("#energyChartFootnote").textContent = validCount
      ? "Alleen complete meetdagen met minimaal 80% meetdekking. Dit is netafname, niet automatisch het totale stroomverbruik van een woning met zonnepanelen of batterij."
      : "Er zijn nog geen complete meetdagen beschikbaar. Na het koppelen van een meter verschijnen hier je werkelijke waarden.";
  }

  async function refreshDashboardMetrics() {
    if (!window.DK_ACCOUNT?.isSignedIn?.()) {
      setMetricValue("metricGridImport", null, "kWh");
      setMetricValue("metricGridExport", null, "kWh");
      setMetricValue("metricGas", null, "m³");
      setMetricValue("metricDataCoverage", null, "%");
      $("#metricGridImportCaption").textContent = "Log in en koppel een meter";
      $("#metricGridExportCaption").textContent = "Log in en koppel een meter";
      $("#metricGasCaption").textContent = "Log in en koppel een meter";
      $("#metricDataCoverageCaption").textContent = "Nog geen persoonlijke meetgegevens";
      $("#metricValidDays").textContent = "0 geldige dagen";
      $("#energyStatusTitle").textContent = "Nog geen meterdata";
      $("#energyStatusText").textContent = "Koppel Home Assistant of HomeWizard P1 om te beginnen.";
      renderEnergyChart([]);
      return;
    }
    try {
      const [rows, integrations] = await Promise.all([
        window.DK_ACCOUNT.listEnergyDailyAggregates(50),
        window.DK_ACCOUNT.listEnergyIntegrations()
      ]);
      const now = new Date();
      const monthPrefix = localDateKey(new Date(now.getFullYear(), now.getMonth(), 1)).slice(0, 7);
      const monthRows = rows.filter(row => localDateKey(new Date(row.bucket_start)).slice(0, 7) === monthPrefix);
      const gridRows = monthRows.filter(row => row.grid_import_kwh != null && Number(row.grid_coverage_ratio || 0) >= 0.8);
      const exportRows = monthRows.filter(row => row.grid_export_kwh != null && Number(row.grid_coverage_ratio || 0) >= 0.8);
      const gasRows = monthRows.filter(row => row.gas_m3 != null && Number(row.gas_coverage_ratio || 0) >= 0.8);
      const importTotal = gridRows.reduce((sum, row) => sum + Number(row.grid_import_kwh || 0), 0);
      const exportTotal = exportRows.reduce((sum, row) => sum + Number(row.grid_export_kwh || 0), 0);
      const gasTotal = gasRows.reduce((sum, row) => sum + Number(row.gas_m3 || 0), 0);
      const coverageValues = gridRows.map(row => Number(row.grid_coverage_ratio || 0));
      const averageCoverage = coverageValues.length
        ? coverageValues.reduce((sum, value) => sum + value, 0) / coverageValues.length : null;
      const monthLabel = new Intl.DateTimeFormat("nl-NL", { month: "long" }).format(now);

      setMetricValue("metricGridImport", gridRows.length ? importTotal : null, "kWh");
      setMetricValue("metricGridExport", exportRows.length ? exportTotal : null, "kWh");
      setMetricValue("metricGas", gasRows.length ? gasTotal : null, "m³");
      setMetricValue("metricDataCoverage", averageCoverage == null ? null : averageCoverage * 100, "%", 0);
      $("#metricGridImportCaption").textContent = gridRows.length ? monthLabel + " · " + gridRows.length + " complete meetdagen" : "Deze maand · nog geen complete metingen";
      $("#metricGridExportCaption").textContent = exportRows.length ? monthLabel + " · gemeten teruglevering" : "Deze maand · geen terugleverdata";
      $("#metricGasCaption").textContent = gasRows.length ? monthLabel + " · " + gasRows.length + " complete meetdagen" : "Deze maand · geen complete gasmeting";
      $("#metricDataCoverageCaption").textContent = averageCoverage == null
        ? "Wacht op complete meetdagen" : "Gemiddelde dekking van geldige stroomdagen";
      $("#metricValidDays").textContent = gridRows.length + " geldige dagen";

      const hasConnected = integrations.some(item => item.status === "connected");
      const hasPending = integrations.some(item => item.status === "pending");
      if (gridRows.length || gasRows.length) {
        $("#energyStatusTitle").textContent = "Je metergegevens zijn beschikbaar";
        $("#energyStatusText").textContent = gridRows.length + " complete stroomdagen en " + gasRows.length + " complete gasdagen deze maand.";
      } else if (hasConnected) {
        $("#energyStatusTitle").textContent = "Koppeling actief";
        $("#energyStatusText").textContent = "De koppeling is actief. De eerste complete meetdag wordt verwerkt zodra er genoeg metingen zijn.";
      } else if (hasPending) {
        $("#energyStatusTitle").textContent = "Koppelcode aangemaakt";
        $("#energyStatusText").textContent = "De meter moet nog met Mijn Energie worden verbonden.";
      } else {
        $("#energyStatusTitle").textContent = "Nog geen meter gekoppeld";
        $("#energyStatusText").textContent = "Koppel Home Assistant of HomeWizard P1 om je werkelijke energiegebruik te zien.";
      }
      renderEnergyChart(rows);
    } catch (error) {
      console.warn("Mijn Energie meetwaarden:", error);
      $("#energyStatusTitle").textContent = "Meetgegevens tijdelijk niet beschikbaar";
      $("#energyStatusText").textContent = "We konden je meetoverzicht nu niet ophalen.";
    }
  }

  let activeHistoryPeriod = "month";

  function formatMeasure(value, unit) {
    const number = Number(value);
    return Number.isFinite(number)
      ? new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 }).format(number) + (unit ? " " + unit : "")
      : "—";
  }

  function setHistorySummary(rows) {
    const latest = rows[0];
    if (!latest) return;
    const electricity = latest.grid_import_difference_kwh == null ? null : Number(latest.grid_import_difference_kwh);
    const gas = latest.gas_difference_m3 == null ? null : Number(latest.gas_difference_m3);
    const cost = latest.estimated_variable_cost_difference_eur == null ? null : Number(latest.estimated_variable_cost_difference_eur);
    $("#historyElectricityValue").textContent = electricity == null ? "—" : formatMeasure(electricity, "kWh");
    $("#historyElectricityLabel").textContent = electricity == null ? "Nog geen betrouwbare vergelijking" : (electricity >= 0 ? "Minder netafname dan je referentie" : "Meer netafname dan je referentie");
    $("#historyGasValue").textContent = gas == null ? "—" : formatMeasure(gas, "m³");
    $("#historyGasLabel").textContent = gas == null ? "Nog geen betrouwbare vergelijking" : (gas >= 0 ? "Minder gas dan je referentie" : "Meer gas dan je referentie");
    $("#historyCostValue").textContent = cost == null ? "—" : (cost >= 0 ? "€ " : "−€ ") + formatMeasure(Math.abs(cost), "");
    $("#historyCostLabel").textContent = latest.cost_method === "interval_rate"
      ? "Berekend met tijdsafhankelijke tarieven"
      : latest.cost_method === "fixed_rate"
        ? "Berekend met je variabele contracttarief"
        : latest.cost_method === "indicative"
          ? "Indicatie op basis van beschikbare tarieven"
          : "Niet berekend: geen bruikbare tariefdata";
    $("#historyQualityCaption").textContent = "Datakwaliteit: " + (latest.quality_label || "onbekend") + " · meetdekking " + Math.round(Number(latest.coverage_ratio || 0) * 100) + "%";
  }

  function renderHistoryRows(rows) {
    const list = $("#historyPeriodList");
    list.replaceChildren();
    rows.forEach(row => {
      const item = document.createElement("article");
      item.className = "history-period-item";
      const dates = document.createElement("div");
      dates.className = "history-period-date";
      const label = document.createElement("strong");
      const start = new Date(row.period_start + "T12:00:00");
      label.textContent = start.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
      const detail = document.createElement("small");
      detail.textContent = row.period_type === "week"
        ? "Week van " + start.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })
        : row.period_type === "year" ? "Jaaroverzicht" : "Maandoverzicht";
      dates.append(label, detail);
      const outcome = document.createElement("div");
      outcome.className = "history-period-outcomes";
      const electricity = document.createElement("span");
      electricity.textContent = row.grid_import_difference_kwh == null ? "Stroom: —" : "Stroom: " + formatMeasure(row.grid_import_difference_kwh, "kWh");
      const gas = document.createElement("span");
      gas.textContent = row.gas_difference_m3 == null ? "Gas: —" : "Gas: " + formatMeasure(row.gas_difference_m3, "m³");
      outcome.append(electricity, gas);
      const quality = document.createElement("span");
      quality.className = "history-quality-label";
      quality.textContent = (row.quality_label || "onbekend") + " · " + Math.round(Number(row.coverage_ratio || 0) * 100) + "% dekking";
      item.append(dates, outcome, quality);
      list.append(item);
    });
  }

  async function refreshHistory() {
    if (!window.DK_ACCOUNT?.isSignedIn?.()) {
      $("#historyLoginNotice").hidden = false;
      $("#historyEmptyState").hidden = true;
      $("#historyContent").hidden = true;
      return;
    }
    $("#historyLoginNotice").hidden = true;
    try {
      const rows = await window.DK_ACCOUNT.listEnergySavingsPeriods(activeHistoryPeriod);
      if (!rows.length) {
        $("#historyEmptyState").hidden = false;
        $("#historyContent").hidden = true;
        return;
      }
      $("#historyEmptyState").hidden = true;
      $("#historyContent").hidden = false;
      setHistorySummary(rows);
      renderHistoryRows(rows);
    } catch (error) {
      console.warn("Mijn Energie geschiedenis:", error);
      $("#historyEmptyState").hidden = false;
      $("#historyContent").hidden = true;
    }
  }

  async function renderDashboardWeeklyTip() {
    const container = $("#dashboardWeeklyTipActions");
    if (!window.DK_ACCOUNT?.isSignedIn?.()) {
      $("#dashboardWeeklyTipTitle").textContent = "Log in voor je persoonlijke voortgang.";
      $("#dashboardWeeklyTipSummary").textContent = "Je energiegeschiedenis en weektips worden aan je huishouden gekoppeld.";
      $("#dashboardWeeklyTipAction").textContent = "";
      container.replaceChildren();
      return;
    }
    try {
      const tip = await window.DK_ACCOUNT.getLatestWeeklyTip();
      if (!tip) {
        $("#dashboardWeeklyTipTitle").textContent = "We bouwen eerst een eerlijke nulmeting op.";
        $("#dashboardWeeklyTipSummary").textContent = "Zodra we je energiegebruik betrouwbaar kunnen vergelijken, krijg je iedere week één persoonlijke tip. Zonder meetdata geven we alleen profielgerichte adviezen.";
        $("#dashboardWeeklyTipAction").textContent = "";
        const link = document.createElement("button");
        link.type = "button";
        link.className = "text-button";
        link.textContent = "Bekijk je koppelingen →";
        link.addEventListener("click", () => setView("connections"));
        container.replaceChildren(link);
        return;
      }
      $("#dashboardWeeklyTipTitle").textContent = tip.title;
      $("#dashboardWeeklyTipSummary").textContent = tip.summary + " " + tip.why_this_tip;
      $("#dashboardWeeklyTipAction").textContent = "Deze week: " + tip.action_text + (tip.expected_effect ? " · " + tip.expected_effect : "");
      container.replaceChildren();
      const addAction = (label, status, className = "text-button") => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = className;
        button.textContent = label;
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            await window.DK_ACCOUNT.updateWeeklyTipStatus(tip.id, status);
            showToast("Je tip is bijgewerkt.");
            await renderDashboardWeeklyTip();
          } catch (error) {
            showToast(error?.message || "Opslaan lukte niet.");
          } finally {
            button.disabled = false;
          }
        });
        container.append(button);
      };
      if (tip.status === "completed") {
        const done = document.createElement("span");
        done.className = "weekly-tip-complete";
        done.textContent = "Afgerond";
        container.append(done);
      } else if (tip.status === "dismissed") {
        const dismissed = document.createElement("span");
        dismissed.className = "weekly-tip-complete";
        dismissed.textContent = "Niet relevant voor mij";
        container.append(dismissed);
      } else {
        addAction("Bewaar", "saved");
        addAction("Ga ik doen", "accepted");
        addAction("Past niet", "dismissed");
        if (tip.status === "accepted" || tip.status === "saved") addAction("Afgerond", "completed", "btn btn-primary btn-small");
      }
      if (tip.source_url) {
        const source = document.createElement("a");
        source.className = "text-button";
        source.href = tip.source_url;
        source.target = "_blank";
        source.rel = "noopener noreferrer";
        source.textContent = "Bron bij deze tip ↗";
        container.append(source);
      }
    } catch (error) {
      console.warn("Mijn Energie weektip:", error);
    }
  }

  $("[data-history-period]").forEach(button => button.addEventListener("click", () => {
    activeHistoryPeriod = button.dataset.historyPeriod;
    $("[data-history-period]").forEach(node => node.classList.toggle("active", node === button));
    void refreshHistory();
  }));

  let adminTipsCache = [];
  let adminFactorsCache = [];

  function showAdminStatus(id, message) {
    const node = $("#" + id);
    if (node) node.textContent = message;
  }

  function resetAdminTipForm() {
    const form = $("#adminTipForm");
    if (!form) return;
    form.reset();
    form.elements.tip_code.readOnly = false;
    form.elements.enabled.checked = true;
    form.elements.priority.value = "100";
    form.elements.version.value = "1";
    form.elements.trigger_parameters.value = "{}";
    $("#adminTipFormTitle").textContent = "Nieuwe tip toevoegen";
    $("#saveAdminTipButton").textContent = "Tip opslaan";
    showAdminStatus("adminTipStatus", "");
  }

  function editAdminTip(code) {
    const tip = adminTipsCache.find(item => item.tip_code === code);
    if (!tip) return;
    const form = $("#adminTipForm");
    Object.entries({
      tip_code: tip.tip_code, category: tip.category, title: tip.title,
      source_name: tip.source_name || "", summary: tip.summary,
      why_template: tip.why_template || "", action_text: tip.action_text,
      expected_effect_template: tip.expected_effect_template || "",
      trigger_type: tip.trigger_type,
      trigger_parameters: JSON.stringify(tip.trigger_parameters || {}),
      cost_band: tip.cost_band, effort_band: tip.effort_band,
      priority: tip.priority, version: tip.version,
      source_url: tip.source_url || "", source_checked_at: tip.source_checked_at || ""
    }).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value; });
    form.elements.enabled.checked = Boolean(tip.enabled);
    form.elements.requires_measurement.checked = Boolean(tip.requires_measurement);
    form.elements.tip_code.readOnly = true;
    $("#adminTipFormTitle").textContent = "Tip aanpassen";
    $("#saveAdminTipButton").textContent = "Wijzigingen opslaan";
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderAdminTips() {
    const list = $("#adminTipList");
    list.replaceChildren();
    adminTipsCache.forEach(tip => {
      const row = document.createElement("article");
      row.className = "admin-list-row";
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = tip.title;
      const meta = document.createElement("small");
      meta.textContent = tip.tip_code + " · " + tip.trigger_type + " · prioriteit " + tip.priority;
      const state = document.createElement("span");
      state.className = "admin-state";
      state.textContent = tip.enabled ? "Actief" : "Concept";
      copy.append(title, meta, state);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-secondary btn-small";
      button.textContent = "Bewerken";
      button.addEventListener("click", () => editAdminTip(tip.tip_code));
      row.append(copy, button);
      list.append(row);
    });
    if (!adminTipsCache.length) list.textContent = "Er zijn nog geen tips aangemaakt.";
  }

  function renderAdminFactors() {
    const list = $("#adminFactorList");
    list.replaceChildren();
    adminFactorsCache.forEach(factor => {
      const row = document.createElement("article");
      row.className = "admin-list-row";
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = factor.factor_type.replaceAll("_", " ");
      const value = document.createElement("small");
      value.textContent = factor.factor_value + " " + factor.unit + " · geldig vanaf " + factor.valid_from;
      const source = document.createElement("a");
      source.href = factor.source_url;
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      source.textContent = factor.source_name + " ↗";
      source.className = "admin-factor-source";
      copy.append(title, value, source);
      row.append(copy);
      list.append(row);
    });
    if (!adminFactorsCache.length) list.textContent = "Nog geen rekenfactoren. Dit is bewust leeg totdat een gecontroleerde bron en methode zijn ingevoerd.";
  }

  async function loadAdminConsole() {
    try {
      const [tips, factors] = await Promise.all([
        window.DK_ACCOUNT.listAdminEnergyTips(),
        window.DK_ACCOUNT.listAdminEnergyFactors()
      ]);
      adminTipsCache = tips;
      adminFactorsCache = factors;
      renderAdminTips();
      renderAdminFactors();
    } catch (error) {
      console.warn("Mijn Energie beheer:", error);
      showAdminStatus("adminEngineStatus", error?.message || "De beheerdata kon niet worden geladen.");
    }
  }

  async function refreshAdminAccess() {
    const nav = $("#adminNavTab");
    const controls = $("#adminControls");
    if (nav) nav.hidden = true;
    if (!window.DK_ACCOUNT?.isSignedIn?.()) {
      if (controls) controls.hidden = true;
      if ($("#view-admin")?.classList.contains("active")) setView("dashboard");
      return;
    }
    try {
      const allowed = await window.DK_ACCOUNT.isPlatformAdmin();
      if (nav) nav.hidden = !allowed;
      if (controls) controls.hidden = !allowed;
      $("#adminAccessDenied").hidden = allowed;
      if (allowed) await loadAdminConsole();
      else if ($("#view-admin")?.classList.contains("active")) setView("dashboard");
    } catch (error) {
      if (controls) controls.hidden = true;
      $("#adminAccessDenied").hidden = false;
      console.warn("Mijn Energie beheerrechten:", error);
    }
  }

  $("#adminTipForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      data.trigger_parameters = JSON.parse(data.trigger_parameters || "{}");
      if (!data.trigger_parameters || Array.isArray(data.trigger_parameters) || typeof data.trigger_parameters !== "object") {
        throw new Error("Voorwaarde-parameters moeten een JSON-object zijn.");
      }
    } catch (error) {
      showAdminStatus("adminTipStatus", error?.message || "Ongeldige JSON-parameters.");
      return;
    }
    data.priority = Number(data.priority);
    data.version = Number(data.version);
    data.enabled = form.elements.enabled.checked;
    data.requires_measurement = form.elements.requires_measurement.checked;
    data.source_checked_at = data.source_checked_at || null;
    const button = $("#saveAdminTipButton");
    button.disabled = true;
    try {
      await window.DK_ACCOUNT.saveAdminEnergyTip(data);
      showAdminStatus("adminTipStatus", "Tip opgeslagen.");
      resetAdminTipForm();
      await loadAdminConsole();
      showToast("De tip is bijgewerkt.");
    } catch (error) {
      showAdminStatus("adminTipStatus", error?.message || "De tip kon niet worden opgeslagen.");
    } finally { button.disabled = false; }
  });

  $("#resetAdminTipForm")?.addEventListener("click", resetAdminTipForm);

  $("#adminFactorForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    data.factor_value = Number(data.factor_value);
    data.valid_until = data.valid_until || null;
    try {
      const result = await window.DK_ACCOUNT.saveAdminEnergyFactor(data);
      showAdminStatus("adminFactorStatus", "Factor opgeslagen: " + result.factor_type + " vanaf " + result.valid_from + ".");
      form.reset();
      adminFactorsCache = await window.DK_ACCOUNT.listAdminEnergyFactors();
      renderAdminFactors();
      showToast("De rekenfactor is opgeslagen.");
    } catch (error) {
      showAdminStatus("adminFactorStatus", error?.message || "De factor kon niet worden opgeslagen.");
    }
  });

  $("#runEnergyEngineButton")?.addEventListener("click", async buttonEvent => {
    const button = buttonEvent.currentTarget;
    button.disabled = true;
    showAdminStatus("adminEngineStatus", "De verwerking wordt gestart…");
    try {
      const result = await window.DK_ACCOUNT.runAdminEnergyAnalytics();
      showAdminStatus("adminEngineStatus",
        "Klaar · " + result.daily_rows_upserted + " dagregels bijgewerkt · " +
        result.active_baselines_refreshed + " nulmetingen ververst · " +
        result.savings_periods_upserted + " perioden bijgewerkt · " +
        result.weekly_tips_created + " nieuwe weektips.");
      await Promise.all([loadAdminConsole(),refreshDashboardMetrics(),refreshLearningViews()]);
    } catch (error) {
      showAdminStatus("adminEngineStatus", error?.message || "De verwerking is niet gelukt.");
    } finally { button.disabled = false; }
  });

  async function refreshLearningViews() {
    await Promise.all([refreshHistory(), renderDashboardWeeklyTip()]);
  }
  window.addEventListener("dk-account-changed", event => {
    if (!event.detail?.user) {
      $("#integrationTokenCode").textContent = "";
      $("#integrationTokenPanel").hidden = true;
      $("#energyDataConsent").checked = false;
    }
    void refreshIntegrationStatuses();
    void refreshLearningViews();
    void refreshDashboardMetrics();
    void refreshAdminAccess();
  });
  void refreshIntegrationStatuses();
  void refreshLearningViews();
  void refreshDashboardMetrics();
  void refreshAdminAccess();

  $("#resetDemo")?.addEventListener("click", () => {
    if (!window.confirm("Je lokaal opgeslagen profiel en zelfgemaakte demo-challenges verwijderen?")) return;
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(CHALLENGES_KEY);
    localStorage.removeItem(NOTE_KEY);
    window.location.reload();
  });
})();