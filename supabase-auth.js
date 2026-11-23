/* DuurzaamKompas account layer — Supabase Auth + private household profile sync.
   Safe for GitHub Pages: only the public Supabase publishable key belongs in supabase-config.js.
   No service-role keys or device tokens are used by this browser code. */
(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const config = window.DK_SUPABASE_CONFIG || {};
  const dialog = $("#accountDialog");
  const authArea = $("#accountAuthArea");
  const signedInArea = $("#accountSignedInArea");
  const statusEl = $("#accountStatus");
  const configNote = $("#accountConfigNote");
  const authForms = {
    login: $("#accountLoginForm"),
    register: $("#accountRegisterForm"),
    reset: $("#accountResetForm"),
    updatePassword: $("#accountUpdatePasswordForm")
  };
  let client = null;
  let currentUser = null;
  let householdId = null;
  let latestProfile = null;
  let sessionChangeSequence = 0;
  let passwordRecoveryActive = false;

  const isConfigured = Boolean(
    typeof window.supabase?.createClient === "function" &&
    /^https:\/\//.test(config.projectUrl || "") &&
    (config.publishableKey || "").length > 20
  );

  function setStatus(message, type = "info") {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.dataset.type = type;
    statusEl.hidden = !message;
  }

  function switchAuthView(view) {
    Object.entries(authForms).forEach(([key, form]) => {
      if (form) form.hidden = key !== view;
    });
    document.querySelectorAll("[data-auth-view]").forEach(button => {
      button.classList.toggle("active", button.dataset.authView === view);
    });
    const titles = {
      login: "Welkom terug",
      register: "Maak je account",
      reset: "Wachtwoord herstellen",
      updatePassword: "Nieuw wachtwoord"
    };
    $("#accountTitle").textContent = titles[view] || "Mijn account";
    setStatus("");
  }

  function openDialog(view = "login") {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    if (currentUser) {
      authArea.hidden = true;
      signedInArea.hidden = false;
      $("#accountTitle").textContent = "Mijn account";
    } else {
      authArea.hidden = false;
      signedInArea.hidden = true;
      switchAuthView(view);
    }
    if (!isConfigured) {
      configNote.hidden = false;
      setStatus("De accountfuncties zijn gebouwd, maar nog niet geactiveerd. Het Supabase-project moet eerst worden gekoppeld.", "warning");
    } else {
      configNote.hidden = true;
    }
  }

  function closeDialog() {
    if (dialog?.open) dialog.close();
    else dialog?.removeAttribute("open");
  }

  function navigateToHousehold() {
    const navigate = () => {
      const target = document.getElementById("view-household");
      if (!target) {
        console.error("Mijn Energie: huishoudprofielpagina ontbreekt in de HTML.");
        return;
      }

      // Change the visible page directly. This does not depend on the app's
      // tab click listeners, script order, or an already-fired load event.
      document.querySelectorAll(".view").forEach(section => {
        section.classList.toggle("active", section === target);
      });
      document.querySelectorAll(".nav-tab").forEach(button => {
        button.classList.toggle("active", button.dataset.view === "household");
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Only wait while the browser is still parsing the HTML. "interactive"
    // may already mean DOMContentLoaded has fired, so never wait on it.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", navigate, { once: true });
    } else {
      navigate();
    }
  }

  async function loadHouseholdProfile(user) {
    if (!client || !user) return null;
    const { data: profileRow, error: profileError } = await client
      .from("profiles").select("nickname").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;

    const { data: memberships, error: membershipError } = await client
      .from("household_members").select("household_id,role")
      .eq("user_id", user.id).order("joined_at", { ascending: true }).limit(1);
    if (membershipError) throw membershipError;
    householdId = memberships?.[0]?.household_id || null;

    let homeRow = null;
    let householdRow = null;
    if (householdId) {
      const [homeResult, householdResult] = await Promise.all([
        client.from("home_profiles").select("*").eq("household_id", householdId).maybeSingle(),
        client.from("households").select("municipality").eq("id", householdId).maybeSingle()
      ]);
      if (homeResult.error) throw homeResult.error;
      if (householdResult.error) throw householdResult.error;
      homeRow = homeResult.data;
      householdRow = householdResult.data;
    }

    const mapped = homeRow ? {
      homeType: homeRow.home_type || "",
      residents: homeRow.residents_band || "",
      area: homeRow.floor_area_m2 ?? "",
      buildPeriod: homeRow.build_period || "",
      insulation: homeRow.insulation_level || "",
      heating: homeRow.heating_type || "",
      solar: Boolean(homeRow.solar_installed),
      battery: Boolean(homeRow.battery_installed),
      ev: Boolean(homeRow.ev_installed),
      chargePoint: Boolean(homeRow.charge_point_installed),
      heatPump: Boolean(homeRow.heat_pump_installed),
      smartControl: Boolean(homeRow.smart_control_installed),
      solarKwp: homeRow.solar_capacity_kwp ?? "",
      batteryKwh: homeRow.battery_capacity_kwh ?? "",
      municipality: householdRow?.municipality || "",
      contract: homeRow.energy_contract_type || "",
      nickname: profileRow?.nickname || user.user_metadata?.nickname || "",
      comparison: homeRow.comparison_group || "automatic",
      profileConsent: true
    } : (profileRow?.nickname ? {
      nickname: profileRow.nickname,
      profileConsent: true,
      comparison: "automatic"
    } : null);
    latestProfile = mapped;
    return mapped;
  }

  async function publishAccountState(user, profile, sequence) {
    if (sequence !== sessionChangeSequence) return;
    currentUser = user || null;
    if (!currentUser) {
      householdId = null;
      latestProfile = null;
      authArea.hidden = false;
      signedInArea.hidden = true;
      $("#accountButtonLabel").textContent = "Mijn account";
      $("#headerNickname").textContent = "Demo gebruiker";
      $("#avatarInitial").textContent = "D";
      $("#accountOpenButton")?.setAttribute("aria-label", "Inloggen of account aanmaken");
      authArea.hidden = false;
      signedInArea.hidden = true;
      window.dispatchEvent(new CustomEvent("dk-account-changed", { detail: { user: null, profile: null } }));
      return;
    }

    const nickname = profile?.nickname || currentUser.user_metadata?.nickname || currentUser.email?.split("@")[0] || "Gebruiker";
    $("#headerNickname").textContent = nickname;
    $("#avatarInitial").textContent = nickname.slice(0, 1).toUpperCase();
    $("#accountButtonLabel").textContent = "Account";
    $("#accountOpenButton")?.setAttribute("aria-label", "Account van " + nickname);
    $("#accountEmail").textContent = currentUser.email || "";
    $("#accountNickname").textContent = "Nickname: " + nickname;
    if (passwordRecoveryActive) {
      authArea.hidden = false;
      signedInArea.hidden = true;
      $("#accountTitle").textContent = "Nieuw wachtwoord";
      switchAuthView("updatePassword");
      return;
    }
    authArea.hidden = true;
    signedInArea.hidden = false;
    $("#accountTitle").textContent = "Mijn account";
    $("#accountSyncStatus").textContent = profile
      ? "Je huishoudenprofiel is beschikbaar voor synchronisatie."
      : "Je account staat klaar. Vul je huishouden in om je profiel te bewaren.";
    window.dispatchEvent(new CustomEvent("dk-account-changed", { detail: { user: currentUser, profile } }));
    // New accounts without a household are guided directly to the first setup step.
    if (profile && !householdId) navigateToHousehold();
  }

  async function refreshSession(session) {
    const seq = ++sessionChangeSequence;
    if (!session?.user) {
      await publishAccountState(null, null, seq);
      return;
    }
    currentUser = session.user;
    try {
      const profile = await loadHouseholdProfile(session.user);
      await publishAccountState(session.user, profile, seq);
    } catch (error) {
      console.error("DuurzaamKompas account sync:", error);
      await publishAccountState(session.user, null, seq);
      $("#accountSyncStatus").textContent = "Ingelogd. Je huishoudenprofiel kon nog niet worden opgehaald.";
    }
  }

  function getAccountError(error) {
    const message = error?.message || "Er ging iets mis. Probeer het opnieuw.";
    if (/Invalid login credentials/i.test(message)) return "Het e-mailadres of wachtwoord klopt niet.";
    if (/Password should be at least/i.test(message)) return "Kies een langer wachtwoord.";
    if (/User already registered/i.test(message)) return "Er bestaat mogelijk al een account met dit e-mailadres. Probeer in te loggen.";
    if (/unique constraint|profiles_nickname_lower_unique|profiles_nickname_key/i.test(message)) return "Deze nickname is al in gebruik. Kies een andere.";
    return message;
  }

  function requireClient() {
    if (!isConfigured || !client) {
      setStatus("Accountregistratie en inloggen zijn nog niet actief. Vul eerst de Supabase-project-URL en publishable key in supabase-config.js en voer de SQL-migratie uit.", "warning");
      return false;
    }
    return true;
  }

  async function ensureHousehold(user, municipality) {
    if (!user || !currentUser || user.id !== currentUser.id) {
      throw new Error("Je inlogsessie is veranderd. Log opnieuw in en probeer het nog eens.");
    }

    if (householdId) {
      if (municipality !== undefined) {
        const { error } = await client.from("households")
          .update({ municipality: municipality || null })
          .eq("id", householdId);
        if (error) throw error;
      }
      return householdId;
    }

    // The RPC derives owner_user_id from auth.uid() on the server. This avoids
    // relying on a browser-supplied owner id and keeps the RLS boundary intact.
    const { data: newHouseholdId, error } = await client.rpc("create_my_household", {
      p_municipality: municipality || null
    });
    if (error) throw error;
    if (!newHouseholdId) {
      throw new Error("Supabase heeft geen huishouden-ID teruggegeven. Probeer het opnieuw.");
    }
    householdId = newHouseholdId;
    return householdId;
  }

  async function saveHousehold(data) {
    if (!currentUser || !client) throw new Error("Log eerst in om je huishouden online op te slaan.");
    const nickname = String(data.nickname || "").trim();
    if (!/^[A-Za-z0-9_-]{3,24}$/.test(nickname)) {
      throw new Error("Gebruik voor je nickname 3–24 letters, cijfers, _ of -.");
    }

    const { error: nicknameError } = await client
      .from("profiles").update({ nickname, updated_at: new Date().toISOString() }).eq("id", currentUser.id);
    if (nicknameError) throw nicknameError;
    const { error: metadataError } = await client.auth.updateUser({ data: { nickname } });
    if (metadataError) throw metadataError;

    const id = await ensureHousehold(currentUser, data.municipality);
    const homeProfile = {
      household_id: id,
      home_type: data.homeType || null,
      residents_band: data.residents || null,
      floor_area_m2: data.area ? Number(data.area) : null,
      build_period: data.buildPeriod || null,
      insulation_level: data.insulation || null,
      heating_type: data.heating || null,
      solar_installed: Boolean(data.solar),
      solar_capacity_kwp: data.solarKwp ? Number(data.solarKwp) : null,
      battery_installed: Boolean(data.battery),
      battery_capacity_kwh: data.batteryKwh ? Number(data.batteryKwh) : null,
      ev_installed: Boolean(data.ev),
      charge_point_installed: Boolean(data.chargePoint),
      heat_pump_installed: Boolean(data.heatPump),
      smart_control_installed: Boolean(data.smartControl),
      energy_contract_type: data.contract || null,
      comparison_group: data.comparison || "automatic",
      updated_at: new Date().toISOString()
    };
    const { error: homeError } = await client.from("home_profiles")
      .upsert(homeProfile, { onConflict: "household_id" });
    if (homeError) throw homeError;

    const { error: consentError } = await client.from("consent_records").insert({
      user_id: currentUser.id,
      household_id: id,
      purpose: "household_profile",
      policy_version: "mijn-energie-2026-11-v1",
      context: { source: "mijn-energie-app" }
    });
    if (consentError) throw consentError;

    const refreshed = await loadHouseholdProfile(currentUser);
    await publishAccountState(currentUser, refreshed, sessionChangeSequence);
    return refreshed;
  }

  async function listEnergyIntegrations() {
    if (!client || !currentUser || !householdId) return [];
    const { data, error } = await client.from("integrations")
      .select("id,provider,status,display_label,connected_at,last_seen_at,created_at")
      .eq("household_id", householdId).order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function createEnergyIntegration(provider, displayLabel, tokenHash) {
    if (!client || !currentUser || !householdId) throw new Error("Log in en sla eerst je huishoudenprofiel op voordat je een koppeling maakt.");
    if (!["home_assistant", "homewizard"].includes(provider)) throw new Error("Deze koppelroute is nog niet beschikbaar.");
    if (!/^[a-f0-9]{64}$/.test(tokenHash || "")) throw new Error("De koppelcode kon niet veilig worden verwerkt.");
    const { data, error } = await client.rpc("create_my_energy_integration", {
      p_provider: provider, p_display_label: displayLabel, p_token_hash: tokenHash
    });
    if (error) throw error;
    return data;
  }

  async function revokeEnergyIntegration(integrationId) {
    if (!client || !currentUser || !householdId) throw new Error("Log opnieuw in om deze koppeling te beheren.");
    const { data, error } = await client.rpc("revoke_my_energy_integration", { p_integration_id: integrationId });
    if (error) throw error;
    if (!data) throw new Error("De koppeling kon niet worden gevonden.");
    return true;
  }

  async function listEnergySavingsPeriods(periodType = "month") {
    if (!client || !currentUser || !householdId) return [];
    let query = client.from("energy_savings_periods")
      .select("id,period_type,period_start,period_end,grid_import_difference_kwh,gas_difference_m3,estimated_variable_cost_difference_eur,cost_method,coverage_ratio,quality_score,quality_label,model_version,computed_at")
      .eq("household_id", householdId)
      .order("period_start", { ascending: false })
      .limit(24);
    if (["week", "month", "year"].includes(periodType)) query = query.eq("period_type", periodType);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function listEnergyTipEvents(limit = 20) {
    if (!client || !currentUser || !householdId) return [];
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
    const { data, error } = await client.from("energy_tip_events")
      .select("id,tip_id,event_type,note,created_at")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false })
      .limit(safeLimit);
    if (error) throw error;
    const events = data || [];
    if (!events.length) return [];
    const tipIds = [...new Set(events.map(event => event.tip_id))];
    const { data: tips, error: tipsError } = await client.from("household_weekly_tips")
      .select("id,title")
      .eq("household_id", householdId)
      .in("id", tipIds);
    if (tipsError) throw tipsError;
    const titleById = new Map((tips || []).map(tip => [tip.id, tip.title]));
    return events.map(event => ({ ...event, tip_title: titleById.get(event.tip_id) || null }));
  }

  async function getLatestWeeklyTip() {
    if (!client || !currentUser || !householdId) return null;
    const { data, error } = await client.from("household_weekly_tips")
      .select("id,week_start,title,summary,why_this_tip,action_text,expected_effect,cost_band,effort_band,source_name,source_url,status")
      .eq("household_id", householdId)
      .order("week_start", { ascending: false })
      .limit(1);
    if (error) throw error;
    return data?.[0] || null;
  }

  async function updateWeeklyTipStatus(tipId, status, note = null) {
    if (!client || !currentUser || !householdId) throw new Error("Log in om je tip op te slaan.");
    const { data, error } = await client.rpc("set_my_weekly_tip_status", {
      p_tip_id: tipId,
      p_status: status,
      p_note: note
    });
    if (error) throw error;
    if (!data) throw new Error("De tip kon niet worden bijgewerkt.");
    return true;
  }

  async function listEnergyDailyAggregates(days = 45) {
    if (!client || !currentUser || !householdId) return [];
    const start = new Date();
    start.setDate(start.getDate() - Math.max(1, Math.min(120, Number(days) || 45)));
    start.setHours(0, 0, 0, 0);
    const { data, error } = await client.from("energy_aggregates")
      .select("bucket_start,grid_import_kwh,grid_export_kwh,gas_m3,peak_import_kw,coverage_ratio,grid_coverage_ratio,gas_coverage_ratio,quality")
      .eq("household_id", householdId)
      .eq("resolution", "day")
      .gte("bucket_start", start.toISOString())
      .order("bucket_start", { ascending: true })
      .limit(150);
    if (error) throw error;
    return data || [];
  }


  async function listRecentEnergyMeasurements(minutes = 120) {
    if (!client || !currentUser || !householdId) return [];
    const safeMinutes = Math.max(5, Math.min(360, Number(minutes) || 120));
    const since = new Date(Date.now() - safeMinutes * 60 * 1000).toISOString();
    const { data, error } = await client.from("energy_measurements")
      .select("measured_at,grid_import_w,grid_export_w")
      .eq("household_id", householdId)
      .gte("measured_at", since)
      .order("measured_at", { ascending: false })
      .limit(240);
    if (error) throw error;
    return data || [];
  }

  function subscribeEnergyMeasurements(callback) {
    if (!client || !currentUser || !householdId || typeof callback !== "function") return () => {};
    const channel = client.channel("dk-energy-measurements-" + householdId)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "energy_measurements",
        filter: "household_id=eq." + householdId
      }, payload => callback({ type: "measurement", record: payload.new }))
      .subscribe(status => callback({ type: "status", status }));
    return () => { void client.removeChannel(channel); };
  }

  async function getHouseholdEnergyTariff() {
    if (!client || !currentUser || !householdId) return null;
    const { data, error } = await client.from("household_energy_tariffs")
      .select("electricity_import_eur_per_kwh,electricity_export_eur_per_kwh,gas_eur_per_m3,contract_label,tariff_type,valid_from,updated_at")
      .eq("household_id", householdId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function saveHouseholdEnergyTariff(payload) {
    if (!client || !currentUser || !householdId) throw new Error("Log in en sla eerst je huishoudenprofiel op.");
    const clean = {
      household_id: householdId,
      electricity_import_eur_per_kwh: payload.electricity_import_eur_per_kwh,
      electricity_export_eur_per_kwh: payload.electricity_export_eur_per_kwh,
      gas_eur_per_m3: payload.gas_eur_per_m3,
      contract_label: payload.contract_label || null,
      tariff_type: payload.tariff_type || "unknown",
      valid_from: payload.valid_from || null,
      updated_at: new Date().toISOString()
    };
    const { error } = await client.from("household_energy_tariffs")
      .upsert(clean, { onConflict: "household_id" });
    if (error) throw error;
    return true;
  }

  async function listEnergyScenarioSnapshots(limit = 12) {
    if (!client || !currentUser || !householdId) return [];
    const safeLimit = Math.max(1, Math.min(30, Number(limit) || 12));
    const { data, error } = await client.from("energy_scenario_snapshots")
      .select("id,label,annual_saving_eur,created_at,input_data,result_data")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false })
      .limit(safeLimit);
    if (error) throw error;
    return data || [];
  }

  async function saveEnergyScenarioSnapshot(payload) {
    if (!client || !currentUser || !householdId) throw new Error("Log in en sla eerst je huishoudenprofiel op.");
    const { error } = await client.from("energy_scenario_snapshots").insert({
      household_id: householdId,
      created_by: currentUser.id,
      label: String(payload.label || "Mijn scenario").slice(0, 80),
      input_data: payload.input_data || {},
      result_data: payload.result_data || {},
      annual_saving_eur: Number.isFinite(Number(payload.annual_saving_eur))
        ? Number(Number(payload.annual_saving_eur).toFixed(2)) : null
    });
    if (error) throw error;
    return true;
  }

  async function isPlatformAdmin() {
    if (!client || !currentUser) return false;
    const { data, error } = await client.rpc("is_my_platform_admin");
    if (error) throw error;
    return Boolean(data);
  }

  async function listAdminEnergyTips() {
    if (!client || !currentUser) throw new Error("Log in om de beheeromgeving te openen.");
    const { data, error } = await client.rpc("admin_list_energy_tips");
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function saveAdminEnergyTip(payload) {
    if (!client || !currentUser) throw new Error("Log in om tips te beheren.");
    const { data, error } = await client.rpc("admin_save_energy_tip", { p_payload: payload });
    if (error) throw error;
    return data;
  }

  async function listAdminEnergyFactors() {
    if (!client || !currentUser) throw new Error("Log in om rekenfactoren te beheren.");
    const { data, error } = await client.rpc("admin_list_energy_factors");
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function saveAdminEnergyFactor(payload) {
    if (!client || !currentUser) throw new Error("Log in om rekenfactoren te beheren.");
    const { data, error } = await client.rpc("admin_save_energy_factor", { p_payload: payload });
    if (error) throw error;
    return data;
  }

  async function runAdminEnergyAnalytics() {
    if (!client || !currentUser) throw new Error("Log in om de rekenengine uit te voeren.");
    const { data, error } = await client.rpc("admin_run_energy_analytics");
    if (error) throw error;
    return data;
  }

  window.DK_ACCOUNT = Object.freeze({
    isConfigured: () => isConfigured && Boolean(client),
    isSignedIn: () => Boolean(currentUser),
    getUser: () => currentUser,
    getProfile: () => latestProfile,
    saveHousehold,
    listEnergyIntegrations,
    createEnergyIntegration,
    revokeEnergyIntegration,
    listEnergySavingsPeriods,
    getLatestWeeklyTip,
    listEnergyTipEvents,
    updateWeeklyTipStatus,
    listEnergyDailyAggregates,
    listRecentEnergyMeasurements,
    subscribeEnergyMeasurements,
    getHouseholdEnergyTariff,
    saveHouseholdEnergyTariff,
    listEnergyScenarioSnapshots,
    saveEnergyScenarioSnapshot,
    isPlatformAdmin,
    listAdminEnergyTips,
    saveAdminEnergyTip,
    listAdminEnergyFactors,
    saveAdminEnergyFactor,
    runAdminEnergyAnalytics,
    signOut: async () => {
      if (!client) return;
      const { error } = await client.auth.signOut();
      if (error) throw error;
    }
  });

  $("#accountOpenButton")?.addEventListener("click", () => openDialog());
  $("#accountCloseButton")?.addEventListener("click", closeDialog);
  dialog?.addEventListener("click", event => {
    if (event.target === dialog) closeDialog();
  });
  document.querySelectorAll("[data-auth-view]").forEach(button => {
    button.addEventListener("click", () => switchAuthView(button.dataset.authView));
  });
  $("#accountHouseholdButton")?.addEventListener("click", () => {
    closeDialog();
    navigateToHousehold();
  });
  $("#accountSignOutButton")?.addEventListener("click", async () => {
    if (!requireClient()) return;
    const { error } = await client.auth.signOut();
    if (error) setStatus(getAccountError(error), "error");
    else {
      closeDialog();
      setStatus("Je bent uitgelogd.");
    }
  });

  $("#accountLoginForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!requireClient()) return;
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    setStatus("Je wordt ingelogd…");
    try {
      const { error } = await client.auth.signInWithPassword({
        email: form.elements.email.value.trim(),
        password: form.elements.password.value
      });
      if (error) throw error;
      form.reset();
      setStatus("Je bent ingelogd.", "success");
      closeDialog();
      navigateToHousehold();
    } catch (error) {
      setStatus(getAccountError(error), "error");
    } finally { button.disabled = false; }
  });

  $("#accountRegisterForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!requireClient()) return;
    const form = event.currentTarget;
    const nickname = form.elements.nickname.value.trim();
    if (!/^[A-Za-z0-9_-]{3,24}$/.test(nickname)) {
      setStatus("Gebruik voor je nickname 3–24 letters, cijfers, _ of -.", "error");
      return;
    }
    if (form.elements.password.value.length < 8) {
      setStatus("Je wachtwoord moet minimaal 8 tekens bevatten.", "error");
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    setStatus("Je account wordt aangemaakt…");
    try {
      const { data, error } = await client.auth.signUp({
        email: form.elements.email.value.trim(),
        password: form.elements.password.value,
        options: {
          data: { nickname },
          emailRedirectTo: window.location.origin + window.location.pathname
        }
      });
      if (error) throw error;
      form.reset();
      if (data.session) {
        setStatus("Je account is aangemaakt en je bent ingelogd.", "success");
        closeDialog();
        navigateToHousehold();
      } else {
        switchAuthView("login");
        setStatus("Bijna klaar. Controleer je e-mail en bevestig je adres om in te loggen.", "success");
      }
    } catch (error) {
      setStatus(getAccountError(error), "error");
    } finally { button.disabled = false; }
  });

  $("#accountResetForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!requireClient()) return;
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    setStatus("Herstellink wordt aangevraagd…");
    try {
      const { error } = await client.auth.resetPasswordForEmail(form.elements.email.value.trim(), {
        redirectTo: window.location.origin + window.location.pathname + "?reset=1"
      });
      if (error) throw error;
      setStatus("Als dit e-mailadres bij een account hoort, ontvang je een herstellink. Controleer ook je spamfolder.", "success");
    } catch (error) {
      setStatus(getAccountError(error), "error");
    } finally { button.disabled = false; }
  });

  $("#accountUpdatePasswordForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!requireClient()) return;
    const form = event.currentTarget;
    const password = form.elements.password.value;
    if (password.length < 8 || password !== form.elements.confirmPassword.value) {
      setStatus("Controleer of beide wachtwoorden gelijk zijn en minimaal 8 tekens bevatten.", "error");
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      form.reset();
      passwordRecoveryActive = false;
      setStatus("Je wachtwoord is bijgewerkt. Je kunt nu veilig verder.", "success");
      setTimeout(closeDialog, 900);
    } catch (error) {
      setStatus(getAccountError(error), "error");
    } finally { button.disabled = false; }
  });

  if (isConfigured) {
    client = window.supabase.createClient(config.projectUrl, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" }
    });
    client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        passwordRecoveryActive = true;
        openDialog("updatePassword");
        switchAuthView("updatePassword");
      }
      queueMicrotask(() => { void refreshSession(session); });
    });
    client.auth.getSession().then(({ data, error }) => {
      if (error) console.warn("Supabase sessie kon niet worden opgehaald:", error.message);
      return refreshSession(data?.session || null);
    });
  } else {
    const configMessage = "Nog niet verbonden: maak het Supabase-project aan, voer de SQL-migratie uit en vul supabase-config.js in. Daarna werken registratie, inloggen en synchronisatie.";
    if (configNote) configNote.textContent = configMessage;
    $("#accountButtonLabel").textContent = "Account instellen";
  }

  if (new URLSearchParams(location.search).get("reset") === "1") {
    openDialog("updatePassword");
    switchAuthView("updatePassword");
  }
})();
