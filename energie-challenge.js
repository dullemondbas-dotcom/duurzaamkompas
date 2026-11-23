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
  if (["dashboard","history","household","challenges","connections"].includes(requestedView)) setView(requestedView);
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
  });
  void refreshIntegrationStatuses();
  void refreshLearningViews();

  $("#resetDemo")?.addEventListener("click", () => {
    if (!window.confirm("Je lokaal opgeslagen profiel en zelfgemaakte demo-challenges verwijderen?")) return;
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(CHALLENGES_KEY);
    localStorage.removeItem(NOTE_KEY);
    window.location.reload();
  });
})();