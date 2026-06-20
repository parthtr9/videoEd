import { parse, oklch, formatHex, clampChroma } from 'culori';
import chroma from 'chroma-js';
import { ColorPalette } from '../schemas/videoProps';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function toHex(l: number, c: number, h: number | undefined): string {
  const clamped = clampChroma({ mode: 'oklch' as const, l, c, h }, 'oklch');
  const hex = formatHex(clamped);
  if (!hex) throw new Error(`culori failed to format oklch(${l}, ${c}, ${h})`);
  return hex;
}

function pickReadable(candidates: string[], bg: string): string {
  for (const candidate of candidates) {
    if (chroma.contrast(candidate, bg) >= 4.5) return candidate;
  }
  return chroma.contrast('#000000', bg) >= chroma.contrast('#ffffff', bg) ? '#000000' : '#ffffff';
}

export function derivePalette(brandHex: string): ColorPalette {
  if (!HEX_RE.test(brandHex)) {
    throw new Error(`derivePalette: invalid hex "${brandHex}". Must be 6-digit hex like #FF5500`);
  }

  const parsed = parse(brandHex);
  if (!parsed) throw new Error(`derivePalette: culori could not parse "${brandHex}"`);

  const base = oklch(parsed);
  if (!base) throw new Error(`derivePalette: culori could not convert "${brandHex}" to OKLCH`);

  const { l, c, h } = base;
  const baseChroma = c ?? 0;

  // Accent: deeper, slightly more saturated variant — pops for CTAs
  const accentL = Math.max(0.2, l - 0.1);
  const accentC = Math.min(0.4, baseChroma * 1.2);
  const accent = toHex(accentL, accentC, h);

  // Backgrounds: near-white and near-black with subtle hue echo
  const bgLightHex = toHex(0.97, Math.min(0.025, baseChroma * 0.12), h);
  const bgDarkHex = toHex(0.11, Math.min(0.04, baseChroma * 0.18), h);

  // Text on light bg: dark near-black with brand hue, fallback to pure black
  const textOnLight = pickReadable(
    [
      toHex(0.18, Math.min(0.05, baseChroma * 0.25), h),
      '#1a1a1a',
      '#000000',
    ],
    bgLightHex,
  );

  // Text on dark bg: light near-white with brand hue, fallback to pure white
  const textOnDark = pickReadable(
    [
      toHex(0.94, Math.min(0.04, baseChroma * 0.2), h),
      '#f2f2f2',
      '#ffffff',
    ],
    bgDarkHex,
  );

  return {
    brand: brandHex.toLowerCase(),
    accent,
    backgroundLight: bgLightHex,
    backgroundDark: bgDarkHex,
    textOnLight,
    textOnDark,
  };
}
