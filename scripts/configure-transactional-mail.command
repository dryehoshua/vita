#!/bin/zsh
set -euo pipefail
cd -- "${0:A:h}/.."
vita_node="$(command -v node || true)"
if [[ -z "$vita_node" ]]; then
  vita_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
read -rs 'vita_mail_password?Contraseña del buzón noreply@roma-condesa.app: '
print
printf '%s' "$vita_mail_password" | "$vita_node" scripts/configure-transactional-mail.mjs
unset vita_mail_password
