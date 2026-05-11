/**
 * Generates solid-color PNG icons for the PWA manifest.
 * Pure Node.js — no external dependencies.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, '../public/icons');
mkdirSync(ICONS_DIR, { recursive: true });

// CRC-32 lookup table (PNG spec)
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBytes = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBytes, data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function makeIHDR(width, height) {
  const buf = Buffer.alloc(13);
  buf.writeUInt32BE(width, 0);
  buf.writeUInt32BE(height, 4);
  buf[8] = 8; // bit depth
  buf[9] = 2; // colour type: RGB
  return buf;
}

/**
 * Draws a simple "P" lettermark icon with:
 * - Primary background (#1565C0)
 * - White rectangle in the upper-centre (stem of P)
 * - White arc region (bowl of P) — approximated with a rectangle
 */
function makeIconData(size, maskable = false) {
  const pad = maskable ? Math.floor(size * 0.1) : Math.floor(size * 0.05);
  const [bgR, bgG, bgB] = [0x15, 0x65, 0xc0]; // #1565C0
  const [fgR, fgG, fgB] = [0xff, 0xff, 0xff]; // white

  // Letter "P" geometry (relative to icon size)
  const stemX = Math.floor(size * 0.32);
  const stemW = Math.floor(size * 0.12);
  const stemTop = Math.floor(size * 0.22) + pad;
  const stemBot = Math.floor(size * 0.78) - pad;
  const bowlX1 = stemX;
  const bowlX2 = Math.floor(size * 0.68);
  const bowlTop = stemTop;
  const bowlBot = Math.floor(size * 0.52);
  const bowlInnerX = stemX + stemW;
  const bowlInnerTop = bowlTop + Math.floor(size * 0.07);
  const bowlInnerBot = bowlBot - Math.floor(size * 0.07);

  const rowSize = 1 + size * 3;
  const raw = Buffer.alloc(size * rowSize);

  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const offset = y * rowSize + 1 + x * 3;

      // Stem of P
      const inStem = x >= stemX && x < stemX + stemW && y >= stemTop && y < stemBot;

      // Bowl outer rectangle
      const inBowlOuter = x >= bowlX1 && x < bowlX2 && y >= bowlTop && y < bowlBot;

      // Bowl inner (cutout) rectangle
      const inBowlInner =
        x >= bowlInnerX && x < bowlX2 - stemW && y >= bowlInnerTop && y < bowlInnerBot;

      const isFg = (inStem || inBowlOuter) && !inBowlInner;

      raw[offset] = isFg ? fgR : bgR;
      raw[offset + 1] = isFg ? fgG : bgG;
      raw[offset + 2] = isFg ? fgB : bgB;
    }
  }

  return deflateSync(raw, { level: 9 });
}

function makePNG(size, maskable = false) {
  const signature = Buffer.from('\x89PNG\r\n\x1a\n', 'binary');
  return Buffer.concat([
    signature,
    makeChunk('IHDR', makeIHDR(size, size)),
    makeChunk('IDAT', makeIconData(size, maskable)),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync(join(ICONS_DIR, 'icon-192.png'), makePNG(192));
writeFileSync(join(ICONS_DIR, 'icon-512.png'), makePNG(512));
writeFileSync(join(ICONS_DIR, 'icon-512-maskable.png'), makePNG(512, true));
console.log('Icons generated in', ICONS_DIR);
