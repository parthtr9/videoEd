import path from 'path';

jest.mock('../pipeline/backgroundRemoval');
jest.mock('../pipeline/narration');

import { removeBackground } from '../pipeline/backgroundRemoval';
import { synthesizeSpeech } from '../pipeline/narration';
import { buildVideoJob, JobInputSchema } from '../pipeline/buildVideoJob';
import { derivePalette } from '../pipeline/colorDerivation';
import { VideoPropsSchema } from '../schemas/videoProps';

const mockRemoveBg = removeBackground as jest.MockedFunction<typeof removeBackground>;
const mockSynthesize = synthesizeSpeech as jest.MockedFunction<typeof synthesizeSpeech>;

const BASE_INPUT = {
  productImagePath: '/fake/product.jpg',
  outputDir: '/fake/out',
  brandColor: '#FF5500',
  headline: 'Buy This Now',
  template: 'Minimal' as const,
  aspectRatio: '16:9' as const,
};

describe('JobInputSchema', () => {
  it('accepts valid input', () => {
    expect(() => JobInputSchema.parse(BASE_INPUT)).not.toThrow();
  });

  it('rejects empty productImagePath', () => {
    expect(() => JobInputSchema.parse({ ...BASE_INPUT, productImagePath: '' })).toThrow();
  });

  it('rejects invalid brandColor', () => {
    expect(() => JobInputSchema.parse({ ...BASE_INPUT, brandColor: 'orange' })).toThrow();
    expect(() => JobInputSchema.parse({ ...BASE_INPUT, brandColor: '#FFF' })).toThrow();
  });

  it('rejects headline over 80 chars', () => {
    expect(() => JobInputSchema.parse({ ...BASE_INPUT, headline: 'A'.repeat(81) })).toThrow();
  });

  it('rejects invalid template', () => {
    expect(() => JobInputSchema.parse({ ...BASE_INPUT, template: 'Trendy' })).toThrow();
  });

  it('rejects invalid aspectRatio', () => {
    expect(() => JobInputSchema.parse({ ...BASE_INPUT, aspectRatio: '4:3' })).toThrow();
  });
});

describe('buildVideoJob', () => {
  const RESOLVED_PATH = '/fake/out/product_no_bg.png';

  const RESOLVED_NARRATION = '/fake/out/product_narration.wav';

  beforeEach(() => {
    jest.resetAllMocks();
    mockRemoveBg.mockResolvedValue(RESOLVED_PATH);
    mockSynthesize.mockResolvedValue(RESOLVED_NARRATION);
  });

  it('throws on invalid raw input (Zod)', async () => {
    await expect(buildVideoJob({ ...BASE_INPUT, brandColor: 'bad' })).rejects.toThrow();
  });

  it('calls removeBackground with correct inputPath and derived outputPath', async () => {
    await buildVideoJob(BASE_INPUT);
    expect(mockRemoveBg).toHaveBeenCalledTimes(1);
    expect(mockRemoveBg).toHaveBeenCalledWith({
      inputPath: BASE_INPUT.productImagePath,
      outputPath: path.join(BASE_INPUT.outputDir, 'product_no_bg.png'),
    });
  });

  it('returned props pass VideoPropsSchema', async () => {
    const { props } = await buildVideoJob(BASE_INPUT);
    expect(() => VideoPropsSchema.parse(props)).not.toThrow();
  });

  it('productImageUrl is a file:// URL pointing to the resolved image path', async () => {
    const { props } = await buildVideoJob(BASE_INPUT);
    expect(props.productImageUrl).toBe(`file://${RESOLVED_PATH}`);
  });

  it('palette in returned props matches derivePalette output', async () => {
    const { props } = await buildVideoJob(BASE_INPUT);
    const expected = derivePalette(BASE_INPUT.brandColor);
    expect(props.palette).toEqual(expected);
  });

  it('processedImagePath matches the path returned by removeBackground', async () => {
    const { processedImagePath } = await buildVideoJob(BASE_INPUT);
    expect(processedImagePath).toBe(RESOLVED_PATH);
  });

  it('bubbles up removeBackground errors', async () => {
    mockRemoveBg.mockRejectedValue(new Error('rembg failed: model not found'));
    await expect(buildVideoJob(BASE_INPUT)).rejects.toThrow('rembg failed');
  });

  it('includes optional subheadline and voiceoverScript in props when provided', async () => {
    const input = { ...BASE_INPUT, subheadline: 'Great deal', voiceoverScript: 'Buy now' };
    const { props } = await buildVideoJob(input);
    expect(props.subheadline).toBe('Great deal');
    expect(props.voiceoverScript).toBe('Buy now');
  });

  it('optional fields are undefined in props when not provided', async () => {
    const { props } = await buildVideoJob(BASE_INPUT);
    expect(props.subheadline).toBeUndefined();
    expect(props.voiceoverScript).toBeUndefined();
  });

  it('does not call synthesizeSpeech when voiceoverScript is omitted', async () => {
    await buildVideoJob(BASE_INPUT);
    expect(mockSynthesize).not.toHaveBeenCalled();
  });

  it('calls synthesizeSpeech with correct text when voiceoverScript provided', async () => {
    const input = { ...BASE_INPUT, voiceoverScript: 'Buy now.' };
    await buildVideoJob(input);
    expect(mockSynthesize).toHaveBeenCalledTimes(1);
    expect(mockSynthesize).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Buy now.' }),
    );
  });

  it('narrationPath is null when voiceoverScript omitted', async () => {
    const { narrationPath } = await buildVideoJob(BASE_INPUT);
    expect(narrationPath).toBeNull();
  });

  it('narrationPath is set and narrationUrl in props when voiceoverScript provided', async () => {
    const input = { ...BASE_INPUT, voiceoverScript: 'Buy now.' };
    const { props, narrationPath } = await buildVideoJob(input);
    expect(narrationPath).toBe(RESOLVED_NARRATION);
    expect(props.narrationUrl).toBe(`file://${RESOLVED_NARRATION}`);
  });

  it('bubbles up synthesizeSpeech errors', async () => {
    const input = { ...BASE_INPUT, voiceoverScript: 'Buy now.' };
    mockSynthesize.mockRejectedValue(new Error('Piper failed: model missing'));
    await expect(buildVideoJob(input)).rejects.toThrow('Piper failed');
  });
});
