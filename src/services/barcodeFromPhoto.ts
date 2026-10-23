import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatOneDReader,
  RGBLuminanceSource,
} from '@zxing/library';
import { decode as decodeJpeg } from 'jpeg-js';

// Reads a food barcode from a photo entirely in JavaScript, so it needs neither Google Play services nor the
// camera library's own scanner (which never reported a barcode on the owner's phone).

const FORMATS = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E];
// Big enough for a barcode filling part of the frame, small enough to decode in well under a second.
const MAX_SIDE = 1400;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX = new Map([...B64].map((c, i) => [c, i]));

/** Base64 (with or without a data: prefix) to bytes, without relying on atob or Buffer. */
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/^data:[^,]*,/, '').replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64_INDEX.get(clean[i]) ?? 0;
    const b = B64_INDEX.get(clean[i + 1]) ?? 0;
    const c = B64_INDEX.get(clean[i + 2]);
    const d = B64_INDEX.get(clean[i + 3]);
    out[o++] = (a << 2) | (b >> 4);
    if (c !== undefined) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (d !== undefined && c !== undefined) out[o++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, o);
}

type Gray = { pixels: Uint8ClampedArray; width: number; height: number };

/** Greyscale, shrunk by whole steps so the longest side is at most MAX_SIDE. */
function toGray(rgba: Uint8Array, width: number, height: number): Gray {
  const step = Math.max(1, Math.ceil(Math.max(width, height) / MAX_SIDE));
  const w = Math.floor(width / step);
  const h = Math.floor(height / step);
  const pixels = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * step * width + x * step) * 4;
      pixels[y * w + x] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
    }
  }
  return { pixels, width: w, height: h };
}

/** The image turned a quarter, for barcodes photographed with the phone held the other way. */
function rotate(g: Gray): Gray {
  const pixels = new Uint8ClampedArray(g.pixels.length);
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) pixels[x * g.height + (g.height - 1 - y)] = g.pixels[y * g.width + x];
  }
  return { pixels, width: g.height, height: g.width };
}

const HINTS = new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, FORMATS],
  [DecodeHintType.TRY_HARDER, true],
]);

function read(g: Gray): string | null {
  // Only the 1D retail barcodes food packs use: quicker, and no time spent looking for QR-style codes.
  const reader = new MultiFormatOneDReader(HINTS);
  try {
    const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(g.pixels, g.width, g.height)));
    return reader.decode(bitmap, HINTS).getText();
  } catch {
    return null; // ZXing throws when there's no barcode to read.
  }
}

/** The food barcode in a JPEG photo (base64), or null if none could be read. */
export function barcodeFromJpegBase64(base64: string): string | null {
  const image = decodeJpeg(base64ToBytes(base64), { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 });
  const gray = toGray(image.data, image.width, image.height);
  return read(gray) ?? read(rotate(gray));
}

/** A photo size big enough to read a barcode but quick to decode: the smallest with a long side of 1,280+. */
export function choosePictureSize(sizes: string[]): string | undefined {
  const parsed = sizes
    .map((s) => ({ s, dims: s.split('x').map(Number) }))
    .filter(({ dims }) => dims.length === 2 && dims.every((n) => Number.isFinite(n) && n > 0))
    .map(({ s, dims }) => ({ s, long: Math.max(dims[0], dims[1]) }))
    .sort((a, b) => a.long - b.long);
  return (parsed.find((p) => p.long >= 1280) ?? parsed[parsed.length - 1])?.s;
}
