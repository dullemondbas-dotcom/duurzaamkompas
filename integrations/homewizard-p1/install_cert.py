#!/usr/bin/env python3
"""Download the official HomeWizard local API CA certificate via HTTPS."""
from pathlib import Path
from urllib.request import urlopen

URL = "https://api-documentation.homewizard.com/assets/files/homewizard-ca-cert-56d062ef8e71d1038f464ea905d42fc6.pem"
DEST = Path(__file__).with_name("homewizard-ca-cert.pem")
with urlopen(URL, timeout=20) as response:
    data = response.read(100_001)
if len(data) > 100_000 or b"BEGIN CERTIFICATE" not in data:
    raise SystemExit("Ongeldig CA-certificaat ontvangen.")
DEST.write_bytes(data)
print("HomeWizard CA-certificaat opgeslagen:", DEST)
