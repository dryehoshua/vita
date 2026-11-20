#!/usr/bin/env python3
"""Install only La Vita's launchd jobs for the current macOS user."""
import argparse
from pathlib import Path
import os
import plistlib
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--node", required=True, type=Path)
parser.add_argument("--install", action="store_true", help="Load the generated jobs for this user")
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
data = root / ".local-data"
logs = data / "service-logs"
agents = Path.home() / "Library" / "LaunchAgents"
domain = f"gui/{os.getuid()}"
jobs = {
    "database": (["/bin/zsh", str(root / "scripts/start-dynamodb.command")], True),
    "local": ([str(args.node.resolve()), str(root / "server/start.mjs")], True),
    "backend": ([str(args.node.resolve()), str(root / "server/pilot-start.mjs")], True),
    "backup": (["/usr/bin/python3", str(root / "scripts/backup-vita.py")], False),
}
tunnel_config = data / "tunnel.yml"
if tunnel_config.is_file():
    jobs["tunnel"] = ([str(root / ".local-tools/cloudflared/cloudflared"), "tunnel",
                       "--config", str(tunnel_config), "run"], True)
if not args.node.is_file():
    parser.error("Node binary does not exist")
if args.install:
    for path in (logs, agents):
        path.mkdir(mode=0o700, parents=True, exist_ok=True)
for name, (command, persistent) in jobs.items():
    label = f"app.roma-condesa.vita.{name}"
    path = agents / f"{label}.plist"
    config = {
        "Label": label, "ProgramArguments": command, "WorkingDirectory": str(root),
        "StandardOutPath": str(logs / f"{name}.log"),
        "StandardErrorPath": str(logs / f"{name}.log"), "ThrottleInterval": 10,
    }
    if persistent:
        config.update(RunAtLoad=True, KeepAlive=True)
    else:
        config["StartCalendarInterval"] = {"Hour": 4, "Minute": 0}
    if args.install:
        temporary = path.with_suffix(".tmp")
        temporary.write_bytes(plistlib.dumps(config))
        temporary.chmod(0o600)
        temporary.replace(path)
        subprocess.run(["/bin/launchctl", "bootout", f"{domain}/{label}"], capture_output=True)
        subprocess.run(["/bin/launchctl", "bootstrap", domain, str(path)], check=True)
    print(f"{'Installed' if args.install else 'Prepared'} {label}")
