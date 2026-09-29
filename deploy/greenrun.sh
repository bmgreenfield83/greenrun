#!/usr/bin/env sh
# Everyday Greenrun commands on the Beelink. Run from the repository folder: ./deploy/greenrun.sh <command>
set -eu
cd "$(dirname "$0")/.."
compose() { docker compose -f compose.prod.yml "$@"; }
[ -f .env ] || { echo "Missing .env: copy .env.production.example to .env and fill it in (docs/deployment.md)." >&2; exit 1; }
port() { v="$(grep '^GREENRUN_PORT=' .env | cut -d= -f2- | tr -d '\r')"; echo "${v:-8440}"; }

case "${1:-help}" in
  start)   compose up -d --build && compose ps ;;
  update)  git pull --ff-only && compose up -d --build && compose ps ;;
  stop)    compose down ;;
  status)  compose ps
           curl -fsS "http://127.0.0.1:$(port)/api/health" && echo
           curl -sS "http://127.0.0.1:$(port)/api/ready" && echo ;;
  logs)    compose logs -f --tail=100 app ;;
  *)       cat <<USAGE
Usage: $0 <command>
  start    build and start Greenrun
  update   pull the latest code, rebuild, restart
  stop     stop Greenrun
  status   container state, liveness, and Atlas connectivity
  logs     follow the app log
USAGE
           ;;
esac
