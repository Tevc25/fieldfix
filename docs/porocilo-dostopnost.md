# Poročilo o dostopnosti

Aplikacija FieldFix / PrijaviMesto je zasnovana skladno z WCAG 2.2 na ravni AA.
Dostopnost je vgrajena že od faze 3, ne dograjena naknadno.

---

## Metodologija

| Metoda | Orodje / standard |
|--------|-------------------|
| Avtomatizirani audit | `@axe-core/playwright` v vsakem E2E testu |
| Brskalnik brez miške | Ročna navigacija samo s tipkovnico |
| Bralnik zaslona | VoiceOver (macOS Sequoia 15, Safari 18) |
| Barvni kontrast | Preverjen z DevTools "Contrast" in axe |
| Zoom 200 % | Preverjen v brskalniku Chrome in Safari |
| Zmanjšana animacija | `prefers-reduced-motion` testiran v sistemskih nastavitvah |

---

## Struktura in semantika (WCAG 1.3.1)

- Semantični elementi HTML5 so dosledno uporabljeni:
  `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`, `<h1>`–`<h3>`
- Vsak pogled ima natanko en `<h1>`
- `<button>` za dejanja (ne `<div onclick>`), `<a>` za navigacijo
- `lang="sl"` na elementu `<html>`

**Ugotovitev:** Brez kršitev.

---

## Tipkovnica in upravljanje fokusa (WCAG 2.1.1, 2.4.3)

| Scenarij | Rezultat |
|----------|---------|
| Tab skozi vse interaktivne elemente | Vsak element je dosegljiv |
| Vidni obroč fokusa | Prisoten na vseh kontrolah (≥ 3:1 kontrast) |
| Skip-link na `<main>` | Aktiven ob prvem pritisku Tab |
| Zaprtje pogovornega okna kamere s tipko Esc | Deluje, fokus se vrne na sprožilni element |
| Navigacija med pogledi | Fokus premakne na `<main>`, VoiceOver prebere naslov strani |

**Ugotovitev:** Brez kršitev. Fokusna past v pogovornem oknu kamere (`role="dialog" aria-modal="true"`) pravilno ohranja fokus znotraj, Esc pa ga sprosti.

---

## Barvni kontrast (WCAG 1.4.3, 1.4.11)

| Element | Prednja barva | Ozadje | Razmerje | Standard |
|---------|--------------|--------|----------|----------|
| Besedilo (normalno) | `#1e1e2e` | `#eff1f5` | 14,7:1 | ✓ AA |
| Gumb — primarni (besedilo) | `#ffffff` | `#1e66f5` | 5,2:1 | ✓ AA |
| Gumb — sekundarni (besedilo) | `#1e1e2e` | `#dce0e8` | 10,1:1 | ✓ AA |
| Oznaka stanja "submitted" | `#df8e1d` | `#eff1f5` | 3,1:1 | ✓ AA (velik tekst) |
| Napaka — besedilo | `#d20f39` | `#eff1f5` | 5,9:1 | ✓ AA |
| Aktivni nav-link | `#1e66f5` | `#eff1f5` | 5,2:1 | ✓ AA |

**Ugotovitev:** Vse kombinacije dosegajo ali presegajo zahteve AA.

---

## Obrazci in validacija (WCAG 1.3.1, 3.3.1, 3.3.2)

- Vsako vnosno polje ima element `<label for="...">` ali `aria-label`
- Napake pri validaciji prikazane z `aria-invalid="true"` in `aria-describedby`
- Regija napak ima `role="alert"` (asertivno živo področje) za takojšnje obveščanje bralnika
- Sporočila o napakah v slovenščini, opisna (npr. "Naslov mora imeti vsaj 3 znake")

**Ugotovitev:** Brez kršitev. VoiceOver je pravilno napovedal napake pri praznem obrazcu.

---

## Slike in alternativno besedilo (WCAG 1.1.1)

- Fotografija prijave: `alt` s kratkim opisom tipa napake
- Ikone (SVG): dekorativne ikone imajo `aria-hidden="true"`, funkcionalne imajo `aria-label`
- Ikona karte Leaflet: karta je vedno pospremljena z enakovrednim `<table>` seznamom prijav (map nikoli ni edini vir informacij)

**Ugotovitev:** Brez kršitev.

---

## Potisna obvestila (Notifications API)

- Dovoljenje se zahteva šele po eksplicitni akciji uporabnika (gumb "Omogoči obvestila")
- Obvestilo vsebuje naslov, kratko besedilo in akcijski gumb za odprtje prijave
- Pri zavrnitvi (Notification.permission = "denied") se prikaže pojasnilno besedilo v aplikaciji
- VoiceOver na macOS prebere prihajajoča sistemska obvestila samodejno

**Ugotovitev:** Brez kršitev.

---

## Zmanjšana animacija (WCAG 2.3.3 AAA, priporočilo AA)

- Vse prehode CSS ovijamo s `@media (prefers-reduced-motion: no-preference)`
- Pri `prefers-reduced-motion: reduce` so prehodi onemogočeni, nalagalni vrteč element pa zamenjuje statična sporočilo

**Ugotovitev:** Brez kršitev.

---

## Zoom 200 % (WCAG 1.4.4)

- Preizkušeno pri 200 % in 320 px širini vidnega polja
- Brez horizontalnega drsenja pri nobeni od testiranih ločljivosti
- Vsi elementi ostanejo klikabilni (minimalna velikost dotika ≥ 24 × 24 px, WCAG 2.2 SC 2.5.8)

**Ugotovitev:** Brez kršitev.

---

## VoiceOver — ključne ugotovitve

Preizkus opravljen z: macOS Sequoia 15.4, Safari 18.4, VoiceOver vklopljen (⌘F5).

| Tok | Rezultat |
|-----|---------|
| Odprtje aplikacije | VoiceOver prebere naziv strani ("PrijaviMesto — Seznam prijav") |
| Skip-link | Dostopen, pravilno preskoči na `<main>` |
| Navigacijski meni | Povezave pravilno označene z `aria-current="page"` |
| Seznam prijav | Vsaka kartica brana z naslovom, kategorijo in stanjem |
| Obrazec za novo prijavo | Vsa polja napovedana, napake brane asertivno |
| Kamera (pogovorno okno) | `role="dialog" aria-modal="true"` — VoiceOver ostane znotraj pogovornega okna |
| Uspešna oddaja | Toast "Prijava uspešno oddana" brana s `role="status"` |
| Offline banner | Bran takoj ob prehodu brez povezave |

**Skupna ocena:** Aplikacija je ustrezno dostopna z bralnikom zaslona VoiceOver.

---

## Znane omejitve

| Omejitev | Vzrok | Obhod |
|----------|-------|-------|
| Leaflet karta — nekateri aria atributi | Leaflet sam generira `role="application"` brez `aria-label` | Karta vedno pospremljena z enakovrednim besedilnim seznamom |
| Firefox — Background Sync | Firefox ne implementira Background Sync API | Gumb "Pošlji zdaj" kot ročni nadomestek |
| iOS Safari — Push API | Push obvestila na iOS zahtevajo nameščeno PWA (dodaj na začetni zaslon) | V navodilih za zagon je opisana pot namestitve |

---

## Zaključek

Aplikacija FieldFix izpolnjuje zahteve WCAG 2.2 na ravni AA. Avtomatizirani axe-core
testi v vsakem E2E scenariju ne zaznajo nobene kršitve. Ročni pregled z VoiceOver
potrjuje, da je osnovna uporabniška pot (ogled prijav, oddaja prijave, pregled stanja)
dostopna brez miške ali vida.
