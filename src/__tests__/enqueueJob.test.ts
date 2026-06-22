jest.mock('@aws-sdk/client-sqs');
jest.mock('../queue/config', () => ({
  getQueueConfig: () => ({
    AWS_ACCESS_KEY_ID: 'test-key',
    AWS_SECRET_ACCESS_KEY: 'test-secret',
    AWS_REGION: 'us-east-1',
    SQS_QUEUE_URL: 'https://sqs.us-east-1.amazonaws.com/123456789/videoed-jobs',
  }),
}));

import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const MockSQSClient = SQSClient as jest.MockedClass<typeof SQSClient>;

const VALID_INPUT = {
  productImagePath: '/fake/product.jpg',
  outputDir: '/fake/out',
  brandColor: '#FF5500',
  headline: 'Buy Now',
  template: 'Minimal' as const,
  aspectRatio: '16:9' as const,
};

describe('enqueueJob', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    MockSQSClient.prototype.send = jest.fn().mockResolvedValue({ MessageId: 'msg-abc-123' });
  });

  it('returns MessageId from SQS', async () => {
    const { enqueueJob } = await import('../queue/enqueueJob');
    const id = await enqueueJob(VALID_INPUT);
    expect(id).toBe('msg-abc-123');
  });

  it('sends message to configured queue URL', async () => {
    const { enqueueJob } = await import('../queue/enqueueJob');
    await enqueueJob(VALID_INPUT);
    const MockSendCmd = SendMessageCommand as jest.MockedClass<typeof SendMessageCommand>;
    expect(MockSendCmd.mock.calls[0][0].QueueUrl).toBe(
      'https://sqs.us-east-1.amazonaws.com/123456789/videoed-jobs',
    );
  });

  it('message body contains serialized job input', async () => {
    const { enqueueJob } = await import('../queue/enqueueJob');
    await enqueueJob(VALID_INPUT);
    const MockSendCmd = SendMessageCommand as jest.MockedClass<typeof SendMessageCommand>;
    const body = JSON.parse(MockSendCmd.mock.calls[0][0].MessageBody!);
    expect(body.headline).toBe('Buy Now');
    expect(body.brandColor).toBe('#FF5500');
  });

  it('throws Zod error on invalid input', async () => {
    const { enqueueJob } = await import('../queue/enqueueJob');
    await expect(enqueueJob({ brandColor: 'not-a-hex' })).rejects.toThrow();
  });

  it('throws if SQS returns no MessageId', async () => {
    MockSQSClient.prototype.send = jest.fn().mockResolvedValue({});
    const { enqueueJob } = await import('../queue/enqueueJob');
    await expect(enqueueJob(VALID_INPUT)).rejects.toThrow('no MessageId');
  });
});
