# Betbuddy

Betbuddy is a self-hosted betting web app intended for VPS deployment.

## Background

This project originally started as a Google AI Studio / Firebase-style prototype and was later refactored with Claude Code toward a more open, self-hostable architecture.

The repository may still contain some legacy AI Studio / Firebase artifacts, but the current direction is a production-style deployment with a custom backend, PostgreSQL, reverse proxying, and shared authentication.

## Production target

The intended production deployment is:

- `betbuddy.mofosis.de` → Betbuddy app
- `auth.mofosis.de` → shared Authelia authentication portal

Betbuddy should authenticate through Authelia via reverse proxy integration.

## Project role

Betbuddy is both:

1. a real application that should be deployed, and
2. the main deployment reference for the shared VPS setup used by Betbuddy and VinoReveal

In particular, this repository currently contains the strongest reference for:

- Docker-based VPS deployment
- reverse proxy setup
- PostgreSQL-backed hosting
- shared Authelia authentication
- production-oriented service layout for multiple apps on one VPS

## Deployment guide

The canonical deployment documentation lives here:

- [`deploy/README.md`](./deploy/README.md)

That deployment guide describes the shared infrastructure for:

- `betbuddy.mofosis.de`
- `vinoreveal.mofosis.de`
- `auth.mofosis.de`

and covers the main VPS setup using:

- Caddy
- Authelia
- PostgreSQL
- Redis
- Docker Compose

If there is any conflict between this top-level README and the deployment instructions, treat `deploy/README.md` as the source of truth for deployment.

## Architecture

Current / intended stack:

- Frontend: Vite + TypeScript
- Backend: Node.js + TypeScript
- Database: PostgreSQL
- Realtime updates: Server-Sent Events (SSE)
- Deployment: Docker on a VPS
- Authentication: Authelia via reverse proxy
- Reverse proxy / TLS: Caddy
- Sessions / supporting services: Redis (via deployment stack)

## Relationship to VinoReveal

A related repository, `mofosis/vinoreveal-alpha`, follows a similar migration path.

- Betbuddy is one of the production apps to deploy
- VinoReveal is another production app to deploy
- Betbuddy currently provides the main shared deployment/auth reference
- Both apps should authenticate through the same Authelia instance at `auth.mofosis.de`

## Repository status

This repository is in a transitional state between its original AI Studio / Firebase structure and its self-hosted open-source target architecture.

That means:
- some Firebase-era files may still remain
- old and new architecture clues may coexist
- deployment files may continue to evolve as the VPS setup is refined

## Local development

### Requirements

- Node.js
- npm
- PostgreSQL
- Docker (optional, for local container-based workflows)

### Install

```bash
npm install
```

### Run frontend

```bash
npm run dev
```

### Run backend

If this repository includes the backend entrypoint:

```bash
npm run server
```

## Notes

This repository originated from a Google AI Studio / Firebase-style app template. Any remaining Firebase files should generally be treated as migration artifacts unless they are still actively required by the current stack.
