#!/bin/zsh
cd -- "$(dirname "$0")/.." || exit 1
vita_node="$(command -v node)"
if [[ -z "$vita_node" ]]; then vita_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"; fi
if [[ ! -x "$vita_node" ]]; then print 'Instala Node.js 24 para iniciar La Vita.'; exit 1; fi
exec "$vita_node" server/start.mjs
