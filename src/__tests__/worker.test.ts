jest.mock('@aws-sdk/client-sqs');
jest.mock('../queue/config', () => ({
  queueConfig: {
    AWS_ACCESS_KEY_ID: 'test-key',
    AWS_SECRET_ACCESS_KEY: 'test-secret',
    AWS_REGION: 'us-east-1',
    SQS_QUEUE_URL: 'https://sqs.us-east-1.amazonaws.com/123456789/videoed-jobs',
  },
}));
jest.mock('../pipeline/buildVideoJob');
jest.mock('../lambda/renderOnLambda');

import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { buildVideoJob } from '../pipeline/buildVideoJob';
import { renderJobOnLambda } from '../lambda/renderOnLambda';

const MockSQSClient = SQSClient as jest.MockedClass<typeof SQSClient>;
const mockBuildJob = buildVideoJob as jest.MockedFunction<typeof buildVideoJob>;
const mockRenderLambda = renderJobOnLambda as jest.MockedFunction<typeof renderJobOnLambda>;

const FAKE_MESSAGE = {
  MessageId: 'msg-001',
  ReceiptHandle: 'receipt-handle-abc',
  Body: JSON.stringify({
    productImagePath: '/fake/product.jpg',
    outputDir: '/fake/out',
    brandColor: '#FF5500',
    headline: 'Buy Now',
    template: 'Minimal',
    aspectRatio: '16:9',
  }),
};

const FAKE_JOB = { props: {}, processedImagePath: '/fake/out/product_no_bg.png', narrationPath: null };

describe('processOnce', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    MockSQSClient.prototype.send = jest.fn();
    mockBuildJob.mockResolvedValue(FAKE_JOB as any);
    mockRenderLambda.mockResolvedValue('https://bucket/renders/video.mp4');
  });

  it('does nothing when queue is empty', async () => {
    MockSQSClient.prototype.send = jest.fn().mockResolvedValue({ Messages: [] });
    const { processOnce } = await import('../queue/worker');
    await processOnce();
    expect(mockBuildJob).not.toHaveBeenCalled();
  });

  it('calls buildVideoJob with parsed message body', async () => {
    MockSQSClient.prototype.send = jest.fn()
      .mockResolvedValueOnce({ Messages: [FAKE_MESSAGE] }) // receive
      .mockResolvedValue({});                               // delete
    const { processOnce } = await import('../queue/worker');
    await processOnce();
    expect(mockBuildJob).toHaveBeenCalledWith(
      expect.objectContaining({ headline: 'Buy Now', brandColor: '#FF5500' }),
    );
  });

  it('calls renderJobOnLambda with job from buildVideoJob', async () => {
    MockSQSClient.prototype.send = jest.fn()
      .mockResolvedValueOnce({ Messages: [FAKE_MESSAGE] })
      .mockResolvedValue({});
    const { processOnce } = await import('../queue/worker');
    await processOnce();
    expect(mockRenderLambda).toHaveBeenCalledWith(FAKE_JOB);
  });

  it('deletes message after successful render', async () => {
    MockSQSClient.prototype.send = jest.fn()
      .mockResolvedValueOnce({ Messages: [FAKE_MESSAGE] })
      .mockResolvedValue({});
    const { processOnce } = await import('../queue/worker');
    await processOnce();
    const MockDelCmd = DeleteMessageCommand as jest.MockedClass<typeof DeleteMessageCommand>;
    expect(MockDelCmd.mock.calls[0][0].ReceiptHandle).toBe(FAKE_MESSAGE.ReceiptHandle);
  });

  it('does not delete message when render fails', async () => {
    mockRenderLambda.mockRejectedValue(new Error('Lambda timed out'));
    MockSQSClient.prototype.send = jest.fn()
      .mockResolvedValueOnce({ Messages: [FAKE_MESSAGE] });
    const { processOnce } = await import('../queue/worker');
    await processOnce(); // must not throw
    const MockDelCmd = DeleteMessageCommand as jest.MockedClass<typeof DeleteMessageCommand>;
    expect(MockDelCmd.mock.calls.length).toBe(0);
  });

  it('skips message with invalid JSON body without throwing', async () => {
    const badMessage = { ...FAKE_MESSAGE, Body: 'not json' };
    MockSQSClient.prototype.send = jest.fn()
      .mockResolvedValueOnce({ Messages: [badMessage] });
    const { processOnce } = await import('../queue/worker');
    await expect(processOnce()).resolves.not.toThrow();
    expect(mockBuildJob).not.toHaveBeenCalled();
  });

  it('uses long-poll WaitTimeSeconds 20', async () => {
    MockSQSClient.prototype.send = jest.fn().mockResolvedValue({ Messages: [] });
    const { processOnce } = await import('../queue/worker');
    await processOnce();
    const MockRecvCmd = ReceiveMessageCommand as jest.MockedClass<typeof ReceiveMessageCommand>;
    expect(MockRecvCmd.mock.calls[0][0].WaitTimeSeconds).toBe(20);
  });
});
