const checklist = [...document.querySelectorAll(".check-item input[type='checkbox']")];
const doneCount = document.querySelector("#done-count");
const totalCount = document.querySelector("#total-count");
const fill = document.querySelector("#progress-fill");
function refreshProgress() {
  const done = checklist.filter(item => item.checked).length;
  if (doneCount) doneCount.textContent = String(done);
  if (totalCount) totalCount.textContent = String(checklist.length);
  if (fill) fill.style.width = checklist.length ? (done / checklist.length * 100) + "%" : "0%";
}
checklist.forEach(item => item.addEventListener("change", refreshProgress));
document.querySelector("#reset-checklist")?.addEventListener("click", () => {
  checklist.forEach(item => { item.checked = false; });
  refreshProgress();
});
document.querySelector("#print-checklist")?.addEventListener("click", () => window.print());
refreshProgress();
