import 'dotenv/config';
import { z } from 'zod';

const QueueConfigSchema = z.object({
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_REGION: z.string().min(1),
  SQS_QUEUE_URL: z.string().url(),
});

function loadConfig() {
  const result = QueueConfigSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      `Queue config missing or invalid. Required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, SQS_QUEUE_URL.\n${result.error.message}`,
    );
  }
  return result.data;
}

export const queueConfig = loadConfig();
