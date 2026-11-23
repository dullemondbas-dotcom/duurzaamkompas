const checklist = [...document.querySelectorAll(".check-item input[type='checkbox']")];
const doneCount = document.querySelector("#done-count");
const totalCount = document.querySelector("#total-count");
const fill = document.querySelector("#progress-fill");
const storageKey = "duurzaamkompas-checklist-v1";

function saveChecklist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(checklist.map(item => item.checked)));
  } catch (error) {
    // The checklist still works for this page view when storage is unavailable.
  }
}

function refreshProgress() {
  const done = checklist.filter(item => item.checked).length;
  if (doneCount) doneCount.textContent = String(done);
  if (totalCount) totalCount.textContent = String(checklist.length);
  if (fill) fill.style.width = checklist.length ? (done / checklist.length * 100) + "%" : "0%";
}

try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
  if (Array.isArray(saved)) {
    checklist.forEach((item, index) => { item.checked = saved[index] === true; });
  }
} catch (error) {
  // Ignore blocked, unavailable or malformed local browser storage.
}

checklist.forEach(item => item.addEventListener("change", () => {
  saveChecklist();
  refreshProgress();
}));

document.querySelector("#reset-checklist")?.addEventListener("click", () => {
  checklist.forEach(item => { item.checked = false; });
  try { localStorage.removeItem(storageKey); } catch (error) {}
  refreshProgress();
});

document.querySelector("#print-checklist")?.addEventListener("click", () => window.print());
refreshProgress();
