jest.mock('../lambda/uploadToS3');
jest.mock('../lambda/config', () => ({
  lambdaConfig: { region: 'us-east-1', AWS_ACCESS_KEY_ID: 'k', AWS_SECRET_ACCESS_KEY: 's', AWS_REGION: 'us-east-1' },
  DEPLOY_STATE_FILE: '.remotion-deploy.json',
}));
jest.mock('fs');
jest.mock('crypto', () => ({ ...jest.requireActual('crypto'), randomUUID: () => 'test-uuid' }));

import fs from 'fs';
import { uploadToS3 } from '../lambda/uploadToS3';
import { NextRequest } from 'next/server';

const fsMock = fs as jest.Mocked<typeof fs>;
const mockUpload = uploadToS3 as jest.MockedFunction<typeof uploadToS3>;

const DEPLOY_STATE = JSON.stringify({ functionName: 'fn', serveUrl: 'https://x', bucketName: 'my-bucket' });

function makeUploadRequest(hasFile: boolean): NextRequest {
  const fd = new FormData();
  if (hasFile) {
    fd.append('image', new Blob(['fake-image'], { type: 'image/png' }), 'product.png');
  }
  return new NextRequest('http://localhost/api/upload', { method: 'POST', body: fd });
}

describe('POST /api/upload', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    fsMock.existsSync = jest.fn().mockReturnValue(true);
    fsMock.readFileSync = jest.fn().mockReturnValue(DEPLOY_STATE);
    fsMock.writeFileSync = jest.fn();
    fsMock.rmSync = jest.fn();
    mockUpload.mockResolvedValue('https://my-bucket.s3.us-east-1.amazonaws.com/uploads/test-uuid.png');
  });

  it('returns 400 when no image field in form data', async () => {
    const { POST } = await import('../../app/api/upload/route');
    const res = await POST(makeUploadRequest(false));
    expect(res.status).toBe(400);
  });

  it('returns 200 with S3 URL on success', async () => {
    const { POST } = await import('../../app/api/upload/route');
    const res = await POST(makeUploadRequest(true));
    expect(res.status).toBe(200);
    const data = await res.json() as { url: string };
    expect(data.url).toMatch(/^https:\/\//);
  });

  it('calls uploadToS3 with correct bucket from deploy state', async () => {
    const { POST } = await import('../../app/api/upload/route');
    await POST(makeUploadRequest(true));
    expect(mockUpload).toHaveBeenCalledWith(
      expect.objectContaining({ bucketName: 'my-bucket' }),
    );
  });

  it('returns 500 when deploy state is missing', async () => {
    fsMock.existsSync = jest.fn().mockReturnValue(false);
    const { POST } = await import('../../app/api/upload/route');
    const res = await POST(makeUploadRequest(true));
    expect(res.status).toBe(500);
    const data = await res.json() as { error: string };
    expect(data.error).toMatch(/lambda:deploy/);
  });

  it('cleans up temp file after upload', async () => {
    const { POST } = await import('../../app/api/upload/route');
    await POST(makeUploadRequest(true));
    expect(fsMock.rmSync).toHaveBeenCalled();
  });
});
