import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { JobInputSchema } from '../pipeline/buildVideoJob';
import { queueConfig } from './config';

const sqsClient = new SQSClient({
  region: queueConfig.AWS_REGION,
  credentials: {
    accessKeyId: queueConfig.AWS_ACCESS_KEY_ID,
    secretAccessKey: queueConfig.AWS_SECRET_ACCESS_KEY,
  },
});

export async function enqueueJob(rawInput: unknown): Promise<string> {
  const input = JobInputSchema.parse(rawInput);

  const result = await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueConfig.SQS_QUEUE_URL,
      MessageBody: JSON.stringify(input),
    }),
  );

  const messageId = result.MessageId;
  if (!messageId) throw new Error('SQS returned no MessageId');
  return messageId;
}
