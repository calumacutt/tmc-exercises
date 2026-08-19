#!/usr/bin/env sh
# Local dev server. ES modules need an HTTP origin - file:// will not work.
# See CLAUDE.md section 3.
# NOTE: `python`, not `python3` - python3 is not on PATH on the Windows dev box.
cd "$(dirname "$0")/.." || exit 1
echo "Serving $(pwd) at http://localhost:8000/"
echo "  hub     http://localhost:8000/"
echo "  wheel   http://localhost:8000/wheel/"
echo "  builder http://localhost:8000/builder/"
# serve.py sends no-store, so an edited module always takes effect on reload.
# Plain `python -m http.server` lets the browser cache ES modules and silently
# keep running stale code.
exec python tools/serve.py 8000
