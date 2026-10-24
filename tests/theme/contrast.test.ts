import { palettes, type ThemeName } from '@/theme/tokens';

/** WCAG contrast ratio of two #RRGGBB colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl);
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

describe.each(['dark', 'light'] as ThemeName[])('%s Ember text is readable (4.5:1)', (theme) => {
  const c = palettes[theme];
  test.each([
    ['text on background', c.text, c.bg],
    ['secondary text on cards', c.text2, c.card],
    ['accent text on cards', c.accent, c.card],
    ['text on accent buttons', c.onAccent, c.accent],
    ['protein on cards', c.pro, c.card],
    ['calories on cards', c.kcal, c.card],
  ])('%s', (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
