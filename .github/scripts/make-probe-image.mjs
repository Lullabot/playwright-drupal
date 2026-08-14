#!/usr/bin/env node
/**
 * Generates a small PNG with no dependencies, used by the attachment upload
 * probe workflow. The hue rotates with the seed so a freshly uploaded image is
 * visually distinguishable from one served out of a cache.
 *
 * Usage: node make-probe-image.mjs <output.png> [seed]
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const [, , outputPath, rawSeed = '0'] = process.argv;

if (!outputPath) {
  console.error('Usage: make-probe-image.mjs <output.png> [seed]');
  process.exit(1);
}

const WIDTH = 640;
const HEIGHT = 200;
const seed = Number.parseInt(rawSeed, 10) || 0;

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

// Simple HSV -> RGB so the seed can drive a recognisable colour shift.
function hsv(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const [r, g, b] = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ][i % 6];
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

const baseHue = (seed % 360) / 360;
const raw = Buffer.alloc(HEIGHT * (1 + WIDTH * 3));

for (let y = 0; y < HEIGHT; y++) {
  const rowStart = y * (1 + WIDTH * 3);
  raw[rowStart] = 0; // Filter type: none.
  for (let x = 0; x < WIDTH; x++) {
    // Checkerboard banding makes scaling and cropping obvious at a glance.
    const band = Math.floor(x / 40) % 2 === Math.floor(y / 40) % 2 ? 0.85 : 0.55;
    const [r, g, b] = hsv((baseHue + x / WIDTH) % 1, 0.65, band);
    const offset = rowStart + 1 + x * 3;
    raw[offset] = r;
    raw[offset + 1] = g;
    raw[offset + 2] = b;
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8; // Bit depth.
ihdr[9] = 2; // Colour type: truecolour.

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

writeFileSync(outputPath, png);
console.log(`Wrote ${outputPath} (${png.length} bytes, seed ${seed})`);
