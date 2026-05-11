# Sodobni spletni API-ji — PrijaviMesto

Dokument opisuje implementacijo in razloge za izbiro vsakega sodobnega spletnega API-ja, ki ga aplikacija PrijaviMesto uporablja. Vsak API je zaščiten z zaznavo funkcije (feature detection) in varne rezerve (graceful degradation).

---

## 1. Geolocation API

**Modul:** `client/src/geo/geolocation.ts`  
**Standardna specifikacija:** W3C Geolocation API

Funkcija `requestPosition()` zahteva GPS koordinate naprave s parametri:

- `enableHighAccuracy: true` — maksimalna natančnost (GPS namesto WiFi trilateration)
- `timeout: 10000` — 10 sekund čakanja
- `maximumAge: 0` — vedno sveža meritev

Zamenjuje inline logiko v obrazcu in vrača urejen `Promise<GeoPosition>` z lokalizi ranimi sporočili za vsak kode napake (1 = zavrnjeno dovoljenje, 2 = nedostopna lokacija, 3 = časovna omejitev).

**Zaznava funkcije:** `'geolocation' in navigator`  
**Rezerva:** ročni vnos koordinat v polji Zemljepisna širina / dolžina

---

## 2. Nominatim — obratno geokodiranje (Open API)

**Modul:** `client/src/geo/nominatim.ts`  
**API:** `nominatim.openstreetmap.org` (brezplačen, OpenStreetMap)

Ko uporabnik pridobi GPS lokacijo, aplikacija samodejno pokliče Nominatim in izpolni polje Naslov. Implementacija upošteva:

- **Predpomnjenje:** koordinate zaokrožene na 3 decimalna mesta (~111 m natančnost), rezultat shranjen v `Map<string, string>` za ves čas seje. Enak odziv za isto področje se nikoli ne pošlje dvakrat.
- **Omejitev hitrosti:** čakanje 1 sekunde med zahtevki (`waitForThrottle()`), skladno z Nominatim-ovimi pogoji uporabe.
- **User-Agent:** glava `User-Agent: PrijaviMesto/1.0` identificira aplikacijo, kot zahtevajo pogoji API-ja.
- **SW integracija:** Workbox CacheFirst (30 dni) predpomni Nominatim odgovore v SW za brezpovezavno delovanje.

**Zaznava funkcije:** ni posebne zaznave — `fetch` je vedno na voljo  
**Rezerva:** polje ostane prazno; uporabnik ga izpolni ročno

---

## 3. Media Capture and Streams API + Canvas API

**Modul:** `client/src/media/camera.ts`  
**Standardna specifikacija:** W3C Media Capture and Streams, HTML Canvas API

Funkcija `captureFromCamera()` odpre polnoekranski pojavni zaslon z živim predogledom kamere in vrne WebP datoteko po zajemu:

1. `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })` — zahteva zadnjo kamero (primarna za terenske posnetke)
2. Video tok se prikaže v elementu `<video autoplay playsinline muted>`
3. Ob kliku "Zajemi fotografijo" se okvir nariše na `<canvas>` z zmanjšanjem:
   - Dolga stranica omejena na **1600 px** (prihranek pasovne širine za prenos)
   - Razmerje stranic ohranjeno
4. `canvas.toBlob('image/webp', 0.8)` izvozi sliko v formatu WebP pri 80% kakovosti
5. Tok kamere se ustavi (`stream.getTracks().forEach(t => t.stop())`)

**Dostopnost:** Overlay ima `role="dialog"` in `aria-modal="true"`; tipka Escape zapre pogled; fokus se vrne na sprožilni element.

**Zaznava funkcije:** `'mediaDevices' in navigator && typeof navigator.mediaDevices.getUserMedia === 'function'`  
**Rezerva:** gumb "Fotografiraj" se skrije; uporabnik naloži datoteko z vhodnim elementom tipa `file`

---

## 4. Notifications API + Web Push

**Modul:** `client/src/push/subscription.ts`  
**SW handler:** `client/src/sw.ts` (`push`, `notificationclick` eventi)

Aplikacija zahteva dovoljenje za potisna obvestila prek `Notification.requestPermission()`. Ob odobritvi se naprava registrira v Push Service z VAPID ključem strežnika:

```
PushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey })
```

Ko strežnik posodobi status prijave, pošlje potisno sporočilo vsem registriranim napravam. Storitveni delavec prikaže:

- Naslov: "PrijaviMesto — Status posodobljen"
- Besedilo: lokaliziran naziv novega statusa in morebitna opomba skrbnika
- Gumb akcije: "Odpri prijavo" (odpre `/prijava/:id`)

**Trije možni stati:**

- `default` — gumb "Vklopi obvestila o statusu"
- `granted` — obvestila so vklopljena, gumb "Izklopi"
- `denied` — obvestila blokirana v brskalniku (navodilo za odblokiranje)

**Zaznava funkcije:** `'PushManager' in window && 'Notification' in window`  
**Rezerva:** UI panel prikaže sporočilo o neuspešni podpori ali blokiranem dovoljenju

---

## 5. Background Sync API

**SW handler:** `client/src/sw.ts` (`sync` event, tag `report-submit`)  
**Registracija:** `client/src/components/report-form.ts`

Ko oddaja prijave ne uspe zaradi odsotnosti omrežja, se zahtevek shrani v IndexedDB čakalno vrsto in registrira sinhronizacijska oznaka:

```javascript
registration.sync.register('report-submit');
```

Ko operacijski sistem zazna obnovljeno povezavo, sproži `sync` event v storitvenem delavcu. Ta prebere vse čakajoče vnose iz IndexedDB, zgradi FormData in jih nato pošlje na `/api/reports`. Strežnik je idempotenten (vrne 200 za podvojen `clientId`), kar zagotavlja varno ponavljanje.

**Firefox / Safari rezerva (Pošlji zdaj):** gumb v panelu (komponenta `push-panel.ts`) izvede isto logiko neposredno iz glavne niti, brez zanašanja na Background Sync.

**Zaznava funkcije:** `'sync' in ServiceWorkerRegistration.prototype`  
**Rezerva:** ročni gumb "Pošlji zdaj" v panelu

---

## 6. Network Information API

**Integracija:** `client/src/components/report-list.ts`  
**Standardna specifikacija:** W3C Network Information API (eksperimentalen)

Ob nalaganju seznama prijav se preveri `navigator.connection.effectiveType`. Na počasnih povezavah (`slow-2g`, `2g`) se:

- Prikaže opozorilni pas z besedilom o zaznani počasni povezavi
- Leaflet karta se **ne inicializira** (prihrani do ~2 MB podatkov za ploščice)
- Tabela s prijavami se prikaže normalno

Aplikacija posluša tudi `change` event na `navigator.connection` za dinamično prilagajanje.

**Zaznava funkcije:** `'connection' in navigator`  
**Rezerva:** karta se vedno prikaže (brez razlikovanja hitrosti)

---

## 7. Web Share API

**Integracija:** `client/src/components/report-detail.ts`

Na strani s podrobnostmi prijave se prikaže gumb "Deli prijavo" (samo ko je API na voljo). Klic:

```javascript
navigator.share({ title: report.title, url: shareUrl });
```

odpre nativni meni za deljenje operacijskega sistema (sporočila, e-pošta, socialna omrežja).

**Zaznava funkcije:** `'share' in navigator`  
**Rezerva:** gumb ni prikazan; URL je viden v naslovni vrstici brskalnika

---

## 8. Vibration API

**Integracija:** `client/src/components/report-form.ts`

Po uspešni pridobitvi GPS koordinat in po uspešni oddaji prijave se sproži kratka vibracija:

```javascript
if ('vibrate' in navigator) navigator.vibrate(50);
```

50 ms zagotavlja taktilno potrditev brez moteče daljše vibracije.

**Zaznava funkcije:** `'vibrate' in navigator`  
**Rezerva:** tiho (brez vibracije)

---

## 9. Badge API

**Integracija:** `client/src/main.ts`  
**Standardna specifikacija:** W3C Badging API

Ko ima aplikacija čakajoče prijave v IndexedDB (še neposlane), se na ikoni nameščene PWA prikaže številčna oznaka:

```javascript
navigator.setAppBadge(pendingCount); // ali
navigator.clearAppBadge(); // ko čakalnica je prazna
```

Oznaka se posodobi ob zagonu in po vsakem uspešno sinhroniziranemu poročilu.

**Zaznava funkcije:** `'setAppBadge' in navigator`  
**Rezerva:** brez oznake (vidno le v nameščenih PWA)

---

## 10. Clipboard API

**Integracija:** `client/src/components/report-detail.ts`

Gumb "Kopiraj ID" na strani s podrobnostmi prijave pokliče:

```javascript
await navigator.clipboard.writeText(report.id);
```

Ob uspehu se prikaže potrditveni toast; ob napaki (zavrnitev dovoljenja ali brskalnik brez podpore) se prikaže napaka.

**Zaznava funkcije:** vgrajena v `try/catch`  
**Rezerva:** napaka se prikaže uporabniku

---

## Povzetek — implementiranih API-jev

| API                    | Modul                      | Zaznava   | Rezerva           |
| ---------------------- | -------------------------- | --------- | ----------------- |
| Geolocation            | `geo/geolocation.ts`       | ✅        | Ročni vnos        |
| Nominatim (geocoding)  | `geo/nominatim.ts`         | N/A       | Prazno polje      |
| Media Capture + Canvas | `media/camera.ts`          | ✅        | File input        |
| Notifications + Push   | `push/subscription.ts`     | ✅        | Brez obvestil     |
| Background Sync        | `sw.ts` + `report-form.ts` | ✅        | "Pošlji zdaj"     |
| Network Information    | `report-list.ts`           | ✅        | Karta vedno vidna |
| Web Share              | `report-detail.ts`         | ✅        | Brez gumba        |
| Vibration              | `report-form.ts`           | ✅        | Brez vibracije    |
| Badge                  | `main.ts`                  | ✅        | Brez oznake       |
| Clipboard              | `report-detail.ts`         | try/catch | Toast napaka      |
