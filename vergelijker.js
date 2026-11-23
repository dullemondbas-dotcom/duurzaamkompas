const batteryModels = [
  {id:"huawei-luna-s1",brand:"Huawei",model:"LUNA2000 S1",kind:"Vast systeem",type:"vast",capacity:"5–20,7 kWh",capacitySort:5,power:"3,5 / 7 / 10,5 kW afhankelijk van configuratie",chemistry:"Niet vermeld op de geraadpleegde productspecificatie",phase:"1- of 3-fase systeemspanning vermeld; configuratie controleren",warranty:"Controleer de garantievoorwaarden voor jouw markt en configuratie",note:"Modulair opgebouwd met 5 kWh- en 6,9 kWh-modules. De uiteindelijke capaciteit en het vermogen zijn afhankelijk van de combinatie van modules.",source:"https://solar.huawei.com/en/products/luna2000-7-14-21-s1/specs/",sourceLabel:"Huawei productspecificaties",checked:"23-11-2026",tags:["Modulair","Hybride systeem"]},
  {id:"tesla-powerwall-3",brand:"Tesla",model:"Powerwall 3",kind:"Vast systeem",type:"vast",capacity:"13,5 kWh bruikbaar",capacitySort:13.5,power:"AC-uitgang configureerbaar 4–11,04 kW",chemistry:"Niet opgenomen in deze vergelijking",phase:"Eenfasig volgens NL-datasheet",warranty:"10 jaar (voorwaarden van toepassing)",note:"Geïntegreerd opslagsysteem met omvormer. De exacte aansluiting, configuratie en beschikbare vermogensvariant moeten door de installateur worden vastgesteld.",source:"https://energylibrary.tesla.com/docs/Public/EnergyStorage/Powerwall/3/Datasheet/nl-nl/Powerwall-3-Datasheet-NL.pdf",sourceLabel:"Tesla Powerwall 3 NL-datasheet",checked:"23-11-2026",tags:["Geïntegreerde omvormer","Back-up opties"]},
  {id:"sigenergy-sigenstor",brand:"Sigenergy",model:"SigenStor BAT 6.0 / 10.0",kind:"Vast systeem",type:"vast",capacity:"6,0 / 9,0 kWh bruikbaar",capacitySort:6,power:"3,0 / 4,6 kW per batterijvariant",chemistry:"LiFePO₄",phase:"Afhankelijk van Energy Controller; controleer systeemconfiguratie",warranty:"Controleer de actuele garantievoorwaarden en throughput-limieten",note:"Modulaire batterijvarianten met natuurlijke convectie en IP66-classificatie volgens fabrikantgegevens. Het totale systeem bestaat uit meerdere componenten.",source:"https://www.sigenergy.com/en/products/sigenstor/spec",sourceLabel:"Sigenergy SigenStor-specificaties",checked:"23-11-2026",tags:["Modulair","Geïntegreerd energiesysteem"]}
];
const grid = document.querySelector("#product-grid");
const search = document.querySelector("#model-search");
const typeFilter = document.querySelector("#type-filter");
const sortFilter = document.querySelector("#sort-filter");
const selected = new Set();
const esc = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function renderProducts() {
  if (!grid) return;
  const q = (search?.value || "").toLowerCase().trim();
  let items = batteryModels.filter(m => (typeFilter?.value === "all" || m.type === typeFilter?.value) && (m.brand+" "+m.model+" "+m.tags.join(" ")).toLowerCase().includes(q));
  if (sortFilter?.value === "capacity") items.sort((a,b) => b.capacitySort-a.capacitySort);
  else items.sort((a,b) => a.brand.localeCompare(b.brand));
  grid.innerHTML = items.length ? items.map(m => `<article class="product-card">
    <div class="product-card-top"><span class="product-kind">${esc(m.kind)}</span><label class="compare-check"><input type="checkbox" data-select="${esc(m.id)}" ${selected.has(m.id)?"checked":""}><span>Vergelijk</span></label></div>
    <div class="product-brand">${esc(m.brand)}</div><h3>${esc(m.model)}</h3><div class="product-capacity"><b>${esc(m.capacity)}</b><small>Bruikbare capaciteit / productreeks</small></div>
    <div class="product-facts"><div><small>Laad- / ontlaadvermogen</small><b>${esc(m.power)}</b></div><div><small>Batterijtype</small><b>${esc(m.chemistry)}</b></div><div><small>Fase / systeem</small><b>${esc(m.phase)}</b></div><div><small>Garantie</small><b>${esc(m.warranty)}</b></div></div>
    <p class="product-note">${esc(m.note)}</p><div class="product-tags">${m.tags.map(t=>`<span>${esc(t)}</span>`).join("")}</div>
    <div class="product-source"><span>Gecontroleerd: ${esc(m.checked)}</span><a href="${esc(m.source)}" target="_blank" rel="noopener">${esc(m.sourceLabel)} ↗</a></div>
  </article>`).join("") : '<div class="empty-state">Geen modellen gevonden. Probeer een andere zoekterm.</div>';
  grid.querySelectorAll("[data-select]").forEach(input => input.addEventListener("change", () => {
    if (input.checked) {
      if (selected.size >= 3) { input.checked = false; alert("Selecteer maximaal drie systemen tegelijk."); return; }
      selected.add(input.dataset.select);
    } else selected.delete(input.dataset.select);
    updateSelection();
  }));
  updateSelection();
}
function updateSelection() {
  const count = document.querySelector("#selection-count");
  const button = document.querySelector("#show-comparison");
  if (count) count.textContent = selected.size+" systemen geselecteerd";
  if (button) button.disabled = selected.size < 2;
}
function showComparison() {
  const target = document.querySelector("#comparison-result");
  if (!target) return;
  const rows = [
    ["Merk / model",m=>m.brand+" "+m.model],
    ["Bruikbare capaciteit",m=>m.capacity],
    ["Laad- / ontlaadvermogen",m=>m.power],
    ["Batterijtype",m=>m.chemistry],
    ["Fase / systeem",m=>m.phase],
    ["Garantie",m=>m.warranty],
    ["Aandachtspunt",m=>m.note]
  ];
  const models = batteryModels.filter(m=>selected.has(m.id));
  target.hidden = false;
  target.innerHTML = `<div class="comparison-head"><div><span class="kicker">JOUW SELECTIE</span><h3>Systemen naast elkaar</h3></div><button class="reset-button" id="close-comparison">Sluiten ×</button></div><div class="table-scroll"><table class="compare-table"><thead><tr><th>Eigenschap</th>${models.map(m=>`<th>${esc(m.brand)}<small>${esc(m.model)}</small></th>`).join("")}</tr></thead><tbody>${rows.map(([label,fn])=>`<tr><th>${label}</th>${models.map(m=>`<td>${esc(fn(m))}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="table-footnote">Gegevens hebben betrekking op specifieke productvarianten en configuraties. Controleer de bron en laat de complete combinatie door een installateur toetsen.</p>`;
  document.querySelector("#close-comparison").addEventListener("click",()=>target.hidden=true);
  target.scrollIntoView({behavior:"smooth",block:"start"});
}
search?.addEventListener("input",renderProducts);
typeFilter?.addEventListener("change",renderProducts);
sortFilter?.addEventListener("change",renderProducts);
document.querySelector("#show-comparison")?.addEventListener("click",showComparison);
renderProducts();

const calcForm = document.querySelector("#battery-calculator");
if (calcForm) {
  const value = id => Number(document.querySelector("#"+id).value);
  const money = n => new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n);
  function calculate(event) {
    event?.preventDefault();
    const use=value("annual-use"), solar=value("solar-yield"), direct=value("direct-use")/100, capacity=value("battery-capacity"), cycles=value("cycle-count"), efficiency=value("roundtrip")/100, buy=value("buy-price"), sell=value("sell-price"), investment=value("investment");
    const surplus=Math.max(0,solar*(1-direct));
    const batteryThroughput=Math.max(0,capacity*cycles*efficiency);
    const annualShift=Math.min(surplus,batteryThroughput,use);
    const margin=buy-sell;
    const benefit=annualShift*margin;
    const years=benefit>0&&investment>0?investment/benefit:null;
    document.querySelector("#shifted-energy").innerHTML=Math.round(annualShift).toLocaleString("nl-NL")+' <span>kWh</span>';
    document.querySelector("#annual-benefit").textContent=money(benefit);
    document.querySelector("#payback").textContent=years&&Number.isFinite(years)?years.toFixed(1).replace(".",",")+" jaar":"Niet zinvol te berekenen";
    document.querySelector("#surplus").textContent=Math.round(surplus).toLocaleString("nl-NL")+" kWh";
    const message = margin<=0 ? "Je ingevulde verschil tussen inkoopprijs en terugleververgoeding is nul of negatief. Op basis van deze invoer ontstaat geen positieve bruto waarde voor verschoven zonnestroom." : "Dit is een theoretische bovengrens op basis van jouw invoer. Het model veronderstelt dat alle berekende verschoven energie nuttig in huis wordt gebruikt. In de praktijk kan de uitkomst aanzienlijk lager zijn door seizoenen, gelijktijdigheid, vermogen, verliezen en contractvoorwaarden.";
    document.querySelector("#calc-explanation").textContent=message;
  }
  calcForm.addEventListener("submit",calculate);
  calcForm.addEventListener("reset",()=>setTimeout(calculate,0));
  calculate();
}