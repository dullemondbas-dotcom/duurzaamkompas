import { createClient } from "npm:@supabase/supabase-js@2.119.2";

const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
function sha256Hex(value: string): Promise<string> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
    .then((digest) => Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""));
}
function isNumericOrNull(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value !== "number" && typeof value !== "string") return false;
  if (typeof value === "string" && value.trim() === "") return true;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const secretDictionary = (() => {
  try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); }
  catch { return {}; }
})();
const supabaseSecret = secretDictionary.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const admin = supabaseUrl && supabaseSecret
  ? createClient(supabaseUrl, supabaseSecret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  : null;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return respond(405, { ok: false, error: "method_not_allowed" });
  if (!admin) return respond(503, { ok: false, error: "ingestion_not_configured" });
  const rawKey = req.headers.get("x-dk-integration-key") || "";
  if (!/^[a-f0-9]{64}$/i.test(rawKey)) return respond(401, { ok: false, error: "invalid_integration_key" });
  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > 8192) return respond(413, { ok: false, error: "payload_too_large" });

  let payload: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 8192) return respond(413, { ok: false, error: "payload_too_large" });
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return respond(400, { ok: false, error: "invalid_payload" });
    payload = parsed as Record<string, unknown>;
  } catch { return respond(400, { ok: false, error: "invalid_json" }); }

  const allowedKeys = new Set(["source_event_id","measured_at","grid_import_w","grid_export_w","grid_import_total_kwh","grid_export_total_kwh","gas_total_m3"]);
  if (Object.keys(payload).some((key) => !allowedKeys.has(key))) return respond(400, { ok: false, error: "unknown_payload_field" });
  if (typeof payload.source_event_id !== "string" || payload.source_event_id.trim().length < 1 || payload.source_event_id.trim().length > 128) {
    return respond(400, { ok: false, error: "source_event_id_required" });
  }
  if (typeof payload.measured_at !== "string" || !Number.isFinite(Date.parse(payload.measured_at))) {
    return respond(400, { ok: false, error: "valid_measured_at_required" });
  }
  const numericKeys = ["grid_import_w","grid_export_w","grid_import_total_kwh","grid_export_total_kwh","gas_total_m3"];
  if (numericKeys.some((key) => !isNumericOrNull(payload[key]))) return respond(400, { ok: false, error: "invalid_measurement_value" });
  if (numericKeys.every((key) => payload[key] === undefined || payload[key] === null || payload[key] === "")) {
    return respond(400, { ok: false, error: "at_least_one_measurement_required" });
  }

  try {
    const tokenHash = await sha256Hex(rawKey.toLowerCase());
    const { data, error } = await admin.rpc("ingest_energy_measurement", { p_token_hash: tokenHash, p_payload: payload });
    if (error) {
      const status = /credential/i.test(error.message) ? 401 : 422;
      return respond(status, { ok: false, error: status === 401 ? "invalid_integration_key" : "measurement_rejected" });
    }
    return respond(200, { ok: true, result: data });
  } catch { return respond(500, { ok: false, error: "ingestion_failed" }); }
});
