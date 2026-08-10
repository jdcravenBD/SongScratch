/**
 * Generates the app's icon set: two white S's on a black tile, in keeping with
 * the black/white theme.
 *
 * The mark is described once, as a centreline sampled into a polyline, and both
 * outputs are built from it — the PNGs by measuring distance to that line, the
 * SVG by writing the same points out as a path. They cannot drift apart.
 *
 * Rasterised by hand and encoded with nothing but Node's built-in zlib (no
 * native canvas, no image dependency), so `npm run icons` works on a clean
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

/* -------------------------------------------------------------- the mark --
 * Song Scratch, so: two S's. Each is one continuous stroke — the top bowl
 * swept round from its upper right, and the bottom bowl carrying on from the
 * waist and away to the lower left, which is what makes an S rather than a
 * figure eight. The two arcs meet exactly at the waist by construction.
 */

/** Bowl radius. An S is 2r wide and 4r tall, before the stroke is added. */
const R = 0.2;
/** How thick the stroke is drawn, in the same 0..1 content box. */
const WEIGHT = 0.1;
/** Space between the pair. */
const GAP = 0.06;
/**
 * How far round each bowl goes. Short of a full turn on purpose: carry it much
 * past this and the terminals close on the waist, and the letter reads as a
 * spiral rather than an S.
 */
const SWEEP = 182;

/** One S's centreline, sampled fine enough that the joins read as smooth. */
function sPoints(cx, cy) {
  const points = [];
  const arc = (ax, ay, from, to) => {
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const t = ((from + ((to - from) * i) / steps) * Math.PI) / 180;
      points.push([ax + R * Math.cos(t), ay + R * Math.sin(t)]);
    }
  };
  // Both bowls finish at the waist (cx, cy), which is -270° on the top circle
  // and -90° on the bottom one, so the halves meet without a seam.
  arc(cx, cy - R, -270 + SWEEP, -270); // top bowl, in from the upper right
  arc(cx, cy + R, -90, -90 + SWEEP); // bottom bowl, out to the lower left
  return points;
}

/** Both of them, centred as a pair in the content box. */
const MARK = [
  sPoints(0.5 - (2 * R + GAP) / 2, 0.5),
  sPoints(0.5 + (2 * R + GAP) / 2, 0.5),
];

function markAlpha(x, y) {
  for (const points of MARK) {
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1];
      const [bx, by] = points[i];
      if (distToSegment(x, y, ax, ay, bx, by) <= WEIGHT / 2) return 1;
    }
  }
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

/** The same mark as a 96-unit SVG, at the same content scale as icon-192. */
const SVG = (() => {
  const box = 96;
  const scale = 0.72;
  const at = (v) => (box / 2 + (v - 0.5) * box * scale).toFixed(2);
  const path = (points) =>
    points
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${at(x)} ${at(y)}`)
      .join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}" width="${box}" height="${box}">
  <rect width="${box}" height="${box}" rx="21" fill="#000000"/>
  <g fill="none" stroke="#ffffff" stroke-width="${(WEIGHT * box * scale).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round">
${MARK.map((points) => `    <path d="${path(points)}"/>`).join('\n')}
  </g>
</svg>
`;
})();

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
