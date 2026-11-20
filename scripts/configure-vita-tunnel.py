#!/usr/bin/env python3
"""Generate local ingress for La Vita from a named tunnel credential file."""
import argparse
import json
import os
from pathlib import Path
import uuid

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument("credential",type=Path)
args=parser.parse_args()
root=Path(__file__).resolve().parent.parent
private=root/".local-data"
credential=json.loads(args.credential.read_bytes())
tunnel_id=str(uuid.UUID(credential["TunnelID"]))
if not credential.get("TunnelSecret") or not credential.get("AccountTag"):
    parser.error("Expected named Cloudflare Tunnel credentials")
os.umask(0o077)
private.mkdir(mode=0o700,exist_ok=True)
secret=private/"named-tunnel.json"
secret.write_text(json.dumps(credential))
secret.chmod(0o600)
config=private/"tunnel.yml"
config.write_text(f"""tunnel: {tunnel_id}
credentials-file: {json.dumps(str(secret))}
no-autoupdate: true
ingress:
  - hostname: origin-vita.roma-condesa.app
    service: http://127.0.0.1:4175
    originRequest:
      httpHostHeader: roma-condesa.app
  - service: http_status:404
""")
config.chmod(0o600)
print(f"Local ingress configured for {tunnel_id}")
