jest.mock('@remotion/lambda/client');
jest.mock('../lambda/uploadToS3');
jest.mock('fs');
jest.mock('../lambda/config', () => ({
  lambdaConfig: {
    AWS_ACCESS_KEY_ID: 'test-key',
    AWS_SECRET_ACCESS_KEY: 'test-secret',
    AWS_REGION: 'us-east-1',
    REMOTION_S3_BUCKET: 'videoed-renders-test',
    region: 'us-east-1',
  },
  DEPLOY_STATE_FILE: '.remotion-deploy.json',
}));

import fs from 'fs';
import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client';
import { uploadToS3 } from '../lambda/uploadToS3';

const mockRenderMedia = renderMediaOnLambda as jest.MockedFunction<typeof renderMediaOnLambda>;
const mockGetProgress = getRenderProgress as jest.MockedFunction<typeof getRenderProgress>;
const mockUpload = uploadToS3 as jest.MockedFunction<typeof uploadToS3>;
const fsMock = fs as jest.Mocked<typeof fs>;

const MOCK_JOB = {
  props: {
    productImageUrl: 'file:///fake/out/product_no_bg.png',
    brandColor: '#FF5500',
    headline: 'Buy Now',
    template: 'Minimal' as const,
    aspectRatio: '16:9' as const,
    palette: {
      brand: '#ff5500',
      accent: '#cc4400',
      backgroundLight: '#fff5f0',
      backgroundDark: '#1a0a00',
      textOnLight: '#1a0a00',
      textOnDark: '#fff5f0',
    },
  },
  processedImagePath: '/fake/out/product_no_bg.png',
  narrationPath: null,
};

const DEPLOY_STATE = {
  functionName: 'remotion-render-4-0-481',
  serveUrl: 'https://s3.us-east-1.amazonaws.com/remotionlambda-useast1-abc123/sites/videoed-site/index.html',
  bucketName: 'remotionlambda-useast1-abc123',
};

describe('renderJobOnLambda', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    // Mock deploy state file
    fsMock.existsSync = jest.fn().mockReturnValue(true);
    fsMock.readFileSync = jest.fn().mockReturnValue(JSON.stringify(DEPLOY_STATE));

    // Mock S3 upload
    mockUpload.mockResolvedValue('https://remotionlambda-useast1-abc123.s3.us-east-1.amazonaws.com/assets/product_no_bg.png');

    // Mock renderMediaOnLambda
    mockRenderMedia.mockResolvedValue({ renderId: 'render-abc123', bucketName: 'videoed-renders-parth' } as any);

    // Mock getRenderProgress — done on first poll
    mockGetProgress.mockResolvedValue({
      done: true,
      outputFile: 'https://remotionlambda-useast1-abc123.s3.us-east-1.amazonaws.com/renders/video.mp4',
      fatalErrorEncountered: false,
      errors: [],
    } as any);
  });

  it('throws if .remotion-deploy.json does not exist', async () => {
    fsMock.existsSync = jest.fn().mockReturnValue(false);
    const { renderJobOnLambda } = await import('../lambda/renderOnLambda');
    await expect(renderJobOnLambda(MOCK_JOB as any)).rejects.toThrow('npm run lambda:deploy');
  });

  it('uploads processed image to S3 before rendering', async () => {
    const { renderJobOnLambda } = await import('../lambda/renderOnLambda');
    await renderJobOnLambda(MOCK_JOB as any);
    expect(mockUpload).toHaveBeenCalledWith(
      expect.objectContaining({ localPath: MOCK_JOB.processedImagePath }),
    );
  });

  it('does not upload narration when narrationPath is null', async () => {
    const { renderJobOnLambda } = await import('../lambda/renderOnLambda');
    await renderJobOnLambda(MOCK_JOB as any);
    expect(mockUpload).toHaveBeenCalledTimes(1); // image only
  });

  it('uploads narration when narrationPath is set', async () => {
    mockUpload.mockResolvedValueOnce('https://bucket/assets/img.png');
    mockUpload.mockResolvedValueOnce('https://bucket/assets/narration.wav');
    const jobWithNarration = { ...MOCK_JOB, narrationPath: '/fake/out/product_narration.wav' };
    const { renderJobOnLambda } = await import('../lambda/renderOnLambda');
    await renderJobOnLambda(jobWithNarration as any);
    expect(mockUpload).toHaveBeenCalledTimes(2);
  });

  it('passes correct composition ID based on aspectRatio', async () => {
    const { renderJobOnLambda } = await import('../lambda/renderOnLambda');
    await renderJobOnLambda(MOCK_JOB as any);
    expect(mockRenderMedia).toHaveBeenCalledWith(
      expect.objectContaining({ composition: 'ProductVideo-16x9' }),
    );
  });

  it('returns S3 output URL from getRenderProgress', async () => {
    const { renderJobOnLambda } = await import('../lambda/renderOnLambda');
    const result = await renderJobOnLambda(MOCK_JOB as any);
    expect(result).toBe('https://remotionlambda-useast1-abc123.s3.us-east-1.amazonaws.com/renders/video.mp4');
  });

  it('throws when render encounters fatal error', async () => {
    mockGetProgress.mockResolvedValue({
      done: false,
      fatalErrorEncountered: true,
      errors: [{ message: 'Out of memory' }],
    } as any);
    const { renderJobOnLambda } = await import('../lambda/renderOnLambda');
    await expect(renderJobOnLambda(MOCK_JOB as any)).rejects.toThrow('Out of memory');
  });
});
