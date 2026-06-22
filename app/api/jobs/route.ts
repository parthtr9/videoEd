import { NextRequest, NextResponse } from 'next/server';
import { enqueueJob } from '../../../src/queue/enqueueJob';

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const messageId = await enqueueJob(body);
    return NextResponse.json({ messageId });
  } catch (err) {
    const message = (err as Error).message;
    // Zod validation errors indicate bad client input → 400
    const isValidationError = message.toLowerCase().includes('invalid') || message.includes('required');
    return NextResponse.json({ error: message }, { status: isValidationError ? 400 : 500 });
  }
}
