# Ideja in ciljna skupina

## Ideja

Prijava komunalnih okvar v mestu (udarne jame, pokvarjene svetilke, grafiti, ilegalna
odlagališča, poškodovani znaki) je danes v večini občin mogoča samo prek telefonskega
klica, e-pošte ali spletnih obrazcev, ki zahtevajo stalno internetno povezavo. To pomeni,
da večina prijav propade ali se nikoli ne zgodi — posebej takrat, ko je okvaro najlažje
opaziti: med hojo, kolesarjenjem ali vožnjo, ko internet ni zanesljivo dostopen.

**PrijaviMesto** (kodna oznaka: FieldFix) je progresivna spletna aplikacija (PWA), ki to
rešuje:

- Prijavo je mogoče oddati **brez spletne povezave** — shrani se v IndexedDB in samodejno
  pošlje, ko se omrežje vzpostavi (Background Sync API).
- Fotografijo okvare posnamemo neposredno iz kamere naprave, koordinate pridobi GPS,
  naslov pa avtomatično poišče Nominatim (obratno geokodiranje).
- Administracija (komunalno podjetje, občina) sledi statusu prijave prek istega vmesnika
  in pošlje potisno obvestilo (Web Push), ko se status spremeni.
- Aplikacija deluje na vseh napravah in operacijskih sistemih brez namestitve iz trgovine.

## Ciljna skupina

### Primarni uporabniki — občani

- Starost: 18–65 let, vse vrste mobilnih naprav (Android, iOS)
- Cilj: hitro in enostavno prijaviti opaženo okvaro v svojem okolišu
- Kontekst rabe: na terenu, med hojo ali vožnjo, pogosto brez stabilnega omrežja
- Potreba: takojšnja potrditev, da je prijava bila sprejeta, in kasnejše obvestilo o rešitvi

### Sekundarni uporabniki — komunalni delavci / administratorji

- Dostop prek admin žetona
- Pregled vseh prijav na karti in v seznamu, filtriranje po statusu in področju
- Sprememba statusa prijave (`submitted → in_review → resolved | rejected`) z opombo
- Samodejno potisno obvestilo prijavitelju ob vsaki spremembi statusa

### Zakaj PWA in ne nativna aplikacija?

| Dejavnik | PWA | Nativna aplikacija |
|----------|-----|-------------------|
| Namestitev | Brez trgovine (dodaj na začetni zaslon) | App Store / Play Store |
| Posodobitve | Samodejno prek Service Workerja | Ročno ali avtomatično prek trgovine |
| Razvoj | En kodni osnovi za vse platforme | iOS + Android ločeno |
| Dostopnost | Takoj dostopna prek URL-ja | Zahteva predhodno namestitev |
| Brez povezave | Background Sync + IndexedDB | Posebna implementacija |
| Potisna obvestila | Web Push API (VAPID) | FCM / APNs |

PWA je za ta projekt optimalna izbira: ob nizki kompleksnosti razvoja zagotavlja vse
ključne funkcionalnosti nativnih aplikacij, hkrati pa je dostopna vsem uporabnikom brez
ovir pri namestitvi.
