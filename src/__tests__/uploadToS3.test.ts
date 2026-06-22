jest.mock('@aws-sdk/client-s3');
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
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const fsMock = fs as jest.Mocked<typeof fs>;
const MockS3Client = S3Client as jest.MockedClass<typeof S3Client>;

describe('uploadToS3', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    fsMock.existsSync = jest.fn().mockReturnValue(true);
    fsMock.readFileSync = jest.fn().mockReturnValue(Buffer.from('fake-image-data'));
    MockS3Client.prototype.send = jest.fn().mockResolvedValue({});
  });

  const BUCKET = 'remotionlambda-useast1-abc123';

  it('throws if local file does not exist', async () => {
    fsMock.existsSync = jest.fn().mockReturnValue(false);
    const { uploadToS3 } = await import('../lambda/uploadToS3');
    await expect(uploadToS3({ localPath: '/fake/img.png', s3Key: 'assets/img.png', bucketName: BUCKET }))
      .rejects.toThrow('file not found');
  });

  it('throws Zod error if localPath is empty', async () => {
    const { uploadToS3 } = await import('../lambda/uploadToS3');
    await expect(uploadToS3({ localPath: '', s3Key: 'assets/img.png', bucketName: BUCKET })).rejects.toThrow();
  });

  it('calls S3 PutObjectCommand with correct bucket and key', async () => {
    const { uploadToS3 } = await import('../lambda/uploadToS3');
    await uploadToS3({ localPath: '/fake/img.png', s3Key: 'assets/img.png', bucketName: BUCKET });
    expect(MockS3Client.prototype.send).toHaveBeenCalledTimes(1);
    const MockPutCmd = PutObjectCommand as jest.MockedClass<typeof PutObjectCommand>;
    const ctorArgs = MockPutCmd.mock.calls[0][0];
    expect(ctorArgs.Key).toBe('assets/img.png');
    expect(ctorArgs.Bucket).toBe(BUCKET);
  });

  it('returns correct S3 HTTPS URL', async () => {
    const { uploadToS3 } = await import('../lambda/uploadToS3');
    const url = await uploadToS3({ localPath: '/fake/img.png', s3Key: 'assets/img.png', bucketName: BUCKET });
    expect(url).toMatch(/^https:\/\/.+\.s3\..+\.amazonaws\.com\/assets\/img\.png$/);
  });

  it('sets correct content-type for PNG', async () => {
    const { uploadToS3 } = await import('../lambda/uploadToS3');
    await uploadToS3({ localPath: '/fake/img.png', s3Key: 'assets/img.png', bucketName: BUCKET });
    const MockPutCmd = PutObjectCommand as jest.MockedClass<typeof PutObjectCommand>;
    expect(MockPutCmd.mock.calls[0][0].ContentType).toBe('image/png');
  });

  it('sets correct content-type for WAV', async () => {
    const { uploadToS3 } = await import('../lambda/uploadToS3');
    await uploadToS3({ localPath: '/fake/narration.wav', s3Key: 'assets/narration.wav', bucketName: BUCKET });
    const MockPutCmd = PutObjectCommand as jest.MockedClass<typeof PutObjectCommand>;
    expect(MockPutCmd.mock.calls[0][0].ContentType).toBe('audio/wav');
  });
});
