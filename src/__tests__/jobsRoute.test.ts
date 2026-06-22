jest.mock('../queue/enqueueJob');
jest.mock('../queue/config', () => ({
  getQueueConfig: () => ({
    AWS_ACCESS_KEY_ID: 'test-key',
    AWS_SECRET_ACCESS_KEY: 'test-secret',
    AWS_REGION: 'us-east-1',
    SQS_QUEUE_URL: 'https://sqs.us-east-1.amazonaws.com/123/videoed-jobs',
  }),
}));

import { enqueueJob } from '../queue/enqueueJob';
import { NextRequest } from 'next/server';

const mockEnqueue = enqueueJob as jest.MockedFunction<typeof enqueueJob>;

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  productImagePath: '/fake/product.jpg',
  outputDir: '/fake/out',
  brandColor: '#FF5500',
  headline: 'Buy Now',
  template: 'Minimal',
  aspectRatio: '16:9',
};

describe('POST /api/jobs', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns 200 with messageId on success', async () => {
    mockEnqueue.mockResolvedValue('msg-abc-123');
    const { POST } = await import('../../app/api/jobs/route');
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const data = await res.json() as { messageId: string };
    expect(data.messageId).toBe('msg-abc-123');
  });

  it('returns 400 when body is not JSON', async () => {
    const { POST } = await import('../../app/api/jobs/route');
    const req = new NextRequest('http://localhost/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when enqueueJob throws validation error', async () => {
    mockEnqueue.mockRejectedValue(new Error('invalid brandColor'));
    const { POST } = await import('../../app/api/jobs/route');
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
  });

  it('returns 500 when enqueueJob throws non-validation error', async () => {
    mockEnqueue.mockRejectedValue(new Error('SQS connection refused'));
    const { POST } = await import('../../app/api/jobs/route');
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
  });

  it('calls enqueueJob with parsed body', async () => {
    mockEnqueue.mockResolvedValue('msg-xyz');
    const { POST } = await import('../../app/api/jobs/route');
    await POST(makeRequest(VALID_BODY));
    expect(mockEnqueue).toHaveBeenCalledWith(VALID_BODY);
  });
});
