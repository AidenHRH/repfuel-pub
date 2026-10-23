/** Enough of a search hit to rank it. */
type Rankable = {
  imageUrl: string | null;
  draft: { name: string | null; brand: string | null; nutrients: { kcal: number | null; proteinG: number | null } };
};

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
// "Kit Kat" and "KitKat" are the same thing to someone searching.
const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Orders shop results so the best match is first: the most typed words present (in the name or brand), then a
 * name that starts with what was typed, then complete nutrition and a picture. Ties keep the search's own order.
 */
export function rankHits<T extends Rankable>(hits: T[], query: string): T[] {
  const typed = words(query);
  const whole = squash(query);
  const score = (h: T) => {
    const name = h.draft.name ?? '';
    const haystack = squash(`${name} ${h.draft.brand ?? ''}`);
    const missing = typed.filter((w) => !haystack.includes(squash(w))).length;
    let s = typed.length ? (10 * missing) / typed.length : 0;
    if (squash(name).startsWith(whole)) s -= 3;
    else if (squash(name).includes(whole)) s -= 2;
    // People type the main word first ("kitkat chunky"), so a name starting with it ranks above one that doesn't.
    else if (typed.length && squash(name).startsWith(squash(typed[0]))) s -= 1;
    if (h.draft.nutrients.kcal === null || h.draft.nutrients.proteinG === null) s += 0.5;
    if (!h.imageUrl) s += 0.25;
    return s;
  };
  return hits
    .map((h, i) => ({ h, i, s: score(h) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map(({ h }) => h);
}
