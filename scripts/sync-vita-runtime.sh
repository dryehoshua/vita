#!/bin/zsh
set -euo pipefail
cd -- "${0:A:h}/.."
runtime="$HOME/Library/Application Support/La Vita Runtime"
mkdir -p "$runtime/.local-tools" "$runtime/.local-data"
chmod 700 "$runtime" "$runtime/.local-data"
# The user launch agent must be able to start before Documents access is granted.
rsync -a --delete server/ "$runtime/server/"
rsync -a --delete src/ "$runtime/src/"
rsync -a --delete dist/ "$runtime/dist/"
rsync -a --delete scripts/ "$runtime/scripts/"
rsync -a node_modules/ "$runtime/node_modules/"
cp package.json "$runtime/package.json"
for tool in java dynamodb cloudflared; do
  mkdir -p "$runtime/.local-tools/$tool"
  rsync -a ".local-tools/$tool/" "$runtime/.local-tools/$tool/"
done
if [[ ! -e "$runtime/.local-data/.initialized" ]]; then
  if lsof -nP -iTCP:8000 -sTCP:LISTEN >/dev/null; then
    print -u2 'Stop the existing database before the initial runtime copy.'
    exit 1
  fi
  rsync -a .local-data/ "$runtime/.local-data/"
  touch "$runtime/.local-data/.initialized"
fi
