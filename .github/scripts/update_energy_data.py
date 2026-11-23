#!/usr/bin/env python3
"""Refresh the public DuurzaamKompas energy data snapshot.

Secrets required in GitHub Actions:
  NED_API_KEY, KNMI_API_KEY, TENNET_API_KEY
PVGIS is public and does not require a key.

This runs server-side in GitHub Actions. API credentials are never sent to the browser.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "energy-live.json"
UTC = timezone.utc


def now_utc() -> datetime:
    return datetime.now(UTC)


def iso(dt: datetime | None = None) -> str:
    return (dt or now_utc()).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def get_json(url: str, headers: dict | None = None, timeout: int = 30):
    req = Request(url, headers=headers or {"User-Agent": "DuurzaamKompas-LiveDashboard/1.0"})
    with urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def api_get(url: str, headers: dict, timeout: int = 30):
    return get_json(url, headers=headers, timeout=timeout)


def parse_float(value):
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def find_latest_coverage_value(payload, parameter):
    ranges = payload.get("ranges", {}) if isinstance(payload, dict) else {}
    item = ranges.get(parameter) or ranges.get(parameter.upper()) or ranges.get(parameter.lower())
    if not isinstance(item, dict):
        return None
    values = item.get("values") or []
    if not isinstance(values, list):
        return parse_float(values)
    for value in reversed(values):
        parsed = parse_float(value)
        if parsed is not None:
            return parsed
    return None


def find_last_coverage_time(payload):
    try:
        axes = payload.get("domain", {}).get("axes", {})
        t_axis = axes.get("t", {})
        values = t_axis.get("values") or []
        if values:
            return values[-1]
    except Exception:
        pass
    return None


def refresh_knmi(previous):
    token = os.getenv("KNMI_API_KEY", "").strip()
    if not token:
        return {
            "status": "setup_required",
            "message": "Voeg KNMI_API_KEY toe bij GitHub → Settings → Secrets and variables → Actions. Een anonieme sleutel kan ook worden aangevraagd.",
            "updated_at": previous.get("updated_at"),
            "data": previous.get("data"),
        }

    # De Bilt (WMO station 06260), 10-minute near-real-time observations.
    collection = "10-minute-in-situ-meteorological-observations"
    station_id = "0-20000-0-06260"
    end = now_utc()
    start = end - timedelta(hours=4)
    params = urlencode({
        "datetime": start.strftime("%Y-%m-%dT%H:%M:%SZ") + "/" + end.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "parameter-name": "ta,qg,ff",
    })
    url = f"https://api.dataplatform.knmi.nl/edr/v1/collections/{collection}/locations/{station_id}?{params}"
    try:
        payload = api_get(url, {"Authorization": token, "Accept": "application/prs.coverage+json, application/json"})
        data = {
            "station": "De Bilt",
            "station_id": station_id,
            "time": find_last_coverage_time(payload),
            "temperature_c": find_latest_coverage_value(payload, "ta"),
            "solar_radiation_w_m2": find_latest_coverage_value(payload, "qg"),
            "wind_speed_m_s": find_latest_coverage_value(payload, "ff"),
        }
        available = any(data[k] is not None for k in ("temperature_c", "solar_radiation_w_m2", "wind_speed_m_s"))
        return {
            "status": "live" if available else "partial",
            "message": "KNMI 10-minute near-real-time observations from station De Bilt. Unvalidated observations may be incomplete.",
            "updated_at": iso(),
            "data": data,
        }
    except Exception as exc:
        return {
            "status": "error",
            "message": "KNMI API: " + str(exc)[:400],
            "updated_at": previous.get("updated_at"),
            "data": previous.get("data"),
        }


def refresh_pvgis(previous):
    previous_updated = previous.get("updated_at")
    if previous_updated:
        try:
            last = datetime.fromisoformat(previous_updated.replace("Z", "+00:00"))
            if now_utc() - last < timedelta(days=30) and previous.get("data", {}).get("annual_yield_kwh") is not None:
                return previous
        except Exception:
            pass

    params = urlencode({
        "lat": 52.1, "lon": 5.3, "peakpower": 1, "loss": 14,
        "angle": 35, "aspect": 0, "outputformat": "json",
    })
    url = "https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?" + params
    try:
        payload = get_json(url)
        outputs = payload.get("outputs", {})
        totals = outputs.get("totals", {}).get("fixed", {})
        monthly = outputs.get("monthly", {}).get("fixed", [])
        monthly_values = []
        for row in monthly:
            monthly_values.append({
                "month": row.get("month"),
                "yield_kwh": parse_float(row.get("E_m")),
                "irradiation_kwh_m2": parse_float(row.get("H(i)_m")),
            })
        annual = parse_float(totals.get("E_y"))
        return {
            "status": "model",
            "message": "PVGIS langjarige modelberekening voor een referentiesysteem van 1 kWp, zuidgericht, 35° helling en 14% systeemverlies. Geen actuele meting of opbrengstgarantie.",
            "updated_at": iso(),
            "data": {
                "location": {"name": "Midden-Nederland (referentie)", "latitude": 52.1, "longitude": 5.3},
                "system": {"peak_power_kwp": 1, "tilt_degrees": 35, "orientation": "Zuid", "loss_percent": 14},
                "annual_yield_kwh": annual,
                "monthly": monthly_values,
                "source": "PVGIS v5.3 · European Commission Joint Research Centre",
            },
        }
    except Exception as exc:
        return {
            "status": "error",
            "message": "PVGIS API: " + str(exc)[:400],
            "updated_at": previous.get("updated_at"),
            "data": previous.get("data"),
        }


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    try:
        old = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    except Exception:
        old = {}
    old_sources = old.get("sources", {})

    snapshot = {
        "schema_version": 1,
        "generated_at": iso(),
        "refresh_interval_minutes": 15,
        "description": "Openbare energiesnapshot; API-sleutels worden alleen server-side door GitHub Actions gebruikt.",
        "sources": {
            "ned": {
                "status": "permission_required",
                "message": "NED staat openbare doorgifte van API-data aan derden niet toe zonder voorafgaande toestemming. Publieke koppeling volgt pas na schriftelijke afspraken.",
                "updated_at": None,
                "source_url": "https://ned.nl/nl/algemene-voorwaarden",
                "data": None,
            },
            "knmi": refresh_knmi(old_sources.get("knmi", {})),
            "tennet": {
                "status": "permission_required",
                "message": "TenneT staat het delen van API-data met derden niet toe tenzij dit expliciet is toegestaan in de API-documentatie. Publieke koppeling volgt pas na schriftelijke toestemming.",
                "updated_at": None,
                "source_url": "https://developer.tennet.eu/fair-use-policy",
                "data": None,
            },
            "pvgis": refresh_pvgis(old_sources.get("pvgis", {})),
        },
    }
    OUT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "generated_at": snapshot["generated_at"],
        "statuses": {name: source["status"] for name, source in snapshot["sources"].items()},
    }, indent=2))
    if all(v["status"] == "error" for v in snapshot["sources"].values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
