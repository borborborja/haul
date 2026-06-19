#!/bin/sh
set -e

# When started as root, make sure the data directory is writable by the
# unprivileged "shoplist" user, then drop privileges. This keeps the image
# working both with named volumes and with host bind-mounts (whose ownership
# comes from the host and would otherwise break SQLite with error 14).
if [ "$(id -u)" = "0" ]; then
	chown -R shoplist:shoplist /pb_data 2>/dev/null || true
	exec su-exec shoplist:shoplist /app/shoplist "$@"
fi

# Already running as a non-root user (e.g. `docker run --user ...`); the
# mounted directory must already be writable by that user.
exec /app/shoplist "$@"
