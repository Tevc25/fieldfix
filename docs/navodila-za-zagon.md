# Navodila za zagon

## Zahteve

| Orodje  | Različica | Namen                                    |
| ------- | --------- | ---------------------------------------- |
| Node.js | ≥ 22 LTS  | Produkcijski strežnik in razvojna orodja |
| pnpm    | ≥ 9       | Upravljanje paketov (workspace)          |
| Bun     | ≥ 1.1     | Strežniška varianta B (neobvezno)        |
| Deno    | ≥ 2.0     | Strežniška varianta C (neobvezno)        |
| k6      | ≥ 0.55    | Obremenilni testi (neobvezno)            |

## Hitra namestitev

```bash
git clone https://github.com/<username>/fieldfix.git
cd fieldfix
pnpm install
pnpm --filter server-node dev   # strežnik na :3000
# v novem terminalu:
pnpm --filter client dev        # odjemalec na :5173
```

Odpri [http://localhost:5173](http://localhost:5173).

---

## Okolje in konfiguracija

```bash
cp server-node/.env.example server-node/.env
```

Privzete vrednosti za razvoj (`server-node/.env`):

```env
PORT=3000
ADMIN_TOKEN=dev-admin-token-fieldfix
# VAPID ključi — izpusti za samodejno efemerično generiranje
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com
DB_PATH=./fieldfix.db
```

> Za produkcijo generiraj stalne VAPID ključe:
>
> ```bash
> node -e "const wp=require('web-push'); console.log(JSON.stringify(wp.generateVAPIDKeys(),null,2));"
> ```

---

## Posamezne komponente

### Node/Fastify (port 3000)

```bash
pnpm --filter server-node dev      # razvoj (tsx hot-reload)
pnpm --filter server-node test     # 32 enot/integracijskih testov
```

### Bun/Elysia (port 3001)

```bash
cd server-bun && bun install && bun dev
```

### Deno/Hono (port 3002)

```bash
cd server-deno && deno task dev
```

### PWA odjemalec

```bash
pnpm --filter client dev           # razvojni strežnik :5173
pnpm --filter client build         # produkcijska gradnja → client/dist/
pnpm --filter client preview       # predogled :4173
pnpm --filter client test          # 29 enot testov (Vitest)
pnpm --filter client test:e2e      # Playwright E2E + axe-core
pnpm --filter client typecheck     # TypeScript preverjanje
```

> Pred E2E: `pnpm --filter client exec playwright install chromium`

---

## Obremenilni testi (k6)

```bash
# strežniki morajo teči
BASE_URL=http://localhost:3000 VARIANT=node k6 run benchmarks/k6/reports-scenario.js
BASE_URL=http://localhost:3001 VARIANT=bun  k6 run benchmarks/k6/reports-scenario.js
```

Rezultati → `benchmarks/results/k6-{VARIANT}.json`

```bash
python3 benchmarks/generate-charts.py   # grafikoni → benchmarks/results/chart-*.png
```

---

## Produkcijska postavitev

```
[Nginx]  →  [client/dist/]  (statični files)
         →  proxy /api/ in /uploads/ → Node/Fastify :3000
```

HTTPS je obvezna zahteva za Service Worker, Push API, Geolocation API in kamero.

---

## Namestitev PWA na napravo

1. Odpri v Chromu ali Safariju
2. **Chrome**: klikni ikono "Namesti" v naslovni vrstici
3. **Safari / iOS**: Deli → Dodaj na začetni zaslon
4. Aplikacija deluje brez povezave po prvi namestitvi
