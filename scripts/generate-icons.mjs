/**
 * Builds every icon the app ships, from one master image.
 *
 *   assets/icon-master.png  ->  public/icons/*  +  the iOS asset catalog
 *
 * The master is the only thing drawn by hand; everything else is a resize of
 * it, so the home screen, the browser tab and the App Store can never show
 * different marks. Re-export the master, run this, commit both.
 *
 * PNG is decoded and encoded here rather than by a library: no native canvas,
 * no image dependency, so `npm run icons` works on a clean checkout on any
 * platform. Only what this needs is supported - 8-bit, non-interlaced, RGB or
 * RGBA, which is what every export tool produces.
 *
 *   node scripts/generate-icons.mjs
 */

import { deflateSync, inflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'assets', 'icon-master.png');
const OUT_DIR = join(ROOT, 'public', 'icons');

/* ---------------------------------------------------------------- decode -- */

/** Returns { width, height, pixels }, the pixels as RGBA, four bytes each. */
function decodePng(file) {
  const d = readFileSync(file);
  if (d.readUInt32BE(0) !== 0x89504e47) throw new Error(file + ' is not a PNG');

  const width = d.readUInt32BE(16);
  const height = d.readUInt32BE(20);
  const depth = d[24];
  const colour = d[25];
  const interlaced = d[28];
  if (depth !== 8 || interlaced !== 0 || (colour !== 2 && colour !== 6)) {
    throw new Error(
      file + ': needs to be an 8-bit, non-interlaced RGB or RGBA PNG (got depth ' +
        depth + ', colour type ' + colour + ')',
    );
  }
  const channels = colour === 6 ? 4 : 3;

  // The image data, which an encoder may have split across any number of chunks.
  const parts = [];
  for (let i = 8; i < d.length; ) {
    const length = d.readUInt32BE(i);
    if (d.toString('ascii', i + 4, i + 8) === 'IDAT') {
      parts.push(d.subarray(i + 8, i + 8 + length));
    }
    i += 12 + length;
  }
  const data = inflateSync(Buffer.concat(parts));

  /*
   * Undo the per-scanline filters. Each one predicts a byte from the one to its
   * left, the one above, and the one above-left; the file stores only how far
   * out that prediction was, which is what makes PNG compress at all.
   */
  const stride = width * channels;
  const pixels = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = data[pos++];
    const line = Buffer.from(data.subarray(pos, pos + stride));
    pos += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let add = 0;
      if (filter === 1) add = a;
      else if (filter === 2) add = b;
      else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[x] = (line[x] + add) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const from = x * channels;
      const to = (y * width + x) * 4;
      pixels[to] = line[from];
      pixels[to + 1] = line[from + 1];
      pixels[to + 2] = line[from + 2];
      pixels[to + 3] = channels === 4 ? line[from + 3] : 0xff;
    }
    prev = line;
  }
  return { width, height, pixels };
}

/* ---------------------------------------------------------------- resize -- */

/**
 * Box filter: every pixel out is the average of the pixels it covers going in.
 * Slower than picking the nearest one, and the reason the small sizes stay
 * readable rather than breaking up into aliased confetti.
 */
function resize(src, size) {
  const out = Buffer.alloc(size * size * 4);
  const sx = src.width / size;
  const sy = src.height / size;

  for (let y = 0; y < size; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.max(y0 + 1, Math.ceil((y + 1) * sy));
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(x0 + 1, Math.ceil((x + 1) * sx));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let yy = y0; yy < y1 && yy < src.height; yy++) {
        for (let xx = x0; xx < x1 && xx < src.width; xx++) {
          const i = (yy * src.width + xx) * 4;
          r += src.pixels[i];
          g += src.pixels[i + 1];
          b += src.pixels[i + 2];
          a += src.pixels[i + 3];
          n++;
        }
      }
      const o = (y * size + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = Math.round(a / n);
    }
  }
  return out;
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

/**
 * @param {Buffer} rgba
 * @param {number} size
 * @param {boolean} opaque Drop the alpha channel entirely and write RGB.
 *   App Store Connect rejects an app icon that merely *has* an alpha channel,
 *   even one that is opaque everywhere — ITMS-90717, raised at upload, after a
 *   full build has already been paid for.
 */
function encodePng(rgba, size, opaque = false) {
  const channels = opaque ? 3 : 4;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = opaque ? 2 : 6; // colour type: RGB or RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  const stride = size * channels;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter byte (0 = None)
    if (opaque) {
      for (let x = 0; x < size; x++) {
        const from = (y * size + x) * 4;
        const to = y * (stride + 1) + 1 + x * 3;
        raw[to] = rgba[from];
        raw[to + 1] = rgba[from + 1];
        raw[to + 2] = rgba[from + 2];
      }
    } else {
      rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ----------------------------------------------------------------- build -- */

const TARGETS = [
  { file: 'icon-16.png', size: 16 },
  { file: 'icon-32.png', size: 32 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  // Launchers crop this one to a safe zone; the mark sits well inside it.
  { file: 'icon-maskable-512.png', size: 512 },
  // iOS applies its own rounded mask, so this ships as a full square.
  { file: 'apple-touch-icon.png', size: 180 },
];

/**
 * The native app icon, written straight into the Xcode asset catalog so the
 * home screen and the web app can never show different marks. Square, opaque,
 * and 1024 - the three things App Store Connect checks.
 */
const IOS_APPICON = join(
  ROOT,
  'ios',
  'App',
  'App',
  'Assets.xcassets',
  'AppIcon.appiconset',
  'AppIcon-512@2x.png',
);

const master = decodePng(SOURCE);
if (master.width !== master.height) {
  throw new Error(
    'assets/icon-master.png must be square (it is ' + master.width + 'x' + master.height + ')',
  );
}
console.log('master  ' + master.width + 'x' + master.height);

mkdirSync(OUT_DIR, { recursive: true });
for (const { file, size } of TARGETS) {
  const png = encodePng(resize(master, size), size);
  writeFileSync(join(OUT_DIR, file), png);
  console.log(file + '  ' + size + 'x' + size + '  ' + (png.length / 1024).toFixed(1) + ' KB');
}

const appIcon = encodePng(resize(master, 1024), 1024, true);
writeFileSync(IOS_APPICON, appIcon);
console.log(
  'ios AppIcon-512@2x.png  1024x1024  opaque  ' + (appIcon.length / 1024).toFixed(1) + ' KB',
);

console.log('');
console.log('Wrote ' + (TARGETS.length + 1) + ' files from assets/icon-master.png');
