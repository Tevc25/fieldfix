export interface GeoPosition {
  lat: number;
  lng: number;
}

const GEO_ERROR_MESSAGES: Record<number, string> = {
  1: 'Dovoljenje za lokacijo je zavrnjeno. Vnesite koordinate ročno.',
  2: 'Lokacije ni mogoče določiti. Preverite GPS signal.',
  3: 'Časovna omejitev geolokacije. Poskusite znova.',
};

export function isGeolocationSupported(): boolean {
  return 'geolocation' in navigator;
}

export function requestPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error('Brskalnik ne podpira geolokacije. Vnesite koordinate ročno.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        const msg = GEO_ERROR_MESSAGES[err.code] ?? 'Napaka pri pridobivanju lokacije.';
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}
