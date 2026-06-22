import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { uploadToS3 } from '../../../src/lambda/uploadToS3';
import { DEPLOY_STATE_FILE } from '../../../src/lambda/config';

interface DeployState {
  bucketName: string;
}

function getDeployState(): DeployState {
  const statePath = path.join(process.cwd(), DEPLOY_STATE_FILE);
  if (!fs.existsSync(statePath)) {
    throw new Error('Deploy state not found. Run: npm run lambda:deploy');
  }
  return JSON.parse(fs.readFileSync(statePath, 'utf8')) as DeployState;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('image');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'No image file provided (field name: "image")' }, { status: 400 });
  }

  const originalName = file instanceof File ? file.name : 'upload.jpg';
  const ext = path.extname(originalName) || '.jpg';
  const tmpPath = path.join(os.tmpdir(), `videoed-upload-${crypto.randomUUID()}${ext}`);

  try {
    // Write uploaded bytes to a temp file so uploadToS3 can read it
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tmpPath, buffer);

    const { bucketName } = getDeployState();
    const s3Key = `uploads/${crypto.randomUUID()}${ext}`;
    const url = await uploadToS3({ localPath: tmpPath, s3Key, bucketName });

    return NextResponse.json({ url });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath);
  }
}
