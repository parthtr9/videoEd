/**
 * One-time (or on-change) deployment script.
 * Run: npm run lambda:deploy
 * Creates S3 bucket (auto-named by Remotion), deploys Lambda function,
 * bundles + uploads Remotion site. Saves state to .remotion-deploy.json.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { deployFunction, deploySite, getOrCreateBucket } from '@remotion/lambda';
import {
  lambdaConfig,
  LAMBDA_FUNCTION_TIMEOUT_SECONDS,
  LAMBDA_MEMORY_MB,
  LAMBDA_DISK_MB,
  REMOTION_SITE_NAME,
  DEPLOY_STATE_FILE,
} from './config';

async function main(): Promise<void> {
  const { region } = lambdaConfig;

  console.log('[1/4] Ensuring S3 bucket exists...');
  const { bucketName } = await getOrCreateBucket({ region });
  console.log(`      Bucket: ${bucketName}`);

  console.log('[2/4] Deploying Lambda function...');
  const { functionName } = await deployFunction({
    region,
    timeoutInSeconds: LAMBDA_FUNCTION_TIMEOUT_SECONDS,
    memorySizeInMb: LAMBDA_MEMORY_MB,
    diskSizeInMb: LAMBDA_DISK_MB,
    createCloudWatchLogGroup: true,
  });
  console.log(`      Function: ${functionName}`);

  console.log('[3/4] Bundling and uploading Remotion site to S3...');
  const entryPoint = path.join(__dirname, '../../src/index.ts');
  const { serveUrl } = await deploySite({
    entryPoint,
    bucketName,
    region,
    siteName: REMOTION_SITE_NAME,
  });
  console.log(`      Site URL: ${serveUrl}`);

  console.log('[4/4] Saving deploy state...');
  const state = { functionName, serveUrl, bucketName };
  fs.writeFileSync(
    path.join(process.cwd(), DEPLOY_STATE_FILE),
    JSON.stringify(state, null, 2),
  );
  console.log(`      Saved to ${DEPLOY_STATE_FILE}`);
  console.log('\nDeploy complete. Ready to render on Lambda.');
}

main().catch((err: Error) => {
  console.error(`Deploy failed: ${err.message}`);
  process.exit(1);
});
