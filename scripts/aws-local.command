#!/bin/zsh
cd -- "$(dirname "$0")/.." || exit 1
exec .local-tools/aws-cli-expanded/aws-cli.pkg/Payload/aws-cli/aws "$@"
