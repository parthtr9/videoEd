import { z } from 'zod';

export const AspectRatioSchema = z.enum(['16:9', '9:16', '1:1']);
export type AspectRatio = z.infer<typeof AspectRatioSchema>;

export const TemplateSchema = z.enum(['Minimal', 'Bold', 'Luxury']);
export type Template = z.infer<typeof TemplateSchema>;

export const ColorPaletteSchema = z.object({
  brand: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be hex color'),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  backgroundLight: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  backgroundDark: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  textOnLight: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  textOnDark: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type ColorPalette = z.infer<typeof ColorPaletteSchema>;

export const VideoPropsSchema = z.object({
  productImageUrl: z.string().url(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be 6-digit hex color'),
  headline: z.string().min(1).max(80),
  subheadline: z.string().max(160).optional(),
  voiceoverScript: z.string().max(500).optional(),
  narrationUrl: z.string().url().optional(),
  template: TemplateSchema,
  aspectRatio: AspectRatioSchema,
  palette: ColorPaletteSchema.optional(),
});
export type VideoProps = z.infer<typeof VideoPropsSchema>;

export const ASPECT_RATIO_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
};
