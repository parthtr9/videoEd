import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { buildVideoJob } from '../pipeline/buildVideoJob';
import { renderJobOnLambda } from '../lambda/renderOnLambda';
import { getQueueConfig } from './config';

function makeClient(): SQSClient {
  const cfg = getQueueConfig();
  return new SQSClient({
    region: cfg.AWS_REGION,
    credentials: { accessKeyId: cfg.AWS_ACCESS_KEY_ID, secretAccessKey: cfg.AWS_SECRET_ACCESS_KEY },
  });
}

export async function processOnce(): Promise<void> {
  const cfg = getQueueConfig();
  const response = await makeClient().send(
    new ReceiveMessageCommand({
      QueueUrl: cfg.SQS_QUEUE_URL,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 20, // long polling — reduces empty polls and cost
    }),
  );

  const messages = response.Messages ?? [];

  for (const message of messages) {
    if (!message.Body || !message.ReceiptHandle) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(message.Body);
    } catch {
      console.error(`[worker] Bad JSON in message ${message.MessageId ?? 'unknown'}, leaving for DLQ`);
      continue;
    }

    try {
      console.log(`[worker] Processing job ${message.MessageId ?? 'unknown'}`);
      const job = await buildVideoJob(parsed);
      const outputUrl = await renderJobOnLambda(job);
      console.log(`[worker] Done: ${outputUrl}`);

      await makeClient().send(
        new DeleteMessageCommand({
          QueueUrl: cfg.SQS_QUEUE_URL,
          ReceiptHandle: message.ReceiptHandle,
        }),
      );
    } catch (err) {
      // Leave message in queue — SQS retries after VisibilityTimeout.
      // After 3 failures it moves to the DLQ automatically.
      console.error(`[worker] Job ${message.MessageId ?? 'unknown'} failed: ${(err as Error).message}`);
    }
  }
}

export async function runWorker(): Promise<never> {
  console.log('[worker] Starting. Polling for jobs...');
  while (true) {
    await processOnce();
  }
}

if (require.main === module) {
  runWorker().catch((err: Error) => {
    console.error(`[worker] Fatal: ${err.message}`);
    process.exit(1);
  });
}
