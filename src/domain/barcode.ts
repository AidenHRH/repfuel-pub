/**
 * Normalises a scanned or typed retail barcode (EAN-8/13, UPC-A/E, GTIN-14) so the same product
 * matches however it was read: spaces and hyphens are ignored, and zero-padded 13/14-digit forms
 * become the 12/13-digit code.
 */
export function normaliseBarcode(raw: string): string | null {
  let digits = raw.replace(/[\s-]/g, '');
  if (!/^\d{8,14}$/.test(digits)) return null;
  // GTIN-14 and EAN-13 forms padded with leading zeros are the same product as the shorter code.
  while (digits.length > 12 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}
