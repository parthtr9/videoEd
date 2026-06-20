import path from 'path';
import { z } from 'zod';
import {
  AspectRatioSchema,
  TemplateSchema,
  VideoProps,
  VideoPropsSchema,
} from '../schemas/videoProps';
import { removeBackground } from './backgroundRemoval';
import { derivePalette } from './colorDerivation';

export const JobInputSchema = z.object({
  productImagePath: z.string().min(1, 'productImagePath must not be empty'),
  outputDir: z.string().min(1, 'outputDir must not be empty'),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be 6-digit hex color'),
  headline: z.string().min(1).max(80),
  subheadline: z.string().max(160).optional(),
  voiceoverScript: z.string().max(500).optional(),
  template: TemplateSchema,
  aspectRatio: AspectRatioSchema,
});

export type JobInput = z.infer<typeof JobInputSchema>;

export interface VideoJob {
  props: VideoProps;
  processedImagePath: string;
}

export async function buildVideoJob(rawInput: unknown): Promise<VideoJob> {
  const input = JobInputSchema.parse(rawInput);

  const basename = path.basename(
    input.productImagePath,
    path.extname(input.productImagePath),
  );
  const processedImagePath = path.join(input.outputDir, `${basename}_no_bg.png`);

  // Both are independent — derive palette sync, remove bg async concurrently
  const palettePromise = Promise.resolve(derivePalette(input.brandColor));
  const bgPromise = removeBackground({
    inputPath: input.productImagePath,
    outputPath: processedImagePath,
  });

  const [palette, resolvedImagePath] = await Promise.all([palettePromise, bgPromise]);

  const props = VideoPropsSchema.parse({
    productImageUrl: `file://${resolvedImagePath}`,
    brandColor: input.brandColor,
    headline: input.headline,
    subheadline: input.subheadline,
    voiceoverScript: input.voiceoverScript,
    template: input.template,
    aspectRatio: input.aspectRatio,
    palette,
  });

  return { props, processedImagePath: resolvedImagePath };
}
