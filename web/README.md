# Web app (Nuxt)

From the repo root, once: `cp .env.example .env`.

```bash
docker compose up -d db                  # Postgres on 127.0.0.1:5433
docker compose run --rm dbmate up        # apply db/migrations
(cd pipeline && uv run --env-file ../.env catalog load ../db/seed/film_cameras.sample.json)
cd web && pnpm install && pnpm dev       # http://localhost:3010
```

After a migration: `pnpm db:types` regenerates `shared/types/db/` from the live schema (kanel).

- `server/utils/catalog.ts` — all catalog SQL (postgres.js, no ORM).
- `shared/catalog.ts` — API types, sections (`/cameras` → `film_cameras`), URLs, image thumbnails.
- `shared/film-cameras.ts` — how camera attributes read on the page.

## Staff

Give yourself the admin role once you have signed up: `pnpm grant-role <username> admin`
(or `moderator`). The admin panel is at `/admin`: photo queue, reports, users, rarity thresholds.
