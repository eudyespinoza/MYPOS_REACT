#!/bin/sh
set -e

: "${UVICORN_HOST:=0.0.0.0}"
: "${UVICORN_PORT:=8000}"
: "${UVICORN_APP:=backend_app.main:app}"
: "${UVICORN_RELOAD:=0}"
: "${UVICORN_WORKERS:=1}"

mkdir -p /app/logs
chmod 777 /app/logs

if [ "$UVICORN_RELOAD" = "1" ]; then
  exec uvicorn "$UVICORN_APP" --host "$UVICORN_HOST" --port "$UVICORN_PORT" --reload
elif [ "$UVICORN_WORKERS" -gt 1 ]; then
  exec uvicorn "$UVICORN_APP" --host "$UVICORN_HOST" --port "$UVICORN_PORT" --workers "$UVICORN_WORKERS"
else
  exec uvicorn "$UVICORN_APP" --host "$UVICORN_HOST" --port "$UVICORN_PORT"
fi
