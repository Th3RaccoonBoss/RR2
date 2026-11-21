#!/bin/sh
set -eu
cd "$(dirname "$0")"
node --test ./*.test.mjs
node stress.mjs
PYTHONDONTWRITEBYTECODE=1 "${PYTHON_BIN:-python3}" -m unittest discover -p '*test.py'

node ui-independent-qa.cjs
