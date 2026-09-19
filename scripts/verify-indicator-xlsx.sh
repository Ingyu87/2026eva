#!/usr/bin/env bash
set -eu
node scripts/create-test-template.cjs
node scripts/verify-indicator.mjs
