# Prezentacijski scenarij — PrijaviMesto / FieldFix

**Predmet:** Spletne tehnologije, FERI Maribor, prof. dr. Boštjan Šumak  
**Čas:** 10 minut  
**Datum:** 9. 6. 2026 ali 11. 6. 2026

---

## Priprava pred prezentacijo

- [ ] Zaženi Node/Fastify strežnik: `pnpm --filter server-node dev`
- [ ] Zaženi odjemalca: `pnpm --filter client dev` → odpri [http://localhost:5173](http://localhost:5173)
- [ ] V DevTools → Application → Service Workers preveri, da je SW registriran
- [ ] Odpri DevTools → Network → nastavi "Slow 3G" za offline demo
- [ ] Pripravi DevTools → Lighthouse za live audit
- [ ] Odpri [http://localhost:5173](http://localhost:5173) v Chromu (ne inkognito, da je SW aktiven)

---

## 0:00 – 0:45 | Uvod in ideja (slide 3)

> *"Živimo v pametnih mestih, pa so komunalne okvare prijavljene s klicem na telefonsko številko ali z emailom. PrijaviMesto to reši."*

**Pokaži:** Odpri aplikacijo. Pokaži seznam prijav z markerji na karti Maribora.

**Ključne točke:**
- Aplikacija deluje brez namestitve iz trgovine — to je PWA
- Deluje brez interneta — prijava se shrani lokalno
- Ciljna skupina: vsi občani + komunalni delavci

---

## 0:45 – 2:30 | PWA osnove (slide 3)

**Pokaži v brskalniku:**
1. Klikni ikono "Namesti" v naslovni vrstici Chrome → pokaži install prompt
2. Odpri DevTools → Application → Manifest → pokaži `name`, `lang: sl`, `display: standalone`, ikone
3. Application → Service Workers → pokaži, da je SW registriran in aktiven
4. Application → Cache Storage → pokaži predpomnjene datoteke (app shell)

**Povej:**
- Manifest definira, kako aplikacija izgleda, ko je nameščena
- `display: standalone` — brez brskalniških gumbov, kot nativna aplikacija
- Ikone v treh velikostih, vključno z maskable (Android adaptive icons)

---

## 2:30 – 4:30 | Service Worker in strategije predpomnjenja (slide 5–6)

**Pokaži v kodi** (`client/src/sw.ts`):

> *"Service Worker je ključni element PWA. Vsak tip resursa ima svojo strategijo."*

| Resurs | Strategija | Zakaj |
|--------|-----------|-------|
| App shell | CacheFirst + precache | Takojšen zagon, posodobitev ob novem SW |
| OSM ploščice | StaleWhileRevalidate | Sveže, a brez čakanja |
| GET /api/reports | NetworkFirst | Sveže ko online, zadnje znano ko offline |
| POST /api/reports | NetworkOnly + Background Sync | Mora biti poslano |
| Nominatim | CacheFirst 30 dni | Isti GPS → isti naslov |

**Pokaži offline:**
1. DevTools → Network → "Offline"
2. Osveži stran — app shell se naloži iz predpomnilnika
3. Odpri `/new` — obrazec je dosegljiv brez interneta
4. Pokaži `offline.html` fallback za nepredpomnjene navigacije

---

## 4:30 – 5:45 | Background Sync + Push obvestila (slide 7)

**Demo Background Sync:**
1. Ostani v "Offline" načinu
2. Izpolni obrazec (ime okvare, kategorija, GPS koordinate)
3. Pritisni "Oddaj prijavo" — aplikacija pokaže potrditev, da je shranjena
4. DevTools → Application → IndexedDB → `fieldfix` → `pending-reports` → pokaži shranjeno prijavo
5. Preklopi na "Online" → Application → Background Sync → klikni "Sync" ali počakaj
6. Prijava izgine iz IndexedDB — je bila poslana

**Povej:**
- Firefox ne podpira Background Sync → gumb "Pošlji zdaj" kot ročni nadomestek
- `sync` event se sproži ob vzpostavitvi omrežja, tudi če je brskalnik zaprt

**Demo Push obvestila:**
1. Klikni "Omogoči obvestila" v aplikaciji → pokaži permission dialog
2. V drugi zavihku pošlji PATCH na strežnik (sprememba statusa):
   ```bash
   curl -X PATCH http://localhost:3000/api/reports/<id>/status \
     -H "Content-Type: application/json" \
     -H "X-Admin-Token: dev-admin-token-fieldfix" \
     -d '{"status":"in_review","note":"Prejelik in pregledujemo."}'
   ```
3. Pokaži potisno obvestilo z gumbom "Odpri prijavo"

---

## 5:45 – 7:00 | Sodobni spletni API-ji (slide 8)

**Pokaži živo:**

1. **Geolocation API** — "Ugotovi lokacijo" → brskalnik zaprosi za dovoljenje → koordinate se vpišejo samodejno, naslov pridobi Nominatim
2. **Media Capture + Canvas API** — "Fotografiraj" → kamera se odpre → zajemi fotografijo → pokaži, da je slika zmanjšana na max 1600 px (Canvas)
3. **Web Share API** — na karti klikni na prijavo → "Deli" → sistemski dialog za deljenje
4. **Vibration API** — ob uspešni oddaji (50 ms vibration, subtilno)
5. **Badge API** — pokaži, da se badge na ikoni posodobi pri novih statusnih posodobitvah
6. **Clipboard API** — "Kopiraj ID prijave"
7. **Network Information API** — DevTools → pojasni, da pri `slow-2g` aplikacija opozori in preskoči tile-e

**Povej:** Vsak API je zaščiten z `if ('share' in navigator)` — graceful degradation.

---

## 7:00 – 8:15 | Primerjava strežnikov (slide 9)

**Pokaži grafikone** (`benchmarks/results/`):

> *"Implementiral sem tri strežniške variante z enakimi API-ji. Rezultati so izmerjeni, ne opisni."*

- **Prepustnost:** Node 7 785 req/s ≈ Bun 7 658 req/s — praktično enako
- **Zakasnitev p95:** Node 11,8 ms vs Bun 12,9 ms — obadva pod 13 ms pri 100 VU
- **Pomnilnik:** Bun porabi 37 % manj RAM na vrhu obremenitve (145 MB vs 231 MB)
- **Zagon:** Bun 2,7× hitrejši (129 ms vs 354 ms)
- **LOC:** Bun/Elysia najkompaktnejši (393 vrstic), Node/Fastify 529

**Zaključek:** Za produkcijo Node/Fastify (zrelost ekosistema), za edge/serverless Deno/Hono.

---

## 8:15 – 9:15 | Testiranje in dostopnost (slide 10–11)

**Pokaži v terminalu:**
```bash
pnpm --filter server-node test   # 32 testov
pnpm --filter client test        # 29 testov
```

**Pokaži axe-core izhod** (iz Playwright HTML poročila):
> 0 accessibility violations na vsakem pogledu

**WCAG 2.2 AA — ključne točke:**
- Semantični HTML5, en `<h1>` na pogled
- Skip-link na `<main>` (pritisni Tab na začetku strani)
- Kontrast ≥ 4,5:1 za vse besedilo
- Fokusni obroč viden na vseh elementih
- Kamera overlay: `role="dialog" aria-modal="true"`, Esc zapre
- VoiceOver (macOS): pravilno prebere vse navigacijske elemente in napake pri validaciji

**Lighthouse CI** (`.lighthouserc.json`):
- PWA: 100, Zmogljivost: ≥ 90, Dostopnost: ≥ 95, Najboljše prakse: ≥ 95

---

## 9:15 – 10:00 | Zaključek in vprašanja

**Povzetek tega, kar smo prikazali:**

| Zahteva (slide) | Implementacija |
|-----------------|---------------|
| PWA osnove (3) | Manifest, SW, installable, offline, responsive |
| SW strategije (5–6) | 7 strategij, vsaka dokumentirana z razlogom |
| Background Sync + Push (7) | Offline vrsta → auto-sync, VAPID push |
| Sodobni API-ji (8) | 7 API-jev, vsak z graceful degradation |
| Primerjava strežnikov (9) | 3 variante, izmerjene z k6, grafikoni |
| Testiranje (10) | Vitest 61 testov, Playwright E2E, axe-core |
| Dostopnost (11) | WCAG 2.2 AA, VoiceOver preizkušeno |

> *"Aplikacija je dostopna na GitHubu. Hvala za pozornost — vprašanja?"*

---

## Rezerva / Backup teme (če je čas)

- Pokaži `deno.json` import map in razloži razliko med JSR in npm
- Pokaži `shared/openapi.yaml` in razloži, zakaj ena pogodba za tri strežnike
- Pokaži CI workflow na GitHubu (Actions → zadnji run)
- Razloži zakaj `CacheFirst` za Nominatim (1 req/s omejitev) in 30-dnevni TTL
