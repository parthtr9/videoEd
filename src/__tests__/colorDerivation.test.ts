import chroma from 'chroma-js';
import { derivePalette } from '../pipeline/colorDerivation';
import { ColorPaletteSchema } from '../schemas/videoProps';

const HEX_RE = /^#[0-9a-fA-F]{6}$/i;

function contrastRatio(a: string, b: string): number {
  return chroma.contrast(a, b);
}

describe('derivePalette', () => {
  const TEST_COLORS = [
    '#0066FF', // vivid blue
    '#FF5500', // orange
    '#00C853', // green
    '#9C27B0', // purple
    '#F44336', // red
    '#212121', // near-black (low chroma)
    '#FAFAFA', // near-white (low chroma)
    '#FF0080', // hot pink
  ];

  it('throws on invalid hex input', () => {
    expect(() => derivePalette('red')).toThrow();
    expect(() => derivePalette('#FFF')).toThrow();
    expect(() => derivePalette('#GGGGGG')).toThrow();
    expect(() => derivePalette('')).toThrow();
  });

  it('returns object that passes ColorPaletteSchema for all test colors', () => {
    for (const hex of TEST_COLORS) {
      const palette = derivePalette(hex);
      expect(() => ColorPaletteSchema.parse(palette)).not.toThrow();
    }
  });

  it('all returned values are valid 6-digit hex strings', () => {
    for (const hex of TEST_COLORS) {
      const palette = derivePalette(hex);
      for (const [key, value] of Object.entries(palette)) {
        expect(HEX_RE.test(value)).toBe(true);
      }
    }
  });

  it('brand field equals input (lowercased)', () => {
    expect(derivePalette('#FF5500').brand).toBe('#ff5500');
    expect(derivePalette('#0066ff').brand).toBe('#0066ff');
  });

  it('textOnLight has ≥4.5:1 contrast against backgroundLight (WCAG AA)', () => {
    for (const hex of TEST_COLORS) {
      const { textOnLight, backgroundLight } = derivePalette(hex);
      const ratio = contrastRatio(textOnLight, backgroundLight);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('textOnDark has ≥4.5:1 contrast against backgroundDark (WCAG AA)', () => {
    for (const hex of TEST_COLORS) {
      const { textOnDark, backgroundDark } = derivePalette(hex);
      const ratio = contrastRatio(textOnDark, backgroundDark);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('backgroundLight is visually light (perceived lightness > 0.85)', () => {
    for (const hex of TEST_COLORS) {
      const { backgroundLight } = derivePalette(hex);
      const [, , l] = chroma(backgroundLight).hsl();
      expect(l).toBeGreaterThan(0.85);
    }
  });

  it('backgroundDark is visually dark (perceived lightness < 0.25)', () => {
    for (const hex of TEST_COLORS) {
      const { backgroundDark } = derivePalette(hex);
      const [, , l] = chroma(backgroundDark).hsl();
      expect(l).toBeLessThan(0.25);
    }
  });

  it('accent is distinct from brand (not identical hex)', () => {
    const vivid = ['#0066FF', '#FF5500', '#00C853', '#9C27B0'];
    for (const hex of vivid) {
      const { brand, accent } = derivePalette(hex);
      expect(accent).not.toBe(brand);
    }
  });
});
