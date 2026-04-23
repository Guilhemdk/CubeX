#!/usr/bin/env bash
set -euo pipefail

corepack enable
corepack prepare yarn@1.22.22 --activate
yarn install --frozen-lockfile
