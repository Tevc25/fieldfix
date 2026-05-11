# PWA zmožnosti — PrijaviMesto

Dokument opisuje vse strategije predpomnjenja in PWA funkcionalnosti, implementirane v storitveni delavec (`src/sw.ts`) s pomočjo knjižnice Workbox.

---

## 1. Predpomnjenje lupine aplikacije — `precacheAndRoute`

**Strategija:** Workbox Precaching  
**Predpomnilnik:** `workbox-precache-v2` (samodejno poimenovan)

Ob vsakem produktijskem gradnju Vite ustvari seznam vseh statičnih datotek (`*.html`, `*.js`, `*.css`, `*.png`, `*.svg`, `*.webmanifest`) z zgoščevalnimi vrednostmi (hashes). Workbox ta seznam (`self.__WB_MANIFEST`) vstavi v storitveni delavec in jih ob namestitvi predpomni.

**Zakaj ta strategija?**  
Statični viri se med delovno sejo ne spremenijo — vsaka nova postavitev dobi novo zgoščevalno vrednost v imenu datoteke. Predpomnjenje z verzioniranjem omogoča takojšnjo dostopnost brez omrežja in atomsko posodobitev celotne lupine naenkrat.

`cleanupOutdatedCaches()` samodejno počisti predpomnilnike prejšnjih verzij, kar prepreči kopičenje zastarelih datotek.

---

## 2. OSM ploščice — `StaleWhileRevalidate`

**Strategija:** StaleWhileRevalidate  
**Predpomnilnik:** `osm-tiles`  
**Omejitve:** 200 vnosov, 7 dni

Ploščice OpenStreetMap se postrežejo takoj iz predpomnilnika (brez zakasnitve), medtem ko se v ozadju asinhronično prenese svežja različica.

**Zakaj ta strategija?**  
Kartografske ploščice se redko spremenijo, a je takojšen prikaz karte kritičen za UX. StaleWhileRevalidate zagotavlja hitrost brez žrtvovanja svežosti. Omejitev 200 vnosov prepreči prekomerno rabo diska.

---

## 3. GET /api/reports — `NetworkFirst` (3 s)

**Strategija:** NetworkFirst z `networkTimeoutSeconds: 3`  
**Predpomnilnik:** `api-reports`  
**Omejitve:** 50 vnosov, 5 minut

Najprej poskusi omrežje; če v treh sekundah ni odgovora (ali ni povezave), vrne predpomnjeno različico.

**Zakaj ta strategija?**  
Seznam prijav mora biti čim bolj svež, saj se pogosto posodablja. Toda ko je uporabnik brez povezave, je ključno, da vidi zadnje znane podatke namesto praznega zaslona. Tri-sekundni časovni limit prepreči dolgo čakanje na počasnih omrežjih.

---

## 4. POST /api/reports — `NetworkOnly`

**Strategija:** NetworkOnly  
**Predpomnilnik:** ni

Zahtevki za oddajo prijav gredo vedno neposredno na strežnik. Predpomnjenje POST zahtevkov ni varno (nevarnost podvajanja).

**Zakaj ta strategija?**  
Ustvarjanje virov mora biti eksplicitno in sledljivo. Preden se zahtevek pošlje, se prijava shrani v IndexedDB čakalno vrsto (Phase 5: Background Sync), ki poskrbi za zanesljivo dostavo ko omrežje postane dostopno.

---

## 5. Nominatim obratno geokodiranje — `CacheFirst` (30 dni)

**Strategija:** CacheFirst  
**Predpomnilnik:** `nominatim`  
**Omejitve:** 100 vnosov, 30 dni

Koordinate → naslov preslikave se postrežejo iz predpomnilnika; omrežje se pokliče le če vnos ni predpomljen.

**Zakaj ta strategija?**  
Geografske koordinate so stabilne — naslov istih GPS koordinat se ne bo spremenil. Dolg TTL (30 dni) drastično zmanjša število zahtevkov na Nominatim API (ki ima omejitve hitrosti) in deluje v celoti brez povezave.

---

## 6. Navigacijski zahtevki — `NetworkFirst` z offline rezervo

**Strategija:** NetworkFirst z `networkTimeoutSeconds: 5`  
**Predpomnilnik:** `navigations`  
**Rezerva:** predpomnjeni `index.html` → `offline.html`

Navigacije na vse poti aplikacije (`/`, `/prijavi`, `/prijava/:id`) se najprej poizkusijo pridobiti iz omrežja. Ob neuspehu `setCatchHandler` poskuša:

1. Predpomnjeni `index.html` (lupina SPA)
2. Statična stran `offline.html` z obvestilom o brezpovezavnem načinu

**Zakaj ta strategija?**  
SPA aplikacija za prikaz katerekoli strani potrebuje samo `index.html` — usmerjevalnik (`router.ts`) nato prikaže ustrezni pogled. Ob polni odsotnosti omrežja `offline.html` zagotavlja dostojanstveno izkušnjo namesto brskalnikove privzete napake.

---

## 7. Preostanek zahtevkov — `NetworkOnly`

**Strategija:** NetworkOnly (privzeti upravljalec)

Vse ostale zahteve (tuje domene, Analytics, CDN) gredo direktno na omrežje brez predpomnjenja.

**Zakaj ta strategija?**  
Predpomnjenje zunanjih virov brez natančnega nadzora povzroča težave s svežostjo in zasebnostjo. Boljše je, da te zahteve ali uspejo ali spodletijo transparentno.

---

## Preskok čakanja (skip-waiting)

Ko je nova verzija storitvenega delavca nameščena a čaka na aktivacijo, se v uporabnikovem vmesniku prikaže obvestilni trak (`#sw-update-banner`). Ko uporabnik klikne »Osveži«, glavna nit pošlje sporočilo `{ type: 'SKIP_WAITING' }`. Storitveni delavec sproži `self.skipWaiting()` in stran se samodejno znova naloži s svežo verzijo.

---

## Periodična sinhronizacija v ozadju

Storitveni delavec se registrira za opravilo `refresh-reports` z minimalnim intervalom 24 ur (Periodic Background Sync API). Ko operacijski sistem sproži sinhronizacijo, se svež seznam prijav prenese in shrani v predpomnilnik `api-reports`, kar zagotavlja ažurnost podatkov tudi brez odprtja aplikacije.

**Opomba:** Periodic Background Sync zahteva dodelitev dovoljenja s strani brskalnika in je trenutno podprt samo v Chromiu. Na Firefox in Safari se API tiho preskoči.

---

## Beleženje (BroadcastChannel)

Storitveni delavec pošilja diagnostična sporočila prek `BroadcastChannel('sw-log')`. Glavna nit jih posluša in izpisuje v konzolo z označbo `[SW]`. To omogoča opazovanje dogajanja v storitvenem delavcu brez odpiranja `chrome://inspect/#service-workers`.
