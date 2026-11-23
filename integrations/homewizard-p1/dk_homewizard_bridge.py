#!/usr/bin/env python3
"""Local, opt-in HomeWizard P1 bridge for personal non-commercial use."""
from __future__ import annotations
import argparse, asyncio, hashlib, ipaddress, json, os, ssl, sys, time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
import aiohttp

APP_DIR = Path.home() / ".duurzaamkompas"
DEVICE_FILE = APP_DIR / "homewizard-device.json"
DEFAULT_CONFIG = Path("duurzaamkompas-homewizard-config.json")
CA_FILE = Path(__file__).with_name("homewizard-ca-cert.pem")
API_VERSION = "2"
CA_URL = "https://api-documentation.homewizard.com/assets/files/homewizard-ca-cert-56d062ef8e71d1038f464ea905d42fc6.pem"

def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}

def save_private(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass

def install_certificate() -> None:
    from urllib.request import urlopen
    with urlopen(CA_URL, timeout=20) as response:
        data = response.read(100_001)
    if len(data) > 100_000 or b"BEGIN CERTIFICATE" not in data:
        raise RuntimeError("Ongeldig HomeWizard CA-certificaat ontvangen.")
    CA_FILE.write_bytes(data)
    print("HomeWizard CA-certificaat opgeslagen:", CA_FILE)

def discover(config: dict, config_path: Path) -> None:
    from zeroconf import Zeroconf, ServiceBrowser, ServiceListener
    found = []
    class Listener(ServiceListener):
        def add_service(self, zc, service_type, name):
            info = zc.get_service_info(service_type, name, timeout=2500)
            if not info:
                return
            props = {k.decode(errors="replace"): (v or b"").decode(errors="replace")
                     for k, v in (info.properties or {}).items()}
            addresses = info.parsed_addresses()
            ipv4 = [a for a in addresses if ipaddress.ip_address(a).version == 4]
            row = {"name": name, "addresses": ipv4 or addresses, "properties": props}
            if row not in found:
                found.append(row)
                print("HomeWizard gevonden:", name, "·", ", ".join(row["addresses"]))
        def update_service(self, *args): pass
        def remove_service(self, *args): pass

    zc = Zeroconf()
    ServiceBrowser(zc, "_homewizard._tcp.local.", Listener())
    print("Zoeken naar HomeWizard API v2 op het lokale netwerk (10 seconden)…")
    try:
        time.sleep(10)
    finally:
        zc.close()
    candidates = [x for x in found
        if x["properties"].get("id", "").startswith("appliance/p1dongle/")
        or x["properties"].get("product_type") == "p1dongle"]
    if len(candidates) != 1 or not candidates[0]["addresses"]:
        raise RuntimeError("Geen unieke P1-meter gevonden. Controleer hetzelfde LAN/wifi-netwerk en vul bij meerdere meters device_ip en device_serial handmatig in.")
    row = candidates[0]
    device_id = row["properties"].get("id", "")
    serial = row["properties"].get("serial") or device_id.rsplit("/", 1)[-1]
    if not serial:
        raise RuntimeError("Serienummer van de P1-meter ontbreekt in de mDNS-informatie.")
    config["device_ip"] = row["addresses"][0]
    config["device_serial"] = serial
    save_private(config_path, config)
    print("P1-meter geselecteerd. Configuratie bijgewerkt:", config_path)
    print("Voer daarna uit: python dk_homewizard_bridge.py pair")

def tls_context() -> ssl.SSLContext:
    if not CA_FILE.exists():
        raise RuntimeError("HomeWizard CA-certificaat ontbreekt. Voer eerst python install_cert.py uit.")
    return ssl.create_default_context(cafile=str(CA_FILE))

def hostname(serial: str) -> str:
    return "appliance/p1dongle/" + serial

async def api_json(session, method, url, *, tls, server_name, headers=None, body=None):
    async with session.request(method, url, ssl=tls, server_hostname=server_name,
            headers=headers, json=body, timeout=aiohttp.ClientTimeout(total=20)) as response:
        text = await response.text()
        if response.status >= 400:
            raise RuntimeError("HomeWizard API antwoord " + str(response.status) + ": " + text[:180])
        return json.loads(text) if text else {}

async def pair(config: dict) -> None:
    ip, serial = config.get("device_ip", "").strip(), config.get("device_serial", "").strip()
    if not ip or not serial:
        raise RuntimeError("Voer eerst discover uit of vul device_ip en device_serial in.")
    tls, name = tls_context(), hostname(serial)
    local_user = config.get("local_user") or "local/duurzaamkompas-" + serial[-6:]
    async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=tls)) as session:
        print("Druk op de fysieke knop van de HomeWizard P1 wanneer de meter om bevestiging vraagt.")
        deadline = time.time() + 300
        while time.time() < deadline:
            try:
                result = await api_json(session, "POST", "https://" + ip + "/api/user",
                    tls=tls, server_name=name,
                    headers={"X-Api-Version": API_VERSION, "Content-Type": "application/json"},
                    body={"name": local_user})
                token = result.get("token")
                if token:
                    save_private(DEVICE_FILE, {"device_ip": ip, "device_serial": serial,
                        "device_token": token, "user_name": local_user,
                        "paired_at": datetime.now().astimezone().isoformat()})
                    print("HomeWizard gekoppeld. Het apparaat-token staat uitsluitend lokaal in", DEVICE_FILE)
                    return
            except RuntimeError as exc:
                if "403" not in str(exc):
                    raise
            await asyncio.sleep(2)
    raise RuntimeError("Geen fysieke bevestiging ontvangen. Start pair opnieuw en druk op de P1-knop.")

def counter_total(data: dict, stem: str):
    direct = data.get(stem + "_kwh")
    if direct is not None:
        return float(direct)
    values = [data.get(stem + "_t" + str(i) + "_kwh") for i in range(1, 5)]
    values = [float(v) for v in values if v is not None]
    return sum(values) if values else None

def normalize(data: dict, serial: str) -> dict:
    stamp = data.get("timestamp")
    observed = datetime.now(ZoneInfo("Europe/Amsterdam"))
    measured = datetime.fromisoformat(stamp.replace("Z", "+00:00")) if stamp else observed
    if measured.tzinfo is None:
        measured = measured.replace(tzinfo=ZoneInfo("Europe/Amsterdam"))
    raw_power = data.get("power_w")
    if raw_power is None:
        phases = [data.get("power_l" + str(i) + "_w") for i in range(1, 4)]
        power = sum(float(x or 0) for x in phases) if any(x is not None for x in phases) else None
    else:
        power = float(raw_power)
    external = data.get("external") or []
    gas = next((x.get("value") for x in external
                if x.get("type") == "gas_meter" and x.get("unit") == "m3"), None)
    imported, exported = counter_total(data, "energy_import"), counter_total(data, "energy_export")
    event = "|".join(map(str, [data.get("unique_id") or serial, measured.isoformat(),
        imported, exported, power, gas]))
    return {
        "source_event_id": hashlib.sha256(event.encode()).hexdigest(),
        "measured_at": measured.isoformat(),
        "grid_import_w": max(power, 0) if power is not None else None,
        "grid_export_w": max(-power, 0) if power is not None else None,
        "grid_import_total_kwh": imported,
        "grid_export_total_kwh": exported,
        "gas_total_m3": gas
    }

async def disconnect() -> None:
    device = read_json(DEVICE_FILE)
    if not device.get("device_token"):
        print("Geen lokaal HomeWizard-token gevonden.")
        return
    tls, serial, ip = tls_context(), device["device_serial"], device["device_ip"]
    await_name = hostname(serial)
    async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=tls)) as session:
        await api_json(session, "DELETE", "https://" + ip + "/api/user",
            tls=tls, server_name=await_name,
            headers={"X-Api-Version": API_VERSION,
                "Authorization": "Bearer " + device["device_token"],
                "Content-Type": "application/json"},
            body={"name": device.get("user_name", "local/duurzaamkompas")})
    DEVICE_FILE.unlink(missing_ok=True)
    print("Lokale HomeWizard-toegang ingetrokken en apparaat-token verwijderd.")

async def run_bridge(config: dict) -> None:
    device = read_json(DEVICE_FILE)
    key = config.get("integration_key", "")
    ingest_url = config.get("ingest_url", "")
    if not device.get("device_token"):
        raise RuntimeError("Nog niet gekoppeld. Voer eerst pair uit.")
    if len(key) != 64 or any(c not in "0123456789abcdefABCDEF" for c in key):
        raise RuntimeError("Geen geldige eenmalige integration_key in configuratie.")
    if not ingest_url.startswith("https://"):
        raise RuntimeError("ingest_url moet HTTPS gebruiken.")
    serial, ip = device["device_serial"], device["device_ip"]
    name, tls = hostname(serial), tls_context()
    headers = {"X-Api-Version": API_VERSION, "Authorization": "Bearer " + device["device_token"]}
    poll = max(15, min(300, int(config.get("poll_seconds", 30))))
    async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=tls)) as session:
        print("DuurzaamKompas HomeWizard-bridge actief; interval:", poll, "seconden. Stop met Ctrl+C.")
        while True:
            try:
                reading = await api_json(session, "GET", "https://" + ip + "/api/measurement",
                    tls=tls, server_name=name, headers=headers)
                payload = normalize(reading, serial)
                async with session.post(ingest_url, json=payload,
                    headers={"Content-Type": "application/json", "x-dk-integration-key": key},
                    timeout=aiohttp.ClientTimeout(total=20)) as response:
                    result = await response.json(content_type=None)
                    if response.status >= 400:
                        raise RuntimeError("DuurzaamKompas ingestie antwoord " + str(response.status)
                            + ": " + str(result.get("error", "onbekende fout")))
                print(datetime.now().strftime("%H:%M:%S"), "· meetwaarde verzonden")
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                print("Synchronisatiefout:", str(exc), file=sys.stderr)
            await asyncio.sleep(poll)

async def main() -> None:
    parser = argparse.ArgumentParser(description="DuurzaamKompas lokale HomeWizard P1-bridge")
    parser.add_argument("command", choices=["discover", "pair", "run", "disconnect"])
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    args = parser.parse_args()
    config = read_json(Path(args.config))
    if args.command == "discover":
        discover(config, Path(args.config))
    elif args.command == "pair":
        await pair(config)
    elif args.command == "run":
        await run_bridge(config)
    elif args.command == "disconnect":
        await disconnect()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nBridge gestopt.")
    except Exception as exc:
        print("Fout:", exc, file=sys.stderr)
        raise SystemExit(1)
