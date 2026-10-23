import { encode as encodeJpeg } from 'jpeg-js';

import { barcodeFromJpegBase64, base64ToBytes, choosePictureSize } from '@/services/barcodeFromPhoto';

// Draws a real EAN-13 barcode, so the reader is tested on the same kind of image a phone photo gives it.
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = L.map((p) => [...p].map((b) => (b === '0' ? '1' : '0')).join(''));
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

function withCheckDigit(twelve: string): string {
  const sum = [...twelve].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return twelve + ((10 - (sum % 10)) % 10);
}

function ean13Modules(code: string): string {
  const d = [...code].map(Number);
  const left = d
    .slice(1, 7)
    .map((n, i) => (PARITY[d[0]][i] === 'L' ? L[n] : G[n]))
    .join('');
  const right = d
    .slice(7)
    .map((n) => R[n])
    .join('');
  return `101${left}01010${right}101`;
}

/** A JPEG (base64) of the barcode on white, `module` px per bar, optionally turned a quarter. */
function photoOf(code: string, { module = 4, rotated = false } = {}): string {
  const bars = ean13Modules(code);
  const quiet = 12 * module;
  const w = bars.length * module + quiet * 2;
  const h = 180;
  const width = rotated ? h : w;
  const height = rotated ? w : h;
  const data = Buffer.alloc(width * height * 4, 255);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const along = rotated ? y : x;
      const i = Math.floor((along - quiet) / module);
      if (i >= 0 && i < bars.length && bars[i] === '1') {
        const p = (y * width + x) * 4;
        data[p] = data[p + 1] = data[p + 2] = 20;
      }
    }
  }
  return encodeJpeg({ data, width, height }, 90).data.toString('base64');
}

test('reads an EAN-13 food barcode from a photo', () => {
  const code = withCheckDigit('505600000001');
  expect(barcodeFromJpegBase64(photoOf(code))).toBe(code);
});

test('reads it with the phone held the other way', () => {
  const code = withCheckDigit('761303523910');
  expect(barcodeFromJpegBase64(photoOf(code, { rotated: true }))).toBe(code);
});

test('reads a large photo (shrunk first, so it stays quick)', () => {
  const code = withCheckDigit('500015946112');
  expect(barcodeFromJpegBase64(photoOf(code, { module: 18 }))).toBe(code);
});

test('a photo with no barcode gives null rather than a guess', () => {
  const blank = encodeJpeg({ data: Buffer.alloc(200 * 120 * 4, 255), width: 200, height: 120 }, 90).data.toString('base64');
  expect(barcodeFromJpegBase64(blank)).toBeNull();
});

test('base64 decodes without atob or Buffer, with or without a data: prefix', () => {
  const bytes = Uint8Array.from([0, 1, 2, 250, 251, 252, 253]);
  const b64 = Buffer.from(bytes).toString('base64');
  expect(Array.from(base64ToBytes(b64))).toEqual(Array.from(bytes));
  expect(Array.from(base64ToBytes(`data:image/jpeg;base64,${b64}`))).toEqual(Array.from(bytes));
});

test('the camera picks a photo size that is quick to read', () => {
  expect(choosePictureSize(['4000x3000', '1920x1080', '640x480', '1280x720'])).toBe('1280x720');
  expect(choosePictureSize(['640x480', '800x600'])).toBe('800x600');
  expect(choosePictureSize(['nonsense'])).toBeUndefined();
});
