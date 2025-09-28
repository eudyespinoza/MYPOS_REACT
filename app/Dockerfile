FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# --- ODBC runtime + MS ODBC Driver 18 (para Debian 12/bookworm) ---
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates gnupg2 apt-transport-https \
    build-essential \
    unixodbc libodbc1 unixodbc-dev odbcinst \
    libgssapi-krb5-2 \
 && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
  curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg; \
  echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/microsoft-prod.list; \
  apt-get update; \
  ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18; \
  rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Requisitos Python
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Usuario no root
RUN useradd -m -u 1000 app

# Código y entrypoint
COPY src /app
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh \
    && mkdir -p /app/staticfiles /app/logs /data/services_db /data/cache /data/sessions \
    && chown -R app:app /app /data \
    && chmod -R 755 /app/staticfiles /app/logs /data/services_db /data/cache /data/sessions \
    && chmod -R 777 /app/logs

USER app
EXPOSE 8000
CMD ["/entrypoint.sh"]

