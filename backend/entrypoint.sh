#!/usr/bin/env sh
set -e

echo "Waiting for PostgreSQL at ${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432}…"
python - <<'PY'
import os, socket, time

host = os.environ.get("POSTGRES_HOST", "db")
port = int(os.environ.get("POSTGRES_PORT", "5432"))
for _ in range(60):
    try:
        with socket.create_connection((host, port), timeout=2):
            break
    except OSError:
        time.sleep(1)
else:
    raise SystemExit(f"PostgreSQL at {host}:{port} never became reachable")
PY

python manage.py migrate --noinput
python manage.py collectstatic --noinput

exec "$@"
