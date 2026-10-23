import { contrastRatio } from '@/theme/contrast';
import { palettes, type ThemeName } from '@/theme/tokens';

describe('contrastRatio', () => {
  test('white on black is 21:1', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
  });

  test('identical colours are 1:1', () => {
    expect(contrastRatio('#5E5E66', '#5E5E66')).toBeCloseTo(1, 5);
  });

  test('order of arguments does not matter', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  test('rejects non-hex input', () => {
    expect(() => contrastRatio('rgba(0,0,0,0.5)', '#FFFFFF')).toThrow();
  });
});

const pairs: [fg: keyof (typeof palettes)['dark'], bg: keyof (typeof palettes)['dark']][] = [
  ['text', 'bg'],
  ['text', 'card'],
  ['text', 'sheet'],
  ['text', 'well'],
  ['text2', 'bg'],
  ['text2', 'card'],
  ['text2', 'well'],
  ['pro', 'card'],
  ['pro', 'bg'],
  ['onAccent', 'pro'],
  ['kcal', 'card'],
  ['danger', 'card'],
  ['danger', 'sheet'],
];

describe.each<ThemeName>(['dark', 'light'])('%s palette meets WCAG AA for text', (name) => {
  test.each(pairs)('%s on %s ≥ 4.5:1', (fg, bg) => {
    expect(contrastRatio(palettes[name][fg], palettes[name][bg])).toBeGreaterThanOrEqual(4.5);
  });
});
