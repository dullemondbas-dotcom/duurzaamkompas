(() => {
  "use strict";

  const storageKey = "duurzaamkompas-kijklijst-v1";
  const cards = Array.from(document.querySelectorAll(".watch-resource-card"));
  const filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
  const searchInput = document.getElementById("resource-search");
  const countLabel = document.getElementById("resource-count");
  const emptyState = document.getElementById("no-results");
  const savedCount = document.getElementById("saved-count");
  const savedListCount = document.getElementById("saved-list-count");
  const showSavedButton = document.getElementById("show-saved");
  const showMyListButton = document.getElementById("show-my-list");
  const clearListButton = document.getElementById("clear-my-list");
  const resetFiltersButton = document.getElementById("reset-filters");
  const filterBar = document.querySelector(".watch-filter-row");

  let activeFilter = "all";
  let savedOnly = false;
  let savedIds = readSavedIds();
  const allFilterCount = document.querySelector('[data-filter-count="all"]');
  if (allFilterCount) allFilterCount.textContent = String(cards.length);

  function readSavedIds() {
    try {
      const raw = localStorage.getItem(storageKey);
      const values = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(values) ? values.filter(v => typeof v === "string") : []);
    } catch (error) {
      return new Set();
    }
  }

  function persistSavedIds() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(savedIds)));
    } catch (error) {
      // The page still works for this visit if browser storage is blocked.
    }
  }

  function updateSavedUI() {
    const total = savedIds.size;
    if (savedCount) savedCount.textContent = String(total);
    if (savedListCount) savedListCount.textContent = String(total);
    if (clearListButton) clearListButton.disabled = total === 0;
    if (showSavedButton) {
      showSavedButton.setAttribute("aria-pressed", String(savedOnly));
      showSavedButton.classList.toggle("active", savedOnly);
    }
    if (showMyListButton) {
      showMyListButton.textContent = savedOnly ? "Toon alle bronnen ↓" : "Toon mijn bewaarde bronnen ↓";
    }
    const title = document.getElementById("saved-progress-title");
    const subtitle = document.getElementById("saved-progress-text");
    if (title && subtitle) {
      if (total === 0) {
        title.textContent = "Je kijklijst is nog leeg.";
        subtitle.textContent = "Bewaar een bron uit de bibliotheek om hier je lijst op te bouwen.";
      } else if (total === 1) {
        title.textContent = "Je hebt 1 bron bewaard.";
        subtitle.textContent = "Open je lijst en kies wat je als eerste wilt bekijken of beluisteren.";
      } else {
        title.textContent = "Je hebt " + total + " bronnen bewaard.";
        subtitle.textContent = "Je kijk- en luisterroute staat klaar op dit apparaat.";
      }
    }
  }

  function setFilter(name) {
    activeFilter = name;
    filterButtons.forEach(button => {
      const isActive = button.dataset.filter === name;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
    applyFilters();
  }

  function applyFilters() {
    const term = (searchInput?.value || "").trim().toLocaleLowerCase("nl");
    let visible = 0;
    cards.forEach(card => {
      const topics = (card.dataset.topics || "").split(/\s+/);
      const searchable = (card.dataset.search || card.textContent).toLocaleLowerCase("nl");
      const topicMatch = activeFilter === "all" || topics.includes(activeFilter);
      const searchMatch = !term || searchable.includes(term);
      const savedMatch = !savedOnly || savedIds.has(card.dataset.resource);
      const show = topicMatch && searchMatch && savedMatch;
      card.hidden = !show;
      if (show) visible += 1;
    });

    if (countLabel) {
      countLabel.textContent = savedOnly
        ? visible + " bewaarde bron" + (visible === 1 ? "" : "nen") + " zichtbaar"
        : visible + " van " + cards.length + " bronnen zichtbaar";
    }
    if (emptyState) {
      emptyState.hidden = visible !== 0;
      const label = emptyState.querySelector("b");
      const detail = emptyState.querySelector("span");
      if (savedOnly && savedIds.size === 0) {
        if (label) label.textContent = "Je kijklijst is nog leeg.";
        if (detail) detail.textContent = "Bewaar een video of podcast met de knop ‘Bewaar’ om hier je eigen lijst te maken.";
      } else if (savedOnly) {
        if (label) label.textContent = "Geen bewaarde bronnen gevonden.";
        if (detail) detail.textContent = "Wis de zoekterm of onderwerpfilter om je volledige kijklijst te zien.";
      } else {
        if (label) label.textContent = "Geen bronnen gevonden.";
        if (detail) detail.textContent = "Pas je zoekterm of onderwerpfilter aan.";
      }
    }
  }

  function syncSaveCheckboxes() {
    document.querySelectorAll("[data-save]").forEach(input => {
      input.checked = savedIds.has(input.dataset.save);
    });
    updateSavedUI();
  }

  filterButtons.forEach(button => {
    button.addEventListener("click", () => {
      if (button.id === "show-saved") {
        savedOnly = !savedOnly;
        updateSavedUI();
        applyFilters();
        return;
      }
      savedOnly = false;
      updateSavedUI();
      setFilter(button.dataset.filter);
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }

  document.querySelectorAll("[data-save]").forEach(input => {
    input.addEventListener("change", () => {
      const id = input.dataset.save;
      if (input.checked) savedIds.add(id);
      else savedIds.delete(id);
      persistSavedIds();
      syncSaveCheckboxes();
      applyFilters();
    });
  });

  if (showMyListButton) {
    showMyListButton.addEventListener("click", () => {
      savedOnly = !savedOnly;
      activeFilter = "all";
      if (searchInput) searchInput.value = "";
      setFilter("all");
      updateSavedUI();
      applyFilters();
      document.getElementById("ontdek")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (showSavedButton) {
    showSavedButton.addEventListener("click", () => {
      savedOnly = !savedOnly;
      updateSavedUI();
      applyFilters();
      document.getElementById("ontdek")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (clearListButton) {
    clearListButton.addEventListener("click", () => {
      savedIds.clear();
      persistSavedIds();
      syncSaveCheckboxes();
      applyFilters();
    });
  }

  if (resetFiltersButton) {
    resetFiltersButton.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      savedOnly = false;
      updateSavedUI();
      setFilter("all");
    });
  }

  document.querySelectorAll("[data-jump-filter]").forEach(link => {
    link.addEventListener("click", () => {
      const targetFilter = link.dataset.jumpFilter || "all";
      savedOnly = false;
      if (searchInput) searchInput.value = "";
      setFilter(targetFilter);
      updateSavedUI();
    });
  });

  // Three-question knowledge check. Feedback is immediate and is not stored.
  const questions = Array.from(document.querySelectorAll(".watch-question"));
  const scoreLabel = document.getElementById("quiz-score");

  function updateQuizScore() {
    const completed = questions.filter(question => question.dataset.answered === "true");
    if (!scoreLabel) return;
    if (completed.length < questions.length) {
      scoreLabel.textContent = completed.length + " van " + questions.length + " vragen beantwoord.";
      return;
    }
    const correct = questions.filter(question => question.dataset.result === "correct").length;
    scoreLabel.textContent = "Je hebt " + correct + " van de " + questions.length + " vragen goed. " +
      (correct === questions.length ? "Mooi! De basis zit goed." : "Bekijk de uitleg bij je antwoorden en probeer het opnieuw.");
  }

  questions.forEach(question => {
    const answers = Array.from(question.querySelectorAll(".watch-answers button"));
    const feedback = question.querySelector(".watch-feedback");
    answers.forEach(button => {
      button.addEventListener("click", () => {
        if (question.dataset.answered === "true") return;
        const isCorrect = button.dataset.correct === "true";
        question.dataset.answered = "true";
        question.dataset.result = isCorrect ? "correct" : "incorrect";
        answers.forEach(answer => {
          answer.disabled = true;
          if (answer.dataset.correct === "true") answer.classList.add("answer-correct");
          if (answer === button && !isCorrect) answer.classList.add("answer-incorrect");
        });
        if (feedback) {
          const explanation = question.dataset.explanation || "";
          feedback.textContent = (isCorrect ? "Goed antwoord. " : "Niet helemaal. ") + explanation;
          feedback.classList.add(isCorrect ? "feedback-correct" : "feedback-incorrect");
        }
        updateQuizScore();
      });
    });
  });

  const resetQuizButton = document.getElementById("reset-quiz");
  if (resetQuizButton) {
    resetQuizButton.addEventListener("click", () => {
      questions.forEach(question => {
        delete question.dataset.answered;
        delete question.dataset.result;
        question.querySelectorAll(".watch-answers button").forEach(button => {
          button.disabled = false;
          button.classList.remove("answer-correct", "answer-incorrect");
        });
        const feedback = question.querySelector(".watch-feedback");
        if (feedback) {
          feedback.textContent = "";
          feedback.classList.remove("feedback-correct", "feedback-incorrect");
        }
      });
      updateQuizScore();
    });
  }

  // Explanations are authored here, separately from the answer controls.
  const explanations = [
    "Capaciteit wordt uitgedrukt in kWh en geeft aan hoeveel energie de batterij kan opslaan. Vermogen in kW zegt hoe snel hij kan laden of ontladen.",
    "Een batterij kan een piek afvlakken, maar ook op een ongunstig moment laden of ontladen. Tijdstip, locatie en aansturing bepalen het neteffect.",
    "Noodstroom vereist geschikte hardware en een ontworpen back-upfunctie. Niet iedere batterij levert automatisch stroom bij netuitval."
  ];
  questions.forEach((question, index) => { question.dataset.explanation = explanations[index] || ""; });

  syncSaveCheckboxes();
  applyFilters();
  updateQuizScore();
})();