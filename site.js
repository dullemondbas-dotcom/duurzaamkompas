const menuButton = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav");

if (nav) {
  const currentFile = location.pathname.split("/").pop() || "index.html";
  nav.querySelectorAll("a[href]").forEach(link => {
    const targetFile = link.getAttribute("href").split("#")[0] || "index.html";
    const isBatterySubpage = currentFile === "vergelijker.html" && targetFile === "slimme-apparaten.html";
    if ((targetFile === currentFile || isBatterySubpage) && !link.classList.contains("nav-cta")) {
      link.setAttribute("aria-current", "page");
    }
  });
}
if (menuButton && nav) {
  menuButton.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "Menu sluiten" : "Menu openen");
    menuButton.textContent = isOpen ? "×" : "☰";
  });
  nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
    nav.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Menu openen");
    menuButton.textContent = "☰";
  }));
}
const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();
const shareButton = document.querySelector("#share-button");
if (shareButton) shareButton.addEventListener("click", async () => {
  const shareData = { title: "DuurzaamKompas", text: "Ontdek begrijpelijke informatie over thuisbatterijen, zonnepanelen en slimme energie.", url: location.href };
  try {
    if (navigator.share) await navigator.share(shareData);
    else if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareData.url);
      shareButton.textContent = "Link gekopieerd ✓";
    } else {
      window.prompt("Kopieer de link naar DuurzaamKompas:", shareData.url);
    }
  } catch (error) {
    if (error.name !== "AbortError") shareButton.textContent = "Delen niet gelukt";
  }
});