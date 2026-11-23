/* DuurzaamKompas — interactive smart-device library */
(() => {
  const search = document.querySelector("#smart-device-search");
  const filters = [...document.querySelectorAll(".smart-filter")];
  const cards = [...document.querySelectorAll(".smart-device-card")];
  const count = document.querySelector("#smart-device-count");
  const empty = document.querySelector("#smart-device-empty");
  const reset = document.querySelector("#smart-device-reset");
  if (!search || !count || !empty || !reset || !cards.length) return;
  let activeFilter = "all";
  const normalise = value => value.toLocaleLowerCase("nl").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  function applyFilters() {
    const query = normalise(search.value.trim());
    let visible = 0;
    cards.forEach(card => {
      const categoryMatch = activeFilter === "all" || card.dataset.category.split(/\s+/).includes(activeFilter);
      const searchMatch = !query || normalise((card.dataset.search || "") + " " + card.textContent).includes(query);
      const show = categoryMatch && searchMatch;
      card.hidden = !show;
      if (show) visible += 1;
    });
    count.textContent = visible + " van " + cards.length + " apparaatgroepen";
    empty.hidden = visible !== 0;
  }
  filters.forEach(button => button.addEventListener("click", () => {
    activeFilter = button.dataset.filter || "all";
    filters.forEach(item => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    applyFilters();
  }));
  search.addEventListener("input", applyFilters);
  reset.addEventListener("click", () => {
    activeFilter = "all";
    search.value = "";
    filters.forEach(item => {
      const active = item.dataset.filter === "all";
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    applyFilters();
    search.focus();
  });
  applyFilters();
})();