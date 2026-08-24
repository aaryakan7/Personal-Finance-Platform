# walletapp

A personal finance / expense tracker, built as a portfolio project to demonstrate
full-stack, security, and AI-integration skills.

## Features

- JWT authentication with bcrypt password hashing and encrypted sensitive fields
- Manual expense tracking and Plaid Sandbox transaction imports
- Monthly category budgets with on-track, near-budget, and over-budget states
- Spending reports, monthly trends, and budget-versus-actual charts
- Gemini spending summaries, recommendations, and anomaly explanations
- Redis response caching and distributed login throttling
- Production Docker images with health and readiness checks

## Structure

This is a monorepo with two independent apps — they don't share code or a
runtime, and each has its own `package.json`, dependencies, and dev server.

```
walletapp/
  backend/     Node.js + Express REST API (talks to PostgreSQL)
  frontend/    Next.js web app (talks to the backend over HTTP)
```

**Why two separate apps instead of one Next.js app with API routes?** Next.js can
do both frontend and backend in one project, but keeping a standalone Express API
demonstrates the ability to design and run a REST API independently of any
particular frontend framework — the kind of API another team's mobile app or a
third-party integration could also call. That's a common real-world setup and a
better resume signal than a framework's built-in API routes.

## Architecture

The browser runs a Next.js frontend and calls the standalone Express REST API
with a bearer JWT. Express validates each request and scopes database access to
the authenticated user. PostgreSQL stores users, categories, transactions,
budgets, linked accounts, and encrypted Plaid credentials.

Redis caches user-specific read models and coordinates login throttling across
backend instances. Successful transaction, category, budget, and Plaid mutations
increment a per-user cache version, making older entries unreachable without an
expensive key scan. PostgreSQL remains the source of truth if Redis is unavailable.

Plaid supplies sandbox bank transactions. Gemini receives structured spending
totals for narrative insights, recommendations, and explanations; it does not
receive user passwords, encryption keys, or Plaid access tokens.

### Request flow

1. The Next.js client sends a request with the user's JWT.
2. Express validates the token and input before entering a controller.
3. Read endpoints check the user's Redis cache before querying PostgreSQL.
4. Controllers query rows scoped to the authenticated user.
5. Successful mutations invalidate that user's cached read models.
6. The API returns JSON for the dashboard, reports, or insights UI.

## Running locally

You'll need [Node.js](https://nodejs.org) (LTS) installed, plus a free
[Neon](https://neon.tech) Postgres database.

### Backend

```
cd backend
npm install
copy .env.example .env      # then fill in DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY
npm run migrate             # creates the database tables
npm run dev                 # starts the API on http://localhost:4000
```

### Frontend

```
cd frontend
npm install
copy .env.local.example .env.local
npm run dev                 # starts the web app on http://localhost:3000
```

See `backend/.env.example` for how to generate `JWT_SECRET` and `ENCRYPTION_KEY`.

## Testing

Backend tests use Jest and cover Redis caching, login throttling, field
encryption, and month normalization:

```sh
cd backend
npm test
```

The GitHub Actions workflow runs the backend test suite and a clean Next.js
production build on every push and pull request.

## Production

Phase 7 adds optional Redis caching and Redis-backed login throttling. Phase 8
adds production Docker images, health/readiness checks, graceful shutdown, and a
deployment checklist. See `DEPLOYMENT.md` for required environment variables and
the release sequence.
