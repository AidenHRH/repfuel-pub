/** Geometry for the hand-drawn charts: where each value sits, sensible axis bounds, and month labels. */

export type Point = { i: number; x: number; y: number };

/** Points spread evenly across `width`, values mapped onto `height` (top is `max`). Unknown values get no point. */
export function plot(values: (number | null)[], width: number, height: number, b: { min: number; max: number }): Point[] {
  const span = b.max - b.min;
  return values.flatMap((v, i) => {
    if (v === null) return [];
    const x = values.length === 1 ? width / 2 : (i / (values.length - 1)) * width;
    const y = span === 0 ? height / 2 : height - ((v - b.min) / span) * height;
    return [{ i, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }];
  });
}

function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return p * (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10);
}

/** Axis bounds around the values with a little room, on round steps, kept within `floor`/`ceil`. */
export function niceBounds(
  values: (number | null)[],
  opts: { floor?: number; ceil?: number; minStep?: number } = {},
): { min: number; max: number } {
  const known = values.filter((v): v is number => v !== null);
  if (!known.length) {
    const min = opts.floor ?? 0;
    return { min, max: min + 1 };
  }
  const lo = Math.min(...known);
  const hi = Math.max(...known);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.1;
  const step = Math.max(niceStep((hi - lo || Math.abs(hi) || 1) / 5), opts.minStep ?? 0);
  let min = Math.floor((lo - pad) / step) * step;
  let max = Math.ceil((hi + pad) / step) * step;
  if (opts.floor !== undefined) min = Math.max(min, opts.floor);
  if (opts.ceil !== undefined) max = Math.min(max, opts.ceil);
  if (max <= min) max = min + step;
  const tidy = (x: number) => Math.round(x * 1000) / 1000;
  return { min: tidy(min), max: tidy(max) };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A label at the first week (Monday key) of each month. */
export function monthTicks(weeks: string[]): { i: number; label: string }[] {
  const out: { i: number; label: string }[] = [];
  let last = '';
  weeks.forEach((w, i) => {
    const month = w.slice(0, 7);
    if (month === last) return;
    last = month;
    out.push({ i, label: MONTHS[Number(month.slice(5, 7)) - 1] });
  });
  return out;
}
