# Environment Contract

## API

- `PORT`: API listen port (`3000` default)
- `HOST`: API listen host (`0.0.0.0` default)
- `CORS_ORIGIN`: Web origin allowed by CORS (`http://localhost:5173` default)
- `SESSION_IDLE_TIMEOUT_MS`: Milliseconds before idle session timeout (`300000` default)
- `QUEUE_MAX_PARTICIPANTS`: Max queue entries allowed per session (`250` default)
- `SESSION_STORE_FILE`: Optional JSON file path for persisted session/queue state (unset = in-memory only)

## Policy

- `.env.example` is the source of truth for required local variables.
- New env vars must be added to `.env.example` and this contract in the same change.
