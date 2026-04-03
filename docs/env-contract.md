# Environment Contract

## API

- `PORT`: API listen port (`3000` default)
- `HOST`: API listen host (`0.0.0.0` default)
- `CORS_ORIGIN`: Web origin allowed by CORS (`http://localhost:5173` default)
- `DEMO_JOB_RUNNERS`: Enable demo job runners and `/demo/queues` board (`true` by default outside production)

## Policy

- `.env.example` is the source of truth for required local variables.
- New env vars must be added to `.env.example` and this contract in the same change.
