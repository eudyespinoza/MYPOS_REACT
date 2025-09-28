#!/bin/sh
set -e

: "${DJANGO_SETTINGS_MODULE:=buscador_django.settings}"
: "${DJANGO_WSGI_MODULE:=buscador_django.wsgi}"
: "${GUNICORN_WORKERS:=3}"
: "${GUNICORN_TIMEOUT:=60}"

# Asegurar permisos correctos en logs cada vez que se inicie el contenedor
mkdir -p /app/logs
chmod 777 /app/logs

python manage.py collectstatic --noinput
python manage.py migrate --noinput

exec python -m gunicorn "${DJANGO_WSGI_MODULE}:application" \
  --bind 0.0.0.0:8000 \
  --workers "${GUNICORN_WORKERS}" \
  --timeout "${GUNICORN_TIMEOUT}" \
  --access-logfile - --error-logfile -
