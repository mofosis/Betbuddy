# VPS Deployment Guide

## Architecture

```
Internet → Caddy (TLS) → Authelia (SSO) → BetBuddy / VinoReveal
                                         → PostgreSQL (data)
                                         → Redis (sessions)
```

- **betbuddy.mofosis.de** — BetBuddy app
- **vinoreveal.mofosis.de** — VinoReveal app
- **auth.mofosis.de** — Authelia login portal

## First-Time Setup

### 1. Clone repos on VPS

```bash
mkdir -p /opt/vps
cd /opt/vps
git clone https://github.com/mofosis/betbuddy.git
git clone https://github.com/mofosis/vinoreveal-alpha.git vinoreveal
cp -r betbuddy/deploy/* .
```

### 2. Create .env

```bash
cp .env.example .env
# Edit .env and fill in all values:
# - POSTGRES_PASSWORD: strong random password
# - AUTHELIA_JWT_SECRET: openssl rand -hex 32
# - AUTHELIA_SESSION_SECRET: openssl rand -hex 32
# - AUTHELIA_STORAGE_ENCRYPTION_KEY: openssl rand -hex 32
nano .env
```

### 3. Set up Authelia users

Generate password hashes for each user:

```bash
docker run authelia/authelia:latest authelia crypto hash generate argon2 --password 'your-password'
```

Edit `authelia/users_database.yml` and replace `REPLACE_WITH_GENERATED_HASH` with the output.

To make a user admin (sees Reset button in BetBuddy), add `admins` to their groups.

### 4. Point DNS

Create A records for:
- `auth.mofosis.de` → VPS IP
- `betbuddy.mofosis.de` → VPS IP
- `vinoreveal.mofosis.de` → VPS IP

### 5. Start everything

```bash
docker compose up -d
```

Caddy automatically fetches Let's Encrypt certificates.

## Updates

```bash
bash /opt/vps/deploy.sh
```

## Adding Users

Edit `authelia/users_database.yml`, then:

```bash
docker compose restart authelia
```

## Backup

```bash
docker compose exec postgres pg_dumpall -U postgres > backup_$(date +%Y%m%d).sql
```
