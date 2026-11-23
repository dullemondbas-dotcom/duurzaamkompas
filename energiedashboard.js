(() => {
  const DATA_URL = "data/energy-live.json";
  const byId = id => document.getElementById(id);
  const number = (value, digits=0) => {
    const n = Number(value);
    return Number.isFinite(n) ? new Intl.NumberFormat("nl-NL",{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(n) : "—";
  };
  const time = value => {
    if (!value) return "Tijdstip niet beschikbaar";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat("nl-NL",{dateStyle:"short",timeStyle:"short",timeZone:"Europe/Amsterdam"}).format(d);
  };
  const safe = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const statusText = status => ({
    live:"Live data opgehaald",
    partial:"Gedeeltelijke data",
    model:"Modelberekening",
    setup_required:"API-sleutel nodig",
    waiting:"Wacht op eerste update",
    error:"Bron niet bereikbaar"
  }[status] || "Status onbekend");
  const statusClass = status => status === "live" ? "" : (status === "model" ? "warn" : "off");
  function setStatus(id,status){
    const el=byId(id); if(!el)return;
    el.textContent=statusText(status); el.className="live-pill "+statusClass(status);
  }
  function setSource(id,source){
    const el=byId(id); if(!el)return;
    el.textContent=statusText(source?.status)+". "+(source?.message||"");
    if(source?.updated_at) el.textContent += " Bijgewerkt: "+time(source.updated_at)+".";
  }
  function setValue(id,value,unit,digits=0){
    const el=byId(id); if(!el)return;
    el.innerHTML=safe(value===null||value===undefined?"—":number(value,digits))+' <span class="live-unit">'+safe(unit)+'</span>';
  }
  function barChart(items, targetId){
    const target=byId(targetId); if(!target)return;
    if(target.nextElementSibling?.classList.contains("live-bar-labels")) target.nextElementSibling.remove();
    if(!items?.length){target.className="live-message";target.textContent="Nog geen meetreeks beschikbaar.";return;}
    const max=Math.max(1,...items.flatMap(x=>[Number(x.solar)||0,Number(x.wind)||0]));
    target.className="live-bars";
    target.innerHTML=items.map(item=>{
      const solar=Math.max(0,Number(item.solar)||0),wind=Math.max(0,Number(item.wind)||0);
      const title=time(item.time);
      return '<div class="live-bar-group" title="'+safe(title)+'"><div class="live-bar" style="height:'+Math.max(2,solar/max*100)+'%"></div><div class="live-bar wind" style="height:'+Math.max(2,wind/max*100)+'%"></div></div>';
    }).join("");
    const labels=document.createElement("div"); labels.className="live-bar-labels";
    labels.innerHTML="<span>"+safe(time(items[0].time))+"</span><span>"+safe(time(items[items.length-1].time))+"</span>";
    target.insertAdjacentElement("afterend",labels);
  }
  function pvgisChart(months){
    const target=byId("pvgis-chart"); if(!target)return;
    if(!months?.length){target.className="live-message";target.textContent="De maandverdeling verschijnt na de eerste PVGIS-update.";return;}
    const names=["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];
    const max=Math.max(1,...months.map(x=>Number(x.yield_kwh)||0));
    target.className="live-pvgis-bars";
    target.innerHTML=months.map(item=>{
      const idx=Number(item.month)-1;
      const val=Number(item.yield_kwh)||0;
      return '<div class="live-pvgis-month" title="'+safe(names[idx]||item.month)+': '+number(val,1)+' kWh"><div class="live-pvgis-bar" style="height:'+Math.max(2,val/max*100)+'%"></div><small>'+safe(names[idx]||item.month)+'</small></div>';
    }).join("");
  }
  function renderNed(source){
    setSource("source-ned",source); 
    const data=source?.data||{};
    ["solar","wind","load"].forEach(key=>{
      const item=data[key]||{};
      const latest=item.latest||{};
      const status=item.latest?"live":source?.status;
      setStatus("ned-"+key+"-status",status);
      setValue("ned-"+key+"-value",latest.mw,"MW",0);
      byId("ned-"+key+"-caption").textContent=latest.time?"Meetinterval: "+time(latest.time)+" · volume "+(latest.volume_kwh!==null&&latest.volume_kwh!==undefined?number(latest.volume_kwh)+" kWh":"niet beschikbaar"):"Geen actuele waarde beschikbaar. "+(source?.message||"");
      byId("ned-"+key+"-time").textContent=latest.lastupdate?"Laatste bronupdate: "+time(latest.lastupdate):"Bron: Nationaal Energie Dashboard";
    });
    const solar=data.solar?.series||[],wind=data.wind?.series||[];
    const points=solar.map(s=>{
      const match=wind.find(w=>w.time===s.time);
      return {time:s.time,solar:s.mw,wind:match?.mw};
    }).filter(x=>x.solar!==null||x.wind!==null);
    barChart(points,"ned-chart");
    setStatus("ned-chart-status",points.length?"live":source?.status);
    if(!points.length){byId("ned-chart").className="live-message";byId("ned-chart").textContent="Zodra de NED API-sleutel is ingesteld, verschijnen hier de laatste 10-minutenwaarden.";}
  }
  function renderKnmi(source){
    setSource("source-knmi",source);
    const d=source?.data||{};
    const ok=d.temperature_c!==null&&d.temperature_c!==undefined||d.solar_radiation_w_m2!==null&&d.solar_radiation_w_m2!==undefined||d.wind_speed_m_s!==null&&d.wind_speed_m_s!==undefined;
    setStatus("knmi-status",ok?"live":source?.status);
    setStatus("knmi-radiation-status",d.solar_radiation_w_m2!==null&&d.solar_radiation_w_m2!==undefined?"live":source?.status);
    setStatus("knmi-wind-status",d.wind_speed_m_s!==null&&d.wind_speed_m_s!==undefined?"live":source?.status);
    setValue("knmi-temperature",d.temperature_c,"°C",1);
    setValue("knmi-radiation",d.solar_radiation_w_m2,"W/m²",0);
    setValue("knmi-wind",d.wind_speed_m_s,"m/s",1);
    byId("knmi-time").textContent=d.time?"KNMI-meetinterval: "+time(d.time):"Bron: KNMI De Bilt";
  }
  function renderTennet(source){
    setSource("source-tennet",source);
    const data=source?.data||{};
    const latest=data.latest||data.series?.[data.series.length-1]||null;
    const price=latest?.price_eur_mwh;
    setStatus("tennet-status",latest?"live":source?.status);
    setStatus("tennet-table-status",data.series?.length?"live":source?.status);
    setValue("tennet-price",price,"€/MWh",2);
    byId("tennet-price-caption").textContent=latest?.time?"Balancing interval: "+time(latest.time):"Prijsveld of gepubliceerde waarde nog niet beschikbaar.";
    byId("tennet-time").textContent=source?.updated_at?"Feed opgehaald: "+time(source.updated_at):"Bron: TenneT Settlement Prices API";
    const target=byId("tennet-table");
    const rows=data.series||[];
    if(!rows.length){target.className="live-message";target.textContent=source?.message||"Settlementgegevens verschijnen zodra de TenneT API-sleutel is ingesteld.";return;}
    const valid=rows.slice(-12).reverse();
    const showPrice=valid.some(r=>r.price_eur_mwh!==null&&r.price_eur_mwh!==undefined);
    target.className="";
    target.innerHTML=showPrice?'<table class="live-data-table"><thead><tr><th>Periode</th><th>Settlementprijs</th></tr></thead><tbody>'+valid.map(r=>'<tr><td>'+safe(time(r.time))+'</td><td>'+safe(r.price_eur_mwh===null?"—":number(r.price_eur_mwh,2)+" €/MWh")+'</td></tr>').join("")+'</tbody></table>':'<div class="live-message">De TenneT API retourneerde gegevens, maar het prijsveld kon nog niet worden herkend. Zie de bronstatus voor details.</div>';
  }
  function renderPvgis(source){
    setSource("source-pvgis",source);
    const data=source?.data||{};
    setStatus("pvgis-status",source?.status||"waiting");
    setStatus("pvgis-chart-status",(data.monthly||[]).length?"model":source?.status||"waiting");
    setValue("pvgis-annual",data.annual_yield_kwh,"kWh/jaar",0);
    byId("pvgis-caption").textContent=data.location?.name?"Referentielocatie: "+data.location.name+". Langjarige modeluitkomst, geen live paneelmeting.":"Model voor een PV-systeem van 1 kWp.";
    byId("pvgis-time").textContent=source?.updated_at?"Model voor het laatst opgehaald: "+time(source.updated_at)+" · PVGIS © European Commission JRC":"Bron: PVGIS v5.3 · European Commission Joint Research Centre";
    pvgisChart(data.monthly);
  }
  async function loadDashboard(){
    const button=byId("refresh-dashboard");
    if(button){button.disabled=true;button.textContent="↻ Gegevens ophalen…";}
    try{
      const response=await fetch(DATA_URL+"?v="+Date.now(),{cache:"no-store"});
      if(!response.ok) throw new Error("HTTP "+response.status);
      const snapshot=await response.json();
      const sources=snapshot.sources||{};
      renderNed(sources.ned);renderKnmi(sources.knmi);renderTennet(sources.tennet);renderPvgis(sources.pvgis);
      const states=Object.values(sources).map(s=>s?.status);
      const working=states.filter(s=>s==="live"||s==="model").length;
      byId("overall-status").textContent=working>0?working+" van 4 databronnen beschikbaar":"Live gegevens nog niet geconfigureerd";
      byId("snapshot-time").textContent="Snapshot gemaakt: "+time(snapshot.generated_at)+" · geplande update: iedere "+(snapshot.refresh_interval_minutes||15)+" min";
    }catch(error){
      byId("overall-status").textContent="Gegevensfeed niet bereikbaar";
      byId("snapshot-time").textContent="Controleer de eerste GitHub Actions-update. "+String(error.message||error);
      ["ned","knmi","tennet","pvgis"].forEach(name=>{const el=byId("source-"+name);if(el)el.textContent="Geen openbare snapshot geladen.";});
    }finally{
      if(button){button.disabled=false;button.textContent="↻ Ververs dashboard";}
    }
  }
  byId("refresh-dashboard")?.addEventListener("click",loadDashboard);
  loadDashboard();
  window.setInterval(loadDashboard,180000);
})();