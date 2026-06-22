import 'dotenv/config';
import { z } from 'zod';
import type { AwsRegion } from '@remotion/lambda';

const LambdaConfigSchema = z.object({
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_REGION: z.string().min(1),
});

function loadConfig() {
  const result = LambdaConfigSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path[0]).join(', ');
    throw new Error(`Lambda config missing env vars: ${missing}. Check your .env file.`);
  }
  return {
    ...result.data,
    region: result.data.AWS_REGION as AwsRegion,
  };
}

export const lambdaConfig = loadConfig();

export const LAMBDA_FUNCTION_TIMEOUT_SECONDS = 240;
export const LAMBDA_MEMORY_MB = 2048;
export const LAMBDA_DISK_MB = 2048;
export const REMOTION_SITE_NAME = 'videoed-site';
export const DEPLOY_STATE_FILE = '.remotion-deploy.json';
