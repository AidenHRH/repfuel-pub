import type { TextStyle } from 'react-native';

export type ThemeName = 'dark' | 'light';

export type Palette = {
  bg: string;
  card: string;
  well: string;
  seg: string;
  sheet: string;
  text: string;
  text2: string;
  sep: string;
  kcal: string;
  /** Protein: its numbers, bars and rings. */
  pro: string;
  /** Actions: buttons, links, selected pills, the active tab. */
  accent: string;
  /** Text and icons on an accent fill. */
  onAccent: string;
  scrim: string;
  track: string;
  bar: string;
  danger: string;
  /** Progress going the right way (a gain, effort easing). */
  up: string;
  /** Ring fills: not text, so they can be brighter than the text colours in light mode. */
  ringKcal: string;
  ringPro: string;
  /** Personal records: gold text, its tinted background, and text on a gold fill. */
  pr: string;
  prBg: string;
  onPr: string;
  /** How hard a set or class felt, and classes in the training feed. */
  effort: string;
  effortBg: string;
  onEffort: string;
  /** The tour's dimmed screen around the spotlight. */
  spotlight: string;
  /** Text on the effort scale's fills (see `effortScales`). */
  onEffortScale: string;
};

// Ember (2026-10-24): coral for actions, teal for protein, amber for calories. Values match the approved mockup. Every screen takes colours from here.
export const palettes: Record<ThemeName, Palette> = {
  dark: {
    bg: '#141414',
    card: '#1F1F1F',
    well: '#2E2E2E',
    seg: '#5A5552',
    sheet: '#1F1F1F',
    text: '#F7F3F0',
    text2: '#ADA5A0',
    sep: 'rgba(255,255,255,0.08)',
    kcal: '#FFB547',
    pro: '#2EC4B6',
    accent: '#FF6B4A',
    onAccent: '#1A0A05',
    scrim: 'rgba(0,0,0,0.55)',
    track: 'rgba(255,255,255,0.10)',
    bar: 'rgba(26,26,26,0.9)',
    danger: '#FF7B72',
    up: '#30D158',
    ringKcal: '#FFB547',
    ringPro: '#2EC4B6',
    pr: '#FFD25A',
    prBg: '#3A3012',
    onPr: '#1A1400',
    effort: '#FF8A5C',
    effortBg: '#3A1A12',
    onEffort: '#1A0A04',
    spotlight: 'rgba(0,0,0,0.74)',
    onEffortScale: '#0B0B0C',
  },
  light: {
    bg: '#FAF6F3',
    card: '#FFFFFF',
    well: '#F2ECE8',
    seg: '#FFFFFF',
    sheet: '#FFFFFF',
    text: '#1A1412',
    text2: '#665A54',
    sep: 'rgba(0,0,0,0.08)',
    kcal: '#A85A00',
    pro: '#0D7369',
    accent: '#C23B1A',
    onAccent: '#FFFFFF',
    scrim: 'rgba(0,0,0,0.28)',
    track: 'rgba(0,0,0,0.08)',
    bar: 'rgba(250,246,243,0.92)',
    danger: '#C42B1C',
    up: '#167A35',
    ringKcal: '#F5A524',
    ringPro: '#14A394',
    pr: '#7A5A00',
    prBg: '#FFF4CC',
    onPr: '#FFFFFF',
    effort: '#B8440F',
    effortBg: '#FDE7DC',
    onEffort: '#FFFFFF',
    spotlight: 'rgba(0,0,0,0.58)',
    onEffortScale: '#FFFFFF',
  },
};

/** Effort 1–10, from easy (green) to nothing left (red): one fill per level. */
export const effortScales: Record<ThemeName, readonly string[]> = {
  dark: ['#30D158', '#5DD553', '#8AD84E', '#B5DA48', '#DFD843', '#FFC93F', '#FFA53B', '#FF8136', '#FF5E32', '#FF3B30'],
  light: ['#1F9D45', '#46A73F', '#6DAF38', '#94B532', '#BAB52C', '#D9A526', '#E58A20', '#E8691C', '#E54A1A', '#D92C1A'],
};

// Android cannot synthesise weights for custom fonts, so each weight is its own family.
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export type TypeVariant = 'largeTitle' | 'title' | 'headline' | 'body' | 'callout' | 'caption' | 'micro' | 'overline';

export const type: Record<TypeVariant, TextStyle> = {
  largeTitle: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 41, letterSpacing: -0.85 },
  title: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 25, letterSpacing: -0.3 },
  headline: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
  callout: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  micro: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 13 },
  overline: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, letterSpacing: 0.8, textTransform: 'uppercase' },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, section: 28 } as const;

export const radii = { control: 12, card: 18, hero: 22, sheet: 26, pill: 999 } as const;

export const motion = { fast: 150, standard: 220, ring: 480 } as const;

export const layout = { gutter: 20, minTouch: 44, tabBarHeight: 64 } as const;

/**
 * Health colours. Nutri-Score uses its official A–E colours (people recognise them from packs); the verdict
 * uses the same family. White text reads on all of them except C, which takes dark text.
 */
export const health = {
  nutriscore: { a: '#038141', b: '#85BB2F', c: '#FECB02', d: '#EE8100', e: '#E63E11' },
  nutriscoreText: { a: '#FFFFFF', b: '#FFFFFF', c: '#1A1A1A', d: '#FFFFFF', e: '#FFFFFF' },
  verdict: { good: '#038141', okay: '#EE8100', poor: '#E63E11' },
} as const;
