# Production deployment

The app deploys as two Node.js services plus managed PostgreSQL and Redis. The
included Dockerfiles work on any container host. `docker-compose.yml` is a
production-like local smoke test, not a substitute for managed backups or TLS.

## Backend

Build from `backend/Dockerfile` and expose port 4000. The container applies the
idempotent SQL migrations before starting the API. Configure:

- `NODE_ENV=production`
- `PORT=4000`
- `DATABASE_URL`: production Neon PostgreSQL connection string
- `DATABASE_SSL_REJECT_UNAUTHORIZED=true`
- `REDIS_URL`: managed Redis connection string; use `rediss://` when required
- `JWT_SECRET`: at least 48 random bytes, hex encoded
- `ENCRYPTION_KEY`: exactly 32 random bytes, hex encoded; back it up securely
- `CORS_ORIGIN`: exact public frontend origin, including `https://`
- `TRUST_PROXY`: usually `1` on a host with one trusted ingress proxy
- `PLAID_CLIENT_ID`, `PLAID_SECRET`, and `PLAID_ENV`
- `GEMINI_API_KEY` and optionally `GEMINI_MODEL`

Optional tuning values are documented in `backend/.env.example`. Configure the
host's health check as `/health` and readiness check as `/ready`.

Do not rotate `ENCRYPTION_KEY` without re-encrypting stored phone numbers and
Plaid access tokens. Losing it makes those encrypted values unrecoverable.

## Frontend

Build from `frontend/Dockerfile` and expose port 3000. Pass
`NEXT_PUBLIC_API_URL=https://api.your-domain.example` as a build argument. Next.js
embeds this public value during the build, so changing it requires rebuilding the
frontend image.

## Release checklist

1. Provision PostgreSQL and Redis in the same region as the backend.
2. Add all backend secrets through the hosting provider's secret manager.
3. Deploy the backend and confirm both `/health` and `/ready` return 200.
4. Build and deploy the frontend with the final public backend URL.
5. Set `CORS_ORIGIN` to the deployed frontend origin and redeploy the backend.
6. Test signup, login throttling, a transaction mutation, reports, Plaid sandbox
   sync, and AI insights over HTTPS.
7. Enable database backups, Redis eviction/usage alerts, centralized logs, and
   uptime checks before switching Plaid out of sandbox.

For a local container smoke test, populate `backend/.env`, then run
`docker compose up --build`. Set `NEXT_PUBLIC_API_URL` in the shell first when the
browser should call something other than `http://localhost:4000`.
