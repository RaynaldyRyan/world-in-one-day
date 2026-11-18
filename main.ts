// news-image-20261117 — "The World in One Day"
// Sums up Tuesday 17 November 2026 in one 1024x1024 PNG, drawn entirely
// at runtime with the Node 22 standard library only (no network, no assets).
// A hand-written PNG encoder (zlib deflate + CRC32) and an embedded 5x7
// bitmap font render a clean editorial front page: masthead naming the day,
// six story panels, each with a flat shape-drawn illustration and short labels.
//
// Stories (all happened / first reported on 17 Nov 2026, verified against
// multiple news sources on 18 Nov 2026):
//  1. US jets strike an Iranian missile site on Qeshm Island after Iran
//     fires drones at a US radar base in Bahrain.
//  2. Ukrainian drones and missiles collapse the road span of the Kerch
//     Bridge to Crimea for a second day.
//  3. Nvidia reports record quarterly revenue above $115bn and says it
//     will not reinstate ousted CEO Jensen Huang.
//  4. 146,000 people protest across France over the cost of living
//     (28,000 in Paris).
//  5. Trump flies to Shenzhen for APEC talks with Xi Jinping and Putin.
//  6. Mongolia's President Ukhnaagiin Khurelsukh resigns amid a
//     corruption scandal.

import * as fs from "node:fs";
import * as path from "node:path";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
type RGB = [number, number, number];
const PAPER: RGB = [246, 241, 231];
const INK: RGB = [22, 35, 63];
const NAVY: RGB = [22, 35, 63];
const GOLD: RGB = [198, 154, 60];
const CARD: RGB = [255, 255, 255];
const CARD_LINE: RGB = [216, 210, 196];
const ART_BG: RGB = [238, 233, 220];
const MUTED: RGB = [90, 88, 80];
const WHITE: RGB = [255, 255, 255];

// ------------------------------------------------------------------ canvas
const px = new Uint8Array(W * H * 3);
function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) setPixel(xx, yy, c);
  }
}
function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPixel(x, y, c);
    }
  }
}
function fillPoly(points: Array<[number, number]>, c: RGB): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of points) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) {
        setPixel(x, y, c);
      }
    }
  }
}
function drawLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  c: RGB,
  t: number,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const half = Math.floor(t / 2);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + (dx * i) / steps);
    const y = Math.round(y0 + (dy * i) / steps);
    for (let a = -half; a <= half; a++) {
      for (let b = -half; b <= half; b++) setPixel(x + a, y + b, c);
    }
  }
}

// ------------------------------------------------------------ 5x7 bitmap font
// Each glyph: 7 rows of 5 bits, written out as strings.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
};

function textWidth(s: string, scale: number): number {
  if (s.length === 0) return 0;
  return s.length * 6 * scale - scale;
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch] ?? FONT["?"];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row][col] === "1") {
          fillRect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}
function drawTextCentered(
  cx: number,
  y: number,
  s: string,
  scale: number,
  c: RGB,
): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}
function wrapText(s: string, maxW: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale) <= maxW) {
      cur = trial;
    } else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// --------------------------------------------------------------- PNG encoder
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  // Raw scanlines, filter byte 0 per row.
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ artwork
// Each illustration draws inside a 160 x 182 box at (ox, oy).
function artQeshm(ox: number, oy: number): void {
  // Sea, island, explosion burst, jet silhouette.
  fillRect(ox, oy + 118, 160, 64, [38, 80, 120]);
  fillPoly(
    [
      [ox + 18, oy + 128],
      [ox + 142, oy + 128],
      [ox + 128, oy + 96],
      [ox + 34, oy + 96],
    ],
    [210, 190, 140],
  );
  // Explosion burst (8-point star).
  const cx = ox + 80;
  const cy = oy + 62;
  const star: Array<[number, number]> = [];
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    const r = i % 2 === 0 ? 46 : 18;
    star.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  fillPoly(star, [230, 120, 40]);
  fillCircle(cx, cy, 16, [245, 190, 60]);
  fillCircle(cx, cy, 8, [255, 240, 180]);
  // Jet silhouette diving in from the top right — larger, clearer shape.
  fillPoly(
    [
      [ox + 122, oy + 6],
      [ox + 156, oy + 26],
      [ox + 138, oy + 30],
      [ox + 130, oy + 24],
      [ox + 120, oy + 20],
    ],
    INK,
  );
  fillPoly(
    [
      [ox + 132, oy + 20],
      [ox + 146, oy + 34],
      [ox + 140, oy + 36],
    ],
    INK,
  );
  // Smoke puffs.
  fillCircle(ox + 40, oy + 88, 10, [120, 120, 118]);
  fillCircle(ox + 118, oy + 84, 9, [140, 140, 136]);
}

function artKerch(ox: number, oy: number): void {
  // Water, bridge deck broken in the middle, falling span, smoke.
  fillRect(ox, oy + 118, 160, 64, [70, 110, 150]);
  // Left deck and right deck, gap in the middle.
  fillRect(ox + 6, oy + 96, 56, 10, [90, 90, 92]);
  fillRect(ox + 98, oy + 96, 56, 10, [90, 90, 92]);
  // Pillars.
  fillRect(ox + 18, oy + 106, 8, 24, [70, 70, 72]);
  fillRect(ox + 128, oy + 106, 8, 24, [70, 70, 72]);
  // Falling span, tilted into the water.
  fillPoly(
    [
      [ox + 62, oy + 96],
      [ox + 98, oy + 96],
      [ox + 104, oy + 128],
      [ox + 70, oy + 132],
    ],
    [120, 120, 122],
  );
  // Arch stub left standing.
  drawLine(ox + 34, oy + 96, ox + 34, oy + 62, [90, 90, 92], 5);
  drawLine(ox + 34, oy + 62, ox + 62, oy + 96, [90, 90, 92], 5);
  // Smoke cloud at the break and debris splashing into the water.
  fillCircle(ox + 80, oy + 82, 13, [150, 150, 146]);
  fillCircle(ox + 70, oy + 74, 9, [170, 170, 166]);
  fillCircle(ox + 90, oy + 72, 8, [170, 170, 166]);
  fillCircle(ox + 86, oy + 136, 10, [230, 240, 245]);
  fillCircle(ox + 96, oy + 140, 7, [230, 240, 245]);
  fillPoly(
    [
      [ox + 66, oy + 118],
      [ox + 76, oy + 116],
      [ox + 80, oy + 126],
      [ox + 70, oy + 128],
    ],
    [90, 90, 92],
  );
}

function artNvidia(ox: number, oy: number): void {
  // Chip with pins and circuits, rising bars and arrow.
  fillRect(ox + 18, oy + 78, 66, 66, [30, 90, 40]);
  fillRect(ox + 32, oy + 92, 38, 38, [70, 150, 70]);
  fillRect(ox + 44, oy + 104, 14, 14, [220, 240, 220]);
  for (let i = 0; i < 4; i++) {
    fillRect(ox + 26 + i * 16, oy + 70, 6, 8, [120, 120, 118]);
    fillRect(ox + 26 + i * 16, oy + 144, 6, 8, [120, 120, 118]);
    fillRect(ox + 10, oy + 86 + i * 16, 8, 6, [120, 120, 118]);
    fillRect(ox + 84, oy + 86 + i * 16, 8, 6, [120, 120, 118]);
  }
  // Rising bars.
  fillRect(ox + 104, oy + 128, 14, 16, [118, 185, 0]);
  fillRect(ox + 122, oy + 112, 14, 32, [118, 185, 0]);
  fillRect(ox + 140, oy + 94, 14, 50, [118, 185, 0]);
  // Upward arrow over the bars.
  drawLine(ox + 102, oy + 96, ox + 126, oy + 66, [30, 90, 40], 5);
  drawLine(ox + 126, oy + 66, ox + 152, oy + 40, [30, 90, 40], 5);
  fillPoly(
    [
      [ox + 152, oy + 40],
      [ox + 138, oy + 38],
      [ox + 150, oy + 54],
    ],
    [30, 90, 40],
  );
  // Dollar mark drawn as a small green disc with a bar.
  fillCircle(ox + 138, oy + 26, 12, [118, 185, 0]);
  fillRect(ox + 136, oy + 16, 4, 20, WHITE);
}

function artFrance(ox: number, oy: number): void {
  // Crowd of heads, placards, and a small French flag.
  const skins: RGB[] = [
    [232, 190, 150],
    [210, 160, 120],
    [190, 140, 105],
  ];
  const hairs: RGB[] = [
    [60, 40, 25],
    [30, 30, 30],
    [120, 90, 50],
    [200, 200, 200],
  ];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const cx = ox + 18 + col * 30;
      const cy = oy + 96 + row * 28;
      fillCircle(cx, cy, 11, skins[(row + col) % 3]);
      fillCircle(cx, cy - 4, 10, hairs[(row * 2 + col) % 4]);
      fillRect(cx - 11, oy + 104 + row * 28, 22, 22, [
        [70, 90, 140],
        [160, 60, 60],
        [60, 120, 80],
      ][(row + col) % 3]);
    }
  }
  // Placards held above the crowd.
  drawLine(ox + 30, oy + 78, ox + 30, oy + 46, [90, 70, 50], 3);
  fillRect(ox + 8, oy + 22, 44, 26, [255, 255, 255]);
  fillRect(ox + 8, oy + 22, 44, 4, [200, 60, 60]);
  drawLine(ox + 128, oy + 78, ox + 128, oy + 50, [90, 70, 50], 3);
  fillRect(ox + 106, oy + 26, 44, 26, [255, 255, 255]);
  fillRect(ox + 106, oy + 26, 44, 4, [60, 90, 160]);
  // Small French flag on a pole.
  drawLine(ox + 76, oy + 60, ox + 76, oy + 20, [90, 70, 50], 3);
  fillRect(ox + 76, oy + 20, 12, 18, [40, 80, 160]);
  fillRect(ox + 88, oy + 20, 12, 18, WHITE);
  fillRect(ox + 100, oy + 20, 12, 18, [200, 60, 60]);
}

function artShenzhen(ox: number, oy: number): void {
  // Skyline, three leader dots (US blue, China red, Russia white/blue),
  // and a gold star for the summit.
  const towers: Array<[number, number, number]> = [
    [8, 70, 34],
    [46, 46, 30],
    [80, 88, 26],
    [110, 58, 30],
    [142, 78, 14],
  ];
  for (const [tx, th, tw] of towers) {
    fillRect(ox + tx, oy + 150 - th, tw, th, NAVY);
    for (let wy = oy + 150 - th + 8; wy < oy + 142; wy += 12) {
      for (let wx = ox + tx + 5; wx < ox + tx + tw - 4; wx += 9) {
        fillRect(wx, wy, 4, 5, [245, 200, 90]);
      }
    }
  }
  fillRect(ox, oy + 150, 160, 6, GOLD);
  // Three leader dots above the skyline.
  fillCircle(ox + 40, oy + 26, 13, [40, 80, 160]);
  fillCircle(ox + 80, oy + 26, 13, [200, 50, 50]);
  fillCircle(ox + 120, oy + 26, 13, [240, 240, 240]);
  fillCircle(ox + 120, oy + 26, 13, [200, 200, 200]);
  fillCircle(ox + 120, oy + 26, 7, [40, 80, 160]);
  // Gold star between the dots.
  fillPoly(
    [
      [ox + 80, oy + 52],
      [ox + 83, oy + 58],
      [ox + 89, oy + 58],
      [ox + 84, oy + 62],
      [ox + 86, oy + 68],
      [ox + 80, oy + 64],
      [ox + 74, oy + 68],
      [ox + 76, oy + 62],
      [ox + 71, oy + 58],
      [ox + 77, oy + 58],
    ],
    GOLD,
  );
}

function artMongolia(ox: number, oy: number): void {
  // Podium, empty chair, downward arrow, Mongolian flag colours.
  // Flag: blue-red-blue vertical bands.
  fillRect(ox + 12, oy + 10, 14, 40, [0, 90, 170]);
  fillRect(ox + 26, oy + 10, 14, 40, [200, 50, 50]);
  fillRect(ox + 40, oy + 10, 14, 40, [0, 90, 170]);
  fillCircle(ox + 33, oy + 22, 4, GOLD);
  // Empty chair with a red cushion: the seat is vacant.
  fillRect(ox + 96, oy + 96, 44, 8, [120, 90, 60]);
  fillRect(ox + 96, oy + 60, 8, 40, [120, 90, 60]);
  fillRect(ox + 132, oy + 60, 8, 40, [120, 90, 60]);
  fillRect(ox + 96, oy + 52, 44, 10, [120, 90, 60]);
  fillRect(ox + 102, oy + 90, 32, 6, [180, 60, 60]);
  // Podium.
  fillPoly(
    [
      [ox + 20, oy + 118],
      [ox + 140, oy + 118],
      [ox + 128, oy + 164],
      [ox + 32, oy + 164],
    ],
    [150, 130, 110],
  );
  fillRect(ox + 66, oy + 104, 28, 14, [90, 80, 70]);
  // Microphone.
  drawLine(ox + 80, oy + 104, ox + 80, oy + 82, [60, 60, 60], 3);
  fillCircle(ox + 80, oy + 78, 6, [60, 60, 60]);
  // Downward arrow: the resignation.
  drawLine(ox + 116, oy + 24, ox + 116, oy + 52, [200, 50, 50], 6);
  fillPoly(
    [
      [ox + 116, oy + 62],
      [ox + 104, oy + 46],
      [ox + 128, oy + 46],
    ],
    [200, 50, 50],
  );
}

// ------------------------------------------------------------------- panels
interface Story {
  kicker: string;
  accent: RGB;
  headline: string;
  sub: string;
  art: (ox: number, oy: number) => void;
}

const STORIES: Story[] = [
  {
    kicker: "MIDDLE EAST",
    accent: [179, 64, 42],
    headline: "US STRIKES IRAN",
    sub: "US JETS HIT A MISSILE SITE ON QESHM ISLAND AFTER IRAN FIRED DRONES AT A US BASE IN BAHRAIN",
    art: artQeshm,
  },
  {
    kicker: "UKRAINE",
    accent: [46, 90, 136],
    headline: "KERCH BRIDGE FALLS",
    sub: "UKRAINIAN DRONES AND MISSILES COLLAPSE THE ROAD SPAN OF THE BRIDGE TO CRIMEA",
    art: artKerch,
  },
  {
    kicker: "TECHNOLOGY",
    accent: [62, 122, 46],
    headline: "NVIDIA SOARS",
    sub: "REVENUE TOPS $115 BILLION, BUT THE CHIP GIANT WILL NOT BRING BACK OUSTED CEO JENSEN HUANG",
    art: artNvidia,
  },
  {
    kicker: "FRANCE",
    accent: [107, 78, 158],
    headline: "146,000 MARCH",
    sub: "UNIONS CALL A DAY OF ACTION AS LIVING COSTS RISE; 28,000 MARCH IN PARIS",
    art: artFrance,
  },
  {
    kicker: "ASIA",
    accent: [31, 122, 107],
    headline: "SUMMIT IN SHENZHEN",
    sub: "TRUMP FLIES IN FOR TALKS WITH XI AND PUTIN AT THE APEC SUMMIT",
    art: artShenzhen,
  },
  {
    kicker: "MONGOLIA",
    accent: [138, 90, 43],
    headline: "PRESIDENT RESIGNS",
    sub: "UKHNAAGIIN KHURELSUKH STEPS DOWN AS A CORRUPTION SCANDAL GROWS",
    art: artMongolia,
  },
];

function drawPanel(x: number, y: number, w: number, h: number, s: Story): void {
  // Card.
  fillRect(x, y, w, h, CARD);
  fillRect(x, y, w, 2, CARD_LINE);
  fillRect(x, y + h - 2, w, 2, CARD_LINE);
  fillRect(x, y, 2, h, CARD_LINE);
  fillRect(x + w - 2, y, 2, h, CARD_LINE);
  // Kicker strip.
  fillRect(x, y, w, 42, s.accent);
  drawText(x + 16, y + 11, s.kicker, 2, WHITE);
  // Art zone.
  const ax = x + 16;
  const ay = y + 58;
  fillRect(ax, ay, 160, 182, ART_BG);
  s.art(ax, ay);
  // Headline + sub to the right of the art.
  const tx = x + 192;
  const tw = w - 192 - 16;
  const headLines = wrapText(s.headline, tw, 3);
  let ty = y + 62;
  for (const line of headLines) {
    drawText(tx, ty, line, 3, INK);
    ty += 27;
  }
  drawLine(tx, ty + 2, tx + 64, ty + 2, s.accent, 4);
  ty += 16;
  const subLines = wrapText(s.sub, tw, 2);
  for (const line of subLines.slice(0, 5)) {
    drawText(tx, ty, line, 2, MUTED);
    ty += 17;
  }
}

// -------------------------------------------------------------------- build
function build(): Buffer {
  // Paper background.
  fillRect(0, 0, W, H, PAPER);
  // Masthead.
  fillRect(0, 0, W, 150, NAVY);
  fillRect(0, 8, W, 4, GOLD);
  drawTextCentered(W / 2, 30, "THE WORLD IN ONE DAY", 2, GOLD);
  drawTextCentered(W / 2, 58, "TUESDAY 17 NOVEMBER 2026", 4, WHITE);
  drawTextCentered(
    W / 2,
    108,
    "SIX STORIES THAT DEFINED THE DAY",
    2,
    [200, 205, 215],
  );
  fillRect(0, 146, W, 4, GOLD);
  // Story grid: 2 columns x 3 rows.
  const pw = 488;
  const ph = 256;
  const gx = 16;
  const gy = 166;
  for (let i = 0; i < STORIES.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    drawPanel(gx + col * (pw + 16), gy + row * (ph + 16), pw, ph, STORIES[i]);
  }
  // Footer.
  drawTextCentered(
    W / 2,
    980,
    "ALL SIX STORIES WERE REPORTED ON TUESDAY 17 NOVEMBER 2026",
    2,
    MUTED,
  );
  return encodePNG();
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  fs.mkdirSync(outDir, { recursive: true });
  const png = build();
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
}

main();
