import fs from 'fs';
import path from 'path';
import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client';
import type { AwsRegion } from '@remotion/lambda';
import { z } from 'zod';
import { AspectRatio } from '../schemas/videoProps';
import { VideoJob } from '../pipeline/buildVideoJob';
import { uploadToS3 } from './uploadToS3';
import { lambdaConfig, DEPLOY_STATE_FILE } from './config';
import { estimateRenderCost, logRenderCost } from '../monitoring/costTracker';

const DeployStateSchema = z.object({
  functionName: z.string().min(1),
  serveUrl: z.string().url(),
  bucketName: z.string().min(1),
});

type DeployState = z.infer<typeof DeployStateSchema>;

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 300_000;

function loadDeployState(): DeployState {
  const statePath = path.join(process.cwd(), DEPLOY_STATE_FILE);
  if (!fs.existsSync(statePath)) {
    throw new Error(
      `Deploy state not found at ${statePath}. Run: npm run lambda:deploy first.`,
    );
  }
  const raw = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  return DeployStateSchema.parse(raw);
}

function compositionId(ratio: AspectRatio): string {
  return `ProductVideo-${ratio.replace(':', 'x')}`;
}

async function pollUntilDone(
  bucketName: string,
  renderId: string,
  functionName: string,
  region: AwsRegion,
): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const progress = await getRenderProgress({
      bucketName,
      renderId,
      functionName,
      region,
    });
    if (progress.fatalErrorEncountered) {
      throw new Error(`Lambda render failed: ${progress.errors[0]?.message ?? 'unknown error'}`);
    }
    if (progress.done) {
      if (!progress.outputFile) throw new Error('Lambda render finished but no output file returned');
      return progress.outputFile;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Lambda render timed out after ${POLL_TIMEOUT_MS / 1000}s`);
}

export async function renderJobOnLambda(job: VideoJob): Promise<string> {
  const { functionName, serveUrl, bucketName } = loadDeployState();
  const { region } = lambdaConfig;

  const imageKey = `assets/${path.basename(job.processedImagePath)}`;
  const imageUrl = await uploadToS3({ localPath: job.processedImagePath, s3Key: imageKey, bucketName });

  let narrationUrl: string | undefined;
  if (job.narrationPath) {
    const narrationKey = `assets/${path.basename(job.narrationPath)}`;
    narrationUrl = await uploadToS3({ localPath: job.narrationPath, s3Key: narrationKey, bucketName });
  }

  const renderProps = { ...job.props, productImageUrl: imageUrl, narrationUrl };

  const ratio = job.props.aspectRatio as AspectRatio;
  const outKey = `renders/${Date.now()}_${ratio.replace(':', 'x')}.mp4`;

  const { renderId } = await renderMediaOnLambda({
    region,
    functionName,
    serveUrl,
    composition: compositionId(ratio),
    inputProps: renderProps,
    codec: 'h264',
    imageFormat: 'jpeg',
    maxRetries: 1,
    framesPerLambda: 20,
    outName: outKey,
  });

  const renderStartMs = Date.now();
  const outputFile = await pollUntilDone(bucketName, renderId, functionName, region);
  const durationSeconds = (Date.now() - renderStartMs) / 1000;
  logRenderCost(renderId, estimateRenderCost(durationSeconds));
  return outputFile;
}
