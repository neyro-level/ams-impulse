#!/usr/bin/env bash
set -euo pipefail

case "${RUN_SECURITY_SCAN:-}" in
  true)
    apt-get install -y --no-install-recommends python3-pip
    python3 -m pip install --break-system-packages --no-cache-dir semgrep==1.173.0
    ;;
  false)
    ;;
  *)
    echo "RUN_SECURITY_SCAN must be true or false" >&2
    exit 1
    ;;
esac

case "${RUN_BUILD:-}" in
  true|false)
    ;;
  *)
    echo "RUN_BUILD must be true or false" >&2
    exit 1
    ;;
esac
