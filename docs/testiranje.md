# Testiranje

Projekt FieldFix pokriva pet ravni testiranja: enote (unit), integracija, end-to-end (E2E),
obremenilni testi in ročni pregled z bralniki zaslona.

---

## 1. Enotni testi (Vitest)

### Strežnik — `server-node/tests/`

Ogrodje: **Vitest 2.x**, okolje `node`, serijska izvedba (`singleFork`) za varnost SQLite.

| Datoteka | Pokritost | Opis |
|----------|-----------|------|
| `health.test.ts` | GET /api/health | Preverja zdravstveni odgovor in strukturo JSON |
| `reports.test.ts` | POST / GET / GET:id / PATCH | Polni CRUD ciklus, idempotentnost `clientId`, validacija vhodnih polj, prehodi statusov, avtorizacija admin žetona |
| `subscriptions.test.ts` | POST / DELETE /api/subscriptions | Registracija in brisanje potisnih naročnin, idempotentnost |
| `schemas.test.ts` | Zod sheme | Robni primeri: UUID, koordinate, dolžine nizov, kategorije |

**Skupaj:** 32 testov, 100 % uspešnih.

### Odjemalec — `client/tests/unit/`

Ogrodje: **Vitest 2.x**, okolje `node`, lažna IndexedDB z `fake-indexeddb`.

| Datoteka | Pokritost | Opis |
|----------|-----------|------|
| `nominatim.test.ts` | `roundCoord`, `cacheKey` | Zaokroževanje koordinat na 3 decimalna mesta (~111 m natančnost), deterministični ključi predpomnilnika, negativne koordinate, robni primeri |
| `camera.test.ts` | `computeResize` | Skaliranje fotografij: zmanjšanje pri >1600 px, ohranitev razmerja stranic, celi piksli, pokrajinska / portretna / kvadratna orientacija |
| `status-fsm.test.ts` | avtomat stanj | Vse veljavne prehode: `submitted→in_review`, `in_review→resolved|rejected`; vse neveljavne prehode; terminalna stanja; samozanke |
| `queue.test.ts` | IndexedDB vrsta | Enqueue, dequeue, idempotentni put, getPending, getAllPending, countPending |

**Skupaj:** 29 testov, 100 % uspešnih.

---

## 2. End-to-end testi (Playwright + axe-core)

### Konfiguracija

- **Ogrodje:** Playwright 1.49+, brskalnik Chromium
- **Strežnik:** `vite preview` (dist mapa, vgrajen proxy)
- **API:** vsi klici `/api/**` prestreženi z `page.route()` — testi ne zahtevajo delujočega strežnika
- **Datoteke:** `client/tests/e2e/`

### `navigation.spec.ts` — navigacija in dostopnost

| Test | Opis |
|------|------|
| Naslov strani | `<title>` vsebuje "PrijaviMesto" |
| Landmark `<main>` | Element je viden |
| Skip-link | Ob prvem Tab dobimo fokus na `href="#main"` |
| axe — seznam prijav | 0 kršitev WCAG (izjema: Leaflet map, znana omejitev knjižnice) |
| axe — obrazec `/new` | 0 kršitev WCAG |
| axe — podrobnosti prijave | 0 kršitev WCAG |
| Stran 404 | Aplikacija ne sesuje, prikaže sporočilo v slovenščini |

### `reports.spec.ts` — tok prijav in brez povezave

| Test | Opis |
|------|------|
| Obrazec na `/new` | Viden element `<form>` |
| Označena vhodna polja | Vsako polje ima `<label>`, `aria-label` ali `aria-labelledby` |
| Brskalnik brez povezave | App shell ostane viden po `context.setOffline(true)` |
| Obrazec brez povezave | `/new` se prikaže brez omrežja |
| Gumb za ročno sinhronizacijo | Prisoten element `role="button"` z besedilom "Pošlji" ali "Submit" |
| Prikaz prijav iz API | Prijavna kartica z naslovom se prikaže po odgovoru iz lažnega API |

### Zagon E2E testov lokalno

```bash
cd fieldfix
pnpm build          # zgradi odjemalca v client/dist/
pnpm --filter client exec playwright install chromium
pnpm --filter client test:e2e
```

---

## 3. Obremenilni testi (k6)

Podrobnosti so v [streznik-primerjava.md](streznik-primerjava.md) in `benchmarks/k6/reports-scenario.js`.

| Parameter | Vrednost |
|-----------|---------|
| Orodje | k6 v0.55+ |
| VU | 100 |
| Trajanje | 60 s |
| Mešanica | 80 % GET, 15 % POST, 5 % PATCH |
| Cilj p95 | < 500 ms |

Rezultati:

| Varianta | req/s | p95 |
|----------|-------|-----|
| Node/Fastify | 7 785 | 11,8 ms |
| Bun/Elysia | 7 658 | 12,9 ms |
| Deno/Hono | ni merjeno | — |

---

## 4. Lighthouse CI

Konfiguracija: `.lighthouserc.json`

| Kategorija | Cilj | Status |
|------------|------|--------|
| PWA | ≥ 100 | ✓ konfiguriran v CI |
| Zmogljivost | ≥ 90 | ✓ konfiguriran v CI |
| Dostopnost | ≥ 95 | ✓ konfiguriran v CI |
| Najboljše prakse | ≥ 95 | ✓ konfiguriran v CI |

CI opravilo `lighthouse-ci` se zažene po uspešni gradnji artefakta (`.github/workflows/ci.yml`).

---

## 5. Ročni pregled z bralniki zaslona

Povzetek je v [porocilo-dostopnost.md](porocilo-dostopnost.md).

- **VoiceOver** (macOS Sequoia, Safari) — preizkušeno na vseh glavnih pogledih
- **Keyboard-only** navigacija — vse interaktivne kontrole dosegljive s tipkovnico

---

## 6. Zvezna integracija (GitHub Actions)

Potek (`.github/workflows/ci.yml`):

```
push/PR → lint-typecheck
              ├── unit-tests       (pnpm --filter client test + server-node test)
              ├── build            → artefakt client/dist/
              │        ├── e2e-tests     (playwright test)
              │        └── lighthouse-ci (lhci autorun)
              └── (vzporedno z ostalimi)
```
