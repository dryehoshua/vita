#!/usr/bin/env python3
"""Save an online DynamoDB Local database snapshot and its local media."""
from datetime import datetime, timezone
from pathlib import Path
import os
import shutil
import sqlite3
import tempfile

os.umask(0o077)
data = Path(__file__).resolve().parent.parent / ".local-data"
base = data / "backups" / "scheduled"
base.mkdir(mode=0o700, parents=True, exist_ok=True)
database = data / "dynamodb" / "shared-local-instance.db"
with tempfile.TemporaryDirectory(prefix=".snapshot-", dir=base) as staging:
    stage = Path(staging) / "backup"
    stage.mkdir()
    copy = stage / database.name
    with sqlite3.connect(database.as_uri()+"?mode=ro", uri=True) as source:
        with sqlite3.connect(copy) as target:
            source.backup(target, pages=100, sleep=0.1)
            if target.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                raise RuntimeError("Backup integrity check failed")
    for name in ("avatars", "workspace-media"):
        shutil.copytree(data / name, stage / name, symlinks=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    stage.rename(base / stamp)
    print(f"Verified backup created: {stamp}")
