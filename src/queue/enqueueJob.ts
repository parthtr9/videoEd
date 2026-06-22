import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { JobInputSchema } from '../pipeline/buildVideoJob';
import { getQueueConfig } from './config';

function makeClient(): SQSClient {
  const cfg = getQueueConfig();
  return new SQSClient({
    region: cfg.AWS_REGION,
    credentials: { accessKeyId: cfg.AWS_ACCESS_KEY_ID, secretAccessKey: cfg.AWS_SECRET_ACCESS_KEY },
  });
}

export async function enqueueJob(rawInput: unknown): Promise<string> {
  const input = JobInputSchema.parse(rawInput);
  const cfg = getQueueConfig();

  const result = await makeClient().send(
    new SendMessageCommand({
      QueueUrl: cfg.SQS_QUEUE_URL,
      MessageBody: JSON.stringify(input),
    }),
  );

  const messageId = result.MessageId;
  if (!messageId) throw new Error('SQS returned no MessageId');
  return messageId;
}
