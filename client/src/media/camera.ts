const MAX_LONG_EDGE = 1600;
const WEBP_QUALITY = 0.8;

export function isCameraSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'mediaDevices' in navigator &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

export function computeResize(w: number, h: number): { sw: number; sh: number } {
  const maxEdge = Math.max(w, h);
  const ratio = maxEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / maxEdge : 1;
  return { sw: Math.round(w * ratio), sh: Math.round(h * ratio) };
}

function resizeVideoToCanvas(video: HTMLVideoElement): HTMLCanvasElement {
  const w = video.videoWidth;
  const h = video.videoHeight;
  const { sw, sh } = computeResize(w, h);

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  ctx.drawImage(video, 0, 0, sw, sh);
  return canvas;
}

function canvasToFile(canvas: HTMLCanvasElement): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas toBlob returned null'));
          return;
        }
        resolve(new File([blob], 'photo.webp', { type: 'image/webp' }));
      },
      'image/webp',
      WEBP_QUALITY,
    );
  });
}

/**
 * Opens a full-screen camera overlay, lets the user capture one frame,
 * resizes it to at most 1600 px on the long edge, and returns a WebP File.
 * Returns null if the user cancels or the camera is unavailable.
 */
export function captureFromCamera(): Promise<File | null> {
  if (!isCameraSupported()) return Promise.resolve(null);

  return new Promise<File | null>((resolve) => {
    let stream: MediaStream | null = null;

    // ── Build overlay DOM ──────────────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.className = 'camera-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Kamera za fotografiranje');

    const video = document.createElement('video');
    video.className = 'camera-video';
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.setAttribute('aria-label', 'Predogled kamere');

    const errorMsg = document.createElement('p');
    errorMsg.className = 'camera-error sr-only';
    errorMsg.setAttribute('role', 'alert');

    const actions = document.createElement('div');
    actions.className = 'camera-actions';

    const captureBtn = document.createElement('button');
    captureBtn.type = 'button';
    captureBtn.className = 'btn btn--primary camera-capture-btn';
    captureBtn.textContent = 'Zajemi fotografijo';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn--secondary';
    cancelBtn.textContent = 'Prekliči';

    actions.append(captureBtn, cancelBtn);
    overlay.append(video, errorMsg, actions);
    document.body.append(overlay);

    // Return focus to trigger element when overlay closes
    const previousFocus = document.activeElement as HTMLElement | null;

    function cleanup(): void {
      stream?.getTracks().forEach((t) => t.stop());
      overlay.remove();
      previousFocus?.focus();
    }

    captureBtn.addEventListener('click', () => {
      try {
        const canvas = resizeVideoToCanvas(video);
        canvasToFile(canvas)
          .then((file) => {
            cleanup();
            resolve(file);
          })
          .catch(() => {
            cleanup();
            resolve(null);
          });
      } catch {
        cleanup();
        resolve(null);
      }
    });

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    // Trap Escape key
    overlay.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup();
        resolve(null);
      }
    });

    // ── Start camera ───────────────────────────────────────────────────────
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        stream = s;
        video.srcObject = s;
        captureBtn.focus();
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'Dostop do kamere je zavrnjen.'
            : 'Kamere ni mogoče odpreti.';
        errorMsg.textContent = msg;
        errorMsg.classList.remove('sr-only');
        captureBtn.disabled = true;
        cancelBtn.focus();
      });
  });
}
