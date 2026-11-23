/* DuurzaamKompas Energie Challenge — static prototype only.
   Profiles and demo-created challenges are stored in this browser's localStorage.
   No account, external data transfer, partner tracking or smart-meter connection exists yet. */
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
    $$(".view").forEach(section => section.classList.toggle("active", section.id === "view-" + view));
    $$(".nav-tab").forEach(button => button.classList.toggle("active", button.dataset.view === view));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $(".nav-tab").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
  const requestedView = new URLSearchParams(location.search).get("view");
  if (["dashboard","household","challenges","connections"].includes(requestedView)) setView(requestedView);
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
      const field = form.elements.namedItem(key);
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

  $("#notifyHa")?.addEventListener("click", () => {
    $("#haStatus").textContent = "De interesseknop is een prototype. Er wordt nog geen e-mailadres verzonden of koppeling aangemaakt.";
    showToast("De Home Assistant-koppeling is nog in ontwikkeling.");
  });

  $("#resetDemo")?.addEventListener("click", () => {
    if (!window.confirm("Je lokaal opgeslagen profiel en zelfgemaakte demo-challenges verwijderen?")) return;
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(CHALLENGES_KEY);
    localStorage.removeItem(NOTE_KEY);
    window.location.reload();
  });
})();