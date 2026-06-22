/**
 * Per-render cost estimation. Numbers are approximate based on AWS pricing
 * at time of writing; update if pricing changes.
 *
 * Lambda: $0.0000166667 per GB-second. We use 2048 MB = 2 GB.
 * S3 PUT: $0.000005 per request + $0.023 per GB stored (~1 MB per video ≈ $0.000023).
 * SQS: $0.40 per million requests; 3 calls per job = negligible.
 */

export interface RenderCostEstimate {
  lambdaUsd: number;
  s3Usd: number;
  totalUsd: number;
  durationSeconds: number;
}

const LAMBDA_GB_SECOND_PRICE = 0.0000166667; // USD per GB-second
const LAMBDA_MEMORY_GB = 2048 / 1024;        // 2048 MB in GB
const S3_PER_RENDER_USD = 0.000028;          // PUT + ~1 MB storage

export function estimateRenderCost(durationSeconds: number): RenderCostEstimate {
  if (durationSeconds < 0) throw new Error('durationSeconds must be >= 0');
  const lambdaUsd = durationSeconds * LAMBDA_MEMORY_GB * LAMBDA_GB_SECOND_PRICE;
  const s3Usd = S3_PER_RENDER_USD;
  const totalUsd = lambdaUsd + s3Usd;
  return {
    lambdaUsd: round6(lambdaUsd),
    s3Usd: round6(s3Usd),
    totalUsd: round6(totalUsd),
    durationSeconds,
  };
}

function round6(n: number): number {
  return parseFloat(n.toFixed(6));
}

export function logRenderCost(jobId: string, estimate: RenderCostEstimate): void {
  console.log(
    `[cost] job=${jobId} duration=${estimate.durationSeconds}s ` +
    `lambda=$${estimate.lambdaUsd} s3=$${estimate.s3Usd} total=$${estimate.totalUsd}`,
  );
}
