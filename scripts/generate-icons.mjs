/**
 * Generates the PWA icon set — a plain placeholder mark to be replaced later.
 *
 * A white musical note on a black tile, in keeping with the app's black/white
 * theme. Rasterised by hand and encoded with nothing but Node's built-in zlib
 * (no native canvas, no image dependency), so `npm run icons` works on a clean
 * checkout on any platform.
 *
 *   node scripts/generate-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

/* ------------------------------------------------------------------ paint -- */

const WHITE = [0xff, 0xff, 0xff];
const BLACK = [0x00, 0x00, 0x00];

/** Squared distance from (px,py) to the segment (ax,ay)-(bx,by). */
function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const len2 = vx * vx + vy * vy;
  let t = len2 > 0 ? (wx * vx + wy * vy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = px - (ax + t * vx);
  const dy = py - (ay + t * vy);
  return Math.hypot(dx, dy);
}

function insideRoundedRect(x, y, r) {
  if (x < 0 || x > 1 || y < 0 || y > 1) return false;
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

/**
 * A single quarter note in a normalised 0..1 content box: filled head, straight
 * stem, one flag. Placeholder art — swap for a real mark later.
 */
function markAlpha(x, y) {
  // note head (slightly widened ellipse)
  if (Math.hypot((x - 0.4) / 1.18, y - 0.68) <= 0.155) return 1;
  // stem, up the right edge of the head
  if (distToSegment(x, y, 0.55, 0.66, 0.55, 0.2) <= 0.03) return 1;
  // flag
  if (distToSegment(x, y, 0.55, 0.2, 0.73, 0.37) <= 0.032) return 1;
  return 0;
}

/**
 * @param {number} size         pixel dimensions
 * @param {number} corner       corner radius as a fraction of the size (0 = square)
 * @param {number} contentScale mark size relative to the icon box
 */
function render(size, corner, contentScale) {
  const SS = 4; // 4x4 supersampling
  const data = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = (px + (sx + 0.5) / SS) / size;
          const ny = (py + (sy + 0.5) / SS) / size;

          let sr = 0;
          let sg = 0;
          let sb = 0;
          let sa = 0;

          if (corner === 0 || insideRoundedRect(nx, ny, corner)) {
            sr = BLACK[0];
            sg = BLACK[1];
            sb = BLACK[2];
            sa = 1;
          }

          const ux = (nx - 0.5) / contentScale + 0.5;
          const uy = (ny - 0.5) / contentScale + 0.5;
          const alpha = markAlpha(ux, uy);
          if (alpha > 0) {
            sr = WHITE[0] * alpha + sr * (1 - alpha);
            sg = WHITE[1] * alpha + sg * (1 - alpha);
            sb = WHITE[2] * alpha + sb * (1 - alpha);
            sa = Math.max(sa, alpha);
          }

          r += sr;
          g += sg;
          b += sb;
          a += sa;
        }
      }

      const n = SS * SS;
      const i = (py * size + px) * 4;
      data[i] = Math.round(r / n);
      data[i + 1] = Math.round(g / n);
      data[i + 2] = Math.round(b / n);
      data[i + 3] = Math.round((a / n) * 255);
    }
  }

  return data;
}

/* -------------------------------------------------------------- png codec -- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, body])), 0);
  return Buffer.concat([length, typeBuf, body, crc]);
}

function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter byte (0 = None)
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ build -- */

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <rect width="96" height="96" rx="21" fill="#000000"/>
  <g fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round">
    <path d="M53 19v44" stroke-width="6"/>
    <path d="M53 19c6 6 15 7 17 17" stroke-width="6"/>
    <ellipse cx="41" cy="65" rx="14" ry="11" fill="#ffffff" stroke="none"/>
  </g>
</svg>
`;

const TARGETS = [
  { file: 'icon-16.png', size: 16, corner: 0.16, scale: 0.86 },
  { file: 'icon-32.png', size: 32, corner: 0.16, scale: 0.86 },
  { file: 'icon-192.png', size: 192, corner: 0.22, scale: 0.72 },
  { file: 'icon-512.png', size: 512, corner: 0.22, scale: 0.72 },
  // Maskable: full bleed, mark kept inside the 80% safe zone launchers crop to.
  { file: 'icon-maskable-512.png', size: 512, corner: 0, scale: 0.56 },
  // iOS applies its own mask, so ship a full square.
  { file: 'apple-touch-icon.png', size: 180, corner: 0, scale: 0.68 },
];

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'icon.svg'), SVG, 'utf8');
console.log('icon.svg');

for (const { file, size, corner, scale } of TARGETS) {
  const png = encodePng(render(size, corner, scale), size);
  writeFileSync(join(OUT_DIR, file), png);
  console.log(`${file}  ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`);
}

console.log(`\nWrote ${TARGETS.length + 1} files to public/icons/`);
