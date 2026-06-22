import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { z } from 'zod';
import { lambdaConfig } from './config';
import { withRetry } from '../utils/retry';

const UploadInputSchema = z.object({
  localPath: z.string().min(1),
  s3Key: z.string().min(1),
  bucketName: z.string().min(1),
});

export type UploadInput = z.infer<typeof UploadInputSchema>;

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
  };
  return map[ext] ?? 'application/octet-stream';
}

export async function uploadToS3(input: UploadInput): Promise<string> {
  const { localPath, s3Key, bucketName } = UploadInputSchema.parse(input);

  if (!fs.existsSync(localPath)) {
    throw new Error(`uploadToS3: file not found: ${localPath}`);
  }

  const client = new S3Client({ region: lambdaConfig.region });
  const body = fs.readFileSync(localPath);

  await withRetry(
    () => client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: body,
        ContentType: getMimeType(localPath),
      }),
    ),
    { maxAttempts: 3, baseDelayMs: 1000, label: 's3-upload' },
  );

  return `https://${bucketName}.s3.${lambdaConfig.AWS_REGION}.amazonaws.com/${s3Key}`;
}
