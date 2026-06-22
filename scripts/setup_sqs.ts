/**
 * Creates the SQS job queue and dead-letter queue for video render jobs.
 * Safe to re-run — skips creation if queues already exist.
 * Run: npx ts-node scripts/setup_sqs.ts
 * Then add SQS_QUEUE_URL to your .env file.
 */
import 'dotenv/config';
import {
  SQSClient,
  CreateQueueCommand,
  GetQueueAttributesCommand,
  GetQueueUrlCommand,
  QueueAttributeName,
  QueueDoesNotExist,
} from '@aws-sdk/client-sqs';

const REGION = process.env['AWS_REGION'] ?? 'us-east-1';
const MAIN_QUEUE = 'videoed-jobs';
const DLQ_NAME = 'videoed-jobs-dlq';
const VISIBILITY_TIMEOUT = '300'; // seconds — matches Lambda render timeout
const MAX_RECEIVE_COUNT = '3';    // move to DLQ after 3 failed attempts
const RETENTION_SECONDS = '86400'; // 1 day

const client = new SQSClient({ region: REGION });

async function getOrCreateQueue(name: string, attrs: Record<string, string>): Promise<string> {
  try {
    const res = await client.send(new GetQueueUrlCommand({ QueueName: name }));
    const url = res.QueueUrl!;
    console.log(`Queue "${name}" already exists.`);
    return url;
  } catch (err) {
    if (!(err instanceof QueueDoesNotExist)) throw err;
  }

  console.log(`Creating queue "${name}"...`);
  const res = await client.send(new CreateQueueCommand({ QueueName: name, Attributes: attrs }));
  return res.QueueUrl!;
}

async function getQueueArn(queueUrl: string): Promise<string> {
  const res = await client.send(
    new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: [QueueAttributeName.QueueArn],
    }),
  );
  return res.Attributes![QueueAttributeName.QueueArn]!;
}

async function main(): Promise<void> {
  // 1. Create DLQ
  const dlqUrl = await getOrCreateQueue(DLQ_NAME, {
    MessageRetentionPeriod: '1209600', // 14 days — keep failed jobs for inspection
  });
  const dlqArn = await getQueueArn(dlqUrl);

  // 2. Create main queue with redrive to DLQ
  const mainUrl = await getOrCreateQueue(MAIN_QUEUE, {
    VisibilityTimeout: VISIBILITY_TIMEOUT,
    MessageRetentionPeriod: RETENTION_SECONDS,
    ReceiveMessageWaitTimeSeconds: '20', // long polling
    RedrivePolicy: JSON.stringify({ deadLetterTargetArn: dlqArn, maxReceiveCount: MAX_RECEIVE_COUNT }),
  });

  console.log('\nSetup complete.\n');
  console.log('Add this to your .env file:');
  console.log(`SQS_QUEUE_URL=${mainUrl}`);
}

main().catch((err: Error) => {
  console.error(`Setup failed: ${err.message}`);
  process.exit(1);
});
