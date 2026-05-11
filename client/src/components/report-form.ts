import { html, render } from 'lit-html';
import { createReport, ApiError } from '../api/reports.ts';
import { enqueue, dequeue } from '../db/queue.ts';
import { showToast } from './toast-manager.ts';
import { navigate } from '../router.ts';
import type { ReportCategory } from '@fieldfix/shared';
import { requestPosition, isGeolocationSupported } from '../geo/geolocation.ts';
import { reverseGeocode } from '../geo/nominatim.ts';
import { captureFromCamera, isCameraSupported } from '../media/camera.ts';

interface FormState {
  clientId: string;
  title: string;
  category: ReportCategory | '';
  description: string;
  lat: string;
  lng: string;
  address: string;
  photo: File | null;
  submitting: boolean;
  errors: Partial<Record<keyof FormState | 'general', string>>;
  geoLoading: boolean;
}

const CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: 'pothole', label: 'Udarna jama' },
  { value: 'broken_streetlight', label: 'Pokvarjena ulična svetilka' },
  { value: 'graffiti', label: 'Grafiti' },
  { value: 'illegal_dumping', label: 'Ilegalno odlaganje odpadkov' },
  { value: 'damaged_sign', label: 'Poškodovana prometna signalizacija' },
  { value: 'other', label: 'Drugo' },
];

function generateClientId(): string {
  return crypto.randomUUID();
}

export function createReportFormView(): HTMLElement {
  const section = document.createElement('section');
  section.setAttribute('aria-labelledby', 'form-heading');
  section.className = 'report-form';

  const state: FormState = {
    clientId: generateClientId(),
    title: '',
    category: '',
    description: '',
    lat: '',
    lng: '',
    address: '',
    photo: null,
    submitting: false,
    errors: {},
    geoLoading: false,
  };

  // Set when Nominatim is auto-filling the address field
  let nominatimLoading = false;

  function update(patch: Partial<FormState>): void {
    Object.assign(state, patch);
    renderForm();
  }

  function setError(field: keyof FormState | 'general', msg: string): void {
    update({ errors: { ...state.errors, [field]: msg } });
  }

  function clearError(field: keyof FormState | 'general'): void {
    const errs = { ...state.errors };
    delete errs[field];
    update({ errors: errs });
  }

  function validate(): boolean {
    const errs: FormState['errors'] = {};
    if (!state.title.trim() || state.title.trim().length < 3)
      errs['title'] = 'Naslov mora vsebovati vsaj 3 znake.';
    if (!state.category) errs['category'] = 'Izberite kategorijo.';
    if (!state.description.trim() || state.description.trim().length < 10)
      errs['description'] = 'Opis mora vsebovati vsaj 10 znakov.';
    if (!state.lat || !state.lng || isNaN(Number(state.lat)) || isNaN(Number(state.lng)))
      errs['lat'] = 'Določite lokacijo s klikom na gumb ali ročnim vnosom.';
    update({ errors: errs });
    return Object.keys(errs).length === 0;
  }

  function handleGeolocate(): void {
    if (!isGeolocationSupported()) {
      setError('lat', 'Brskalnik ne podpira geolokacije. Vnesite koordinate ročno.');
      return;
    }
    update({ geoLoading: true });
    requestPosition()
      .then(({ lat, lng }) => {
        update({
          lat: lat.toFixed(6),
          lng: lng.toFixed(6),
          geoLoading: false,
          errors: { ...state.errors, lat: undefined },
        });
        if ('vibrate' in navigator) navigator.vibrate(50);

        // Auto-fill address from Nominatim (non-blocking)
        nominatimLoading = true;
        renderForm();
        reverseGeocode(lat, lng)
          .then((addr) => {
            nominatimLoading = false;
            if (addr && !state.address) {
              update({ address: addr });
            } else {
              renderForm();
            }
          })
          .catch(() => {
            nominatimLoading = false;
            renderForm();
          });
      })
      .catch((err: unknown) => {
        update({ geoLoading: false });
        setError('lat', err instanceof Error ? err.message : 'Napaka pri pridobivanju lokacije.');
      });
  }

  async function handleCameraCapture(): Promise<void> {
    const file = await captureFromCamera();
    if (!file) return;
    clearError('photo');
    update({ photo: file });
    const preview = section.querySelector<HTMLImageElement>('.photo-preview');
    if (preview) {
      preview.src = URL.createObjectURL(file);
      preview.classList.add('visible');
      preview.alt = `Predogled: ${file.name}`;
    }
  }

  function handlePhotoChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file && file.size > 5 * 1024 * 1024) {
      setError('photo', 'Slika ne sme biti večja od 5 MB.');
      input.value = '';
      return;
    }
    clearError('photo');
    update({ photo: file });

    // Show preview
    const preview = section.querySelector<HTMLImageElement>('.photo-preview');
    if (preview && file) {
      preview.src = URL.createObjectURL(file);
      preview.classList.add('visible');
      preview.alt = `Predogled: ${file.name}`;
    } else if (preview) {
      preview.classList.remove('visible');
      preview.alt = '';
    }
  }

  async function handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    if (!validate()) {
      // Move focus to first error
      const firstError = section.querySelector<HTMLElement>('[aria-invalid="true"]');
      firstError?.focus();
      return;
    }

    update({ submitting: true });

    const pending = {
      clientId: state.clientId,
      title: state.title.trim(),
      category: state.category as ReportCategory,
      description: state.description.trim(),
      lat: Number(state.lat),
      lng: Number(state.lng),
      address: state.address.trim() || undefined,
      photo: state.photo ?? undefined,
      queuedAt: new Date().toISOString(),
    };

    // Always enqueue first (offline-safe)
    await enqueue(pending);

    // Then attempt direct POST
    const formData = new FormData();
    formData.set('clientId', pending.clientId);
    formData.set('title', pending.title);
    formData.set('category', pending.category);
    formData.set('description', pending.description);
    formData.set('lat', String(pending.lat));
    formData.set('lng', String(pending.lng));
    if (pending.address) formData.set('address', pending.address);
    if (state.photo) formData.set('photo', state.photo);

    try {
      const result = await createReport(formData);
      // Submission succeeded — remove from queue
      await dequeue(result.clientId);
      if ('vibrate' in navigator) navigator.vibrate(50);
      showToast('Prijava je bila uspešno oddana!', { type: 'success' });
      navigate('/');
    } catch (err: unknown) {
      update({ submitting: false });
      if (err instanceof ApiError && err.status === 0) {
        // Register Background Sync so the SW replays when connectivity returns
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready
            .then((reg) => {
              type SyncManager = { register(tag: string): Promise<void> };
              if ('sync' in reg) {
                return (reg as ServiceWorkerRegistration & { sync: SyncManager }).sync.register(
                  'report-submit',
                );
              }
            })
            .catch(() => {
              // Background Sync not supported — queue entry will be replayed manually
            });
        }
        showToast('Brez povezave — prijava bo poslana samodejno, ko se spet povežete.', {
          type: 'info',
          duration: 8000,
        });
        navigate('/');
      } else {
        const msg = err instanceof ApiError ? err.message : 'Neznana napaka.';
        setError('general', msg);
      }
    }
  }

  function renderForm(): void {
    document.title = 'Nova prijava — PrijaviMesto';

    const { errors, submitting, geoLoading } = state;
    // Nominatim hint shown while address is being auto-filled
    const showNominatimHint = nominatimLoading;

    render(
      html`
        <h1 id="form-heading">Nova prijava</h1>

        ${errors['general']
          ? html`<div class="alert alert--error" role="alert" aria-live="assertive">
              <p>${errors['general']}</p>
            </div>`
          : ''}

        <form
          id="report-form"
          novalidate
          @submit=${handleSubmit}
          aria-busy=${submitting ? 'true' : 'false'}
        >
          <!-- Title -->
          <div class="form-group">
            <label class="form-label form-label--required" for="title">Naslov prijave</label>
            <input
              class="form-input"
              id="title"
              name="title"
              type="text"
              required
              minlength="3"
              maxlength="120"
              autocomplete="off"
              aria-required="true"
              aria-invalid=${errors['title'] ? 'true' : 'false'}
              aria-describedby=${errors['title'] ? 'title-error' : 'title-help'}
              .value=${state.title}
              @input=${(e: Event) => {
                update({ title: (e.target as HTMLInputElement).value });
                clearError('title');
              }}
            />
            <span id="title-help" class="form-help">Kratko opisno besedilo (maks. 120 znakov)</span>
            ${errors['title']
              ? html`<span id="title-error" class="form-error" role="alert">
                  <span aria-hidden="true">⚠</span> ${errors['title']}
                </span>`
              : ''}
          </div>

          <!-- Category -->
          <div class="form-group">
            <label class="form-label form-label--required" for="category">Kategorija</label>
            <select
              class="form-select"
              id="category"
              name="category"
              required
              aria-required="true"
              aria-invalid=${errors['category'] ? 'true' : 'false'}
              aria-describedby=${errors['category'] ? 'category-error' : ''}
              @change=${(e: Event) => {
                update({ category: (e.target as HTMLSelectElement).value as ReportCategory });
                clearError('category');
              }}
            >
              <option value="" ?selected=${state.category === ''}>-- Izberite kategorijo --</option>
              ${CATEGORIES.map(
                (c) =>
                  html`<option value=${c.value} ?selected=${state.category === c.value}>
                    ${c.label}
                  </option>`,
              )}
            </select>
            ${errors['category']
              ? html`<span id="category-error" class="form-error" role="alert">
                  <span aria-hidden="true">⚠</span> ${errors['category']}
                </span>`
              : ''}
          </div>

          <!-- Description -->
          <div class="form-group">
            <label class="form-label form-label--required" for="description">Opis težave</label>
            <textarea
              class="form-textarea"
              id="description"
              name="description"
              required
              minlength="10"
              maxlength="2000"
              aria-required="true"
              aria-invalid=${errors['description'] ? 'true' : 'false'}
              aria-describedby=${errors['description'] ? 'description-error' : 'description-help'}
              @input=${(e: Event) => {
                update({ description: (e.target as HTMLTextAreaElement).value });
                clearError('description');
              }}
            >
${state.description}</textarea
            >
            <span id="description-help" class="form-help"
              >Podrobno opišite težavo (vsaj 10 znakov)</span
            >
            ${errors['description']
              ? html`<span id="description-error" class="form-error" role="alert">
                  <span aria-hidden="true">⚠</span> ${errors['description']}
                </span>`
              : ''}
          </div>

          <!-- Location -->
          <fieldset>
            <legend class="form-label form-label--required">Lokacija</legend>
            <p class="form-help" style="margin-bottom:.75rem">
              Kliknite »Pridobi lokacijo« ali vnesite koordinate ročno.
            </p>
            <button
              type="button"
              class="btn btn--secondary"
              ?disabled=${geoLoading}
              aria-busy=${geoLoading ? 'true' : 'false'}
              @click=${handleGeolocate}
              style="margin-bottom:1rem"
            >
              ${geoLoading ? '⏳ Določam lokacijo…' : '📍 Pridobi lokacijo'}
            </button>
            <div class="geo-row">
              <div class="form-group">
                <label class="form-label" for="lat">Zemljepisna širina</label>
                <input
                  class="form-input"
                  id="lat"
                  type="number"
                  step="0.000001"
                  min="-90"
                  max="90"
                  aria-invalid=${errors['lat'] ? 'true' : 'false'}
                  aria-describedby=${errors['lat'] ? 'lat-error' : ''}
                  .value=${state.lat}
                  @input=${(e: Event) => {
                    update({ lat: (e.target as HTMLInputElement).value });
                    clearError('lat');
                  }}
                />
              </div>
              <div class="form-group">
                <label class="form-label" for="lng">Zemljepisna dolžina</label>
                <input
                  class="form-input"
                  id="lng"
                  type="number"
                  step="0.000001"
                  min="-180"
                  max="180"
                  .value=${state.lng}
                  @input=${(e: Event) => update({ lng: (e.target as HTMLInputElement).value })}
                />
              </div>
            </div>
            ${errors['lat']
              ? html`<span id="lat-error" class="form-error" role="alert">
                  <span aria-hidden="true">⚠</span> ${errors['lat']}
                </span>`
              : ''}
          </fieldset>

          <!-- Address (optional) — auto-filled via Nominatim after geolocation -->
          <div class="form-group" style="margin-top:1rem">
            <label class="form-label" for="address">Naslov (neobvezno)</label>
            <input
              class="form-input"
              id="address"
              name="address"
              type="text"
              maxlength="255"
              autocomplete="street-address"
              aria-describedby="address-help"
              aria-busy=${showNominatimHint ? 'true' : 'false'}
              .value=${state.address}
              @input=${(e: Event) => update({ address: (e.target as HTMLInputElement).value })}
            />
            <span id="address-help" class="form-help">
              ${showNominatimHint
                ? 'Pridobivam naslov…'
                : 'Ulica in hišna številka, občina (samodejno izpolnjeno po pridobitvi lokacije)'}
            </span>
          </div>

          <!-- Photo — file input or camera capture -->
          <div class="form-group">
            <label class="form-label" for="photo">Fotografija (neobvezno)</label>
            <div class="photo-input-row">
              <input
                class="form-input"
                id="photo"
                name="photo"
                type="file"
                accept="image/jpeg,image/webp,image/png"
                aria-describedby="photo-help ${errors['photo'] ? 'photo-error' : ''}"
                aria-invalid=${errors['photo'] ? 'true' : 'false'}
                @change=${handlePhotoChange}
              />
              ${isCameraSupported()
                ? html`<button
                    type="button"
                    class="btn btn--secondary"
                    style="white-space:nowrap"
                    @click=${handleCameraCapture}
                  >
                    Fotografiraj
                  </button>`
                : ''}
            </div>
            <img class="photo-preview" alt="" aria-hidden="true" />
            <span id="photo-help" class="form-help">JPEG, WebP ali PNG, največ 5 MB</span>
            ${errors['photo']
              ? html`<span id="photo-error" class="form-error" role="alert">
                  <span aria-hidden="true">⚠</span> ${errors['photo']}
                </span>`
              : ''}
          </div>

          <!-- Actions -->
          <div class="form-actions">
            <button
              type="submit"
              class="btn btn--primary"
              ?disabled=${submitting}
              aria-busy=${submitting ? 'true' : 'false'}
            >
              ${submitting ? 'Pošiljam…' : 'Oddaj prijavo'}
            </button>
            <a
              href="/"
              class="btn btn--secondary"
              @click=${(e: Event) => {
                e.preventDefault();
                navigate('/');
              }}
              >Prekliči</a
            >
          </div>
        </form>
      `,
      section,
    );
  }

  renderForm();
  return section;
}
