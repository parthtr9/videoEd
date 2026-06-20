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
import { synthesizeSpeech, DEFAULT_MODEL_PATH } from './narration';

export const JobInputSchema = z.object({
  productImagePath: z.string().min(1, 'productImagePath must not be empty'),
  outputDir: z.string().min(1, 'outputDir must not be empty'),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be 6-digit hex color'),
  headline: z.string().min(1).max(80),
  subheadline: z.string().max(160).optional(),
  voiceoverScript: z.string().max(500).optional(),
  template: TemplateSchema,
  aspectRatio: AspectRatioSchema,
  modelPath: z.string().optional(),
});

export type JobInput = z.infer<typeof JobInputSchema>;

export interface VideoJob {
  props: VideoProps;
  processedImagePath: string;
  narrationPath: string | null;
}

export async function buildVideoJob(rawInput: unknown): Promise<VideoJob> {
  const input = JobInputSchema.parse(rawInput);

  const basename = path.basename(
    input.productImagePath,
    path.extname(input.productImagePath),
  );
  const processedImagePath = path.join(input.outputDir, `${basename}_no_bg.png`);

  // Palette is sync and instant — start bg removal async immediately
  const palette = derivePalette(input.brandColor);
  const bgPromise = removeBackground({
    inputPath: input.productImagePath,
    outputPath: processedImagePath,
  });

  // Narration runs concurrently with bg removal if script provided
  const narrationPath = input.voiceoverScript
    ? path.join(input.outputDir, `${basename}_narration.wav`)
    : null;

  const narrationPromise = narrationPath
    ? synthesizeSpeech({
        text: input.voiceoverScript!,
        outputPath: narrationPath,
        modelPath: input.modelPath ?? DEFAULT_MODEL_PATH,
      })
    : Promise.resolve(null);

  const [resolvedImagePath, resolvedNarrationPath] = await Promise.all([
    bgPromise,
    narrationPromise,
  ]);

  const props = VideoPropsSchema.parse({
    productImageUrl: `file://${resolvedImagePath}`,
    brandColor: input.brandColor,
    headline: input.headline,
    subheadline: input.subheadline,
    voiceoverScript: input.voiceoverScript,
    narrationUrl: resolvedNarrationPath ? `file://${resolvedNarrationPath}` : undefined,
    template: input.template,
    aspectRatio: input.aspectRatio,
    palette,
  });

  return {
    props,
    processedImagePath: resolvedImagePath,
    narrationPath: resolvedNarrationPath,
  };
}
