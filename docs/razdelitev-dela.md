# Razdelitev dela

## Ekipa

| Član | Vloga | Glavni prispevki |
|------|-------|-----------------|
| Tevž Starovasnik | Vodja projekta, full-stack razvijalec | Celotna arhitektura, vsi strežniki, PWA odjemalec, SW, testi, dokumentacija |

## Porazdelitev nalog po fazah

| Faza | Opis | Izvajalec |
|------|------|-----------|
| 0 | Osnovna infrastruktura (pnpm workspace, TS, ESLint, CI) | Tevž |
| 1 | Skupna pogodba (OpenAPI, SQL shema, testni podatki) | Tevž |
| 2 | Node/Fastify strežnik z vsemi 9 API-ji, VAPID, testi | Tevž |
| 3 | PWA odjemalec — routing, obrazec, zemljevid, dostopnost | Tevž |
| 4 | Service Worker (Workbox, 7 strategij), offline fallback | Tevž |
| 5 | Background Sync, IndexedDB vrsta, Push obvestila | Tevž |
| 6 | Sodobni spletni API-ji (kamera, GPS, Clipboard, Share …) | Tevž |
| 7 | Bun/Elysia in Deno/Hono strežniški varianti | Tevž |
| 8 | Obremenilni testi, merjenje zagona, grafikoni, primerjava | Tevž |
| 9 | Vitest unit testi, Playwright E2E, axe-core | Tevž |
| 10 | Slovenska dokumentacija, README, Mermaid diagram | Tevž |
| 11 | Lighthouse CI, WCAG pregled, prezentacijski scenarij | Tevž |

## Tehnologije

### Strežnik
- **Node/Fastify 5**: REST API, SQLite (better-sqlite3), Web Push, Zod, multipart
- **Bun/Elysia 1.4**: zmogljivostna varianta B
- **Deno/Hono 4**: zmogljivostna varianta C

### Odjemalec
- **Vite 6 + TypeScript**: gradnja, ESM
- **Vanilla TS + Web Components + lit-html**: UI brez ogrodja
- **Workbox 7**: Service Worker s 7 strategijami predpomnjenja
- **idb**: IndexedDB vrsta za prijave brez povezave
- **Leaflet**: interaktivni zemljevid (OpenStreetMap)

### Infrastruktura
- **pnpm workspaces**: monorepo z 5 paketi
- **GitHub Actions**: CI (lint, typecheck, unit testi, E2E, Lighthouse CI)
- **k6**: obremenilni testi strežnikov
