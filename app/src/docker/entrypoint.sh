#!/usr/bin/env sh
set -e

# Ensure persistent DB path via symlink
# Ensure data directories and permissions
mkdir -p /data/sessions /data/services_db /data/cache
chown -R appuser:appuser /data || true
chown -R appuser:appuser /app/logs /app/staticfiles || true
mkdir -p /data
if [ ! -e /data/db.sqlite3 ]; then
  # If app DB exists, move it; else create empty so migrate creates schema
  if [ -e /app/db.sqlite3 ]; then
    mv /app/db.sqlite3 /data/db.sqlite3
  else
    touch /data/db.sqlite3
  fi
fi
if [ ! -e /app/db.sqlite3 ]; then
  ln -s /data/db.sqlite3 /app/db.sqlite3
fi

echo "Applying database migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting Gunicorn..."
exec gunicorn buscador_django.wsgi:application \
  --bind 0.0.0.0:8000 \
  --user appuser --group appuser \
  --workers ${GUNICORN_WORKERS:-3} \
  --timeout ${GUNICORN_TIMEOUT:-180}

