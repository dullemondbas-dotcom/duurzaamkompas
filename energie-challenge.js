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
  $$(".nav-tab").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
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

  const savedProfile = profile();
  if (savedProfile) {
    updateNickname(savedProfile.nickname);
    fillProfileForm(savedProfile);
    $("#profileStatus").textContent = "Je profiel staat lokaal opgeslagen in deze browser.";
  }

  $("#householdForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = {};
    [...form.elements].forEach(field => {
      if (!field.name) return;
      data[field.name] = field.type === "checkbox" ? field.checked : field.value.trim();
    });
    if (!data.localConsent) return;
    if (!writeStore(PROFILE_KEY, data)) return;
    updateNickname(data.nickname);
    $("#profileStatus").textContent = "Opgeslagen op dit apparaat. Nog niet online gedeeld.";
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