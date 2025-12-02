#!/usr/bin/env zsh
set -euo pipefail

# Use Node from .nvmrc if available
if command -v nvm >/dev/null 2>&1; then
  nvm use >/dev/null
fi

# Set a dummy MOESIF_APPLICATION_ID if not provided
export MOESIF_APPLICATION_ID=application_id_placeholder

node --test tests/*.js
