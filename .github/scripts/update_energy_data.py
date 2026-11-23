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


def records_from(payload):
    found = []

    def walk(value):
        if isinstance(value, dict):
            if any(k in value for k in ("validfrom", "valid_from", "timestamp", "datetime")) and any(
                k in value for k in ("capacity", "volume", "price", "settlement_price", "imbalance_price")
            ):
                found.append(value)
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)

    walk(payload)
    unique = {}
    for row in found:
        marker = json.dumps(row, sort_keys=True, default=str)
        unique[marker] = row
    return list(unique.values())


def parse_float(value):
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def refresh_ned(previous):
    token = os.getenv("NED_API_KEY", "").strip()
    if not token:
        return {
            "status": "setup_required",
            "message": "Voeg NED_API_KEY toe bij GitHub → Settings → Secrets and variables → Actions.",
            "updated_at": previous.get("updated_at"),
            "data": previous.get("data", {}),
        }

    end = now_utc().date() + timedelta(days=1)
    start = now_utc().date() - timedelta(days=2)
    headers = {"X-AUTH-TOKEN": token, "Accept": "application/ld+json"}
    specs = {
        "solar": {"type": 2, "activity": 1},
        "wind": {"type": 1, "activity": 1},
        "load": {"type": 59, "activity": 2},
    }
    result = {}
    errors = []
    for key, spec in specs.items():
        params = {
            "point": 0,
            "type": spec["type"],
            "granularity": 3,
            "granularitytimezone": 1,
            "classification": 2,
            "activity": spec["activity"],
            "validfrom[after]": start.isoformat(),
            "validfrom[strictly_before]": (end + timedelta(days=1)).isoformat(),
        }
        url = "https://api.ned.nl/v1/utilizations?" + urlencode(params)
        try:
            payload = api_get(url, headers)
            rows = records_from(payload)
            rows.sort(key=lambda row: str(row.get("validfrom") or row.get("valid_from") or row.get("timestamp") or ""))
            series = []
            for row in rows[-24:]:
                capacity = parse_float(row.get("capacity"))
                series.append({
                    "time": row.get("validfrom") or row.get("valid_from") or row.get("timestamp"),
                    "mw": round(capacity / 1000, 3) if capacity is not None else None,
                    "volume_kwh": parse_float(row.get("volume")),
                    "percentage": parse_float(row.get("percentage")),
                    "lastupdate": row.get("lastupdate"),
                })
            latest = series[-1] if series else None
            result[key] = {"latest": latest, "series": series}
            if not rows:
                errors.append(key + ": API returned no usable data for the selected period.")
        except Exception as exc:
            result[key] = {"latest": None, "series": []}
            errors.append(key + ": " + str(exc)[:300])

    status = "live" if not errors else ("partial" if any(v.get("latest") for v in result.values()) else "error")
    return {
        "status": status,
        "message": "NED near-real-time utilization data (10-minute intervals)." if not errors else " | ".join(errors),
        "updated_at": iso(),
        "data": result,
    }


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


def refresh_tennet(previous):
    token = os.getenv("TENNET_API_KEY", "").strip()
    if not token:
        return {
            "status": "setup_required",
            "message": "Voeg TENNET_API_KEY toe bij GitHub → Settings → Secrets and variables → Actions. Vraag toegang aan voor de Settlement Prices API.",
            "updated_at": previous.get("updated_at"),
            "data": previous.get("data"),
        }

    # TenneT publishes settlement prices by balancing time unit.
    end = now_utc()
    start = end - timedelta(days=2)
    date_from = start.strftime("%d-%m-%Y %H:%M:%S")
    date_to = end.strftime("%d-%m-%Y %H:%M:%S")
    params = urlencode({"date_from": date_from, "date_to": date_to})
    url = "https://api.tennet.eu/publications/v1/settlement-prices?" + params
    try:
        payload = api_get(url, {"apikey": token, "Accept": "application/json"})
        rows = records_from(payload)
        if not rows and isinstance(payload, list):
            rows = payload
        rows.sort(key=lambda row: str(row.get("datetime") or row.get("timestamp") or row.get("date") or row.get("time") or ""))
        series = []
        for row in rows[-48:]:
            time_value = row.get("datetime") or row.get("timestamp") or row.get("date") or row.get("time") or row.get("period_start")
            price = None
            for key in ("settlement_price", "settlementPrice", "imbalance_price", "imbalancePrice", "price", "price_eur_mwh"):
                if key in row:
                    price = parse_float(row.get(key))
                    if price is not None:
                        break
            series.append({
                "time": time_value,
                "price_eur_mwh": price,
                "raw": {k: v for k, v in row.items() if isinstance(v, (str, int, float, bool))},
            })
        latest = series[-1] if series else None
        return {
            "status": "live" if latest else "partial",
            "message": "TenneT published settlement prices. These are settlement values published per balancing time unit, not a live household tariff.",
            "updated_at": iso(),
            "data": {"latest": latest, "series": series},
        }
    except Exception as exc:
        return {
            "status": "error",
            "message": "TenneT API: " + str(exc)[:400],
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
            "ned": refresh_ned(old_sources.get("ned", {})),
            "knmi": refresh_knmi(old_sources.get("knmi", {})),
            "tennet": refresh_tennet(old_sources.get("tennet", {})),
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
