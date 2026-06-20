import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

const execFileAsync = promisify(execFile);

const NarrationInputSchema = z.object({
  text: z.string().min(1, 'text must not be empty').max(500),
  outputPath: z.string().min(1, 'outputPath must not be empty'),
  modelPath: z.string().min(1, 'modelPath must not be empty'),
});

export type NarrationInput = z.infer<typeof NarrationInputSchema>;

const SCRIPT_PATH = path.join(__dirname, '../../scripts/synthesize_speech.py');
export const DEFAULT_MODEL_PATH = path.join(__dirname, '../../models/en_US-lessac-medium.onnx');

export async function synthesizeSpeech(input: NarrationInput): Promise<string> {
  const { text, outputPath, modelPath } = NarrationInputSchema.parse(input);

  if (!fs.existsSync(modelPath)) {
    throw new Error(`synthesizeSpeech: model not found at ${modelPath}`);
  }

  try {
    await execFileAsync('python3', [SCRIPT_PATH, text, outputPath, modelPath]);
  } catch (err: unknown) {
    const stderr = (err as { stderr?: string }).stderr ?? '';
    const msg = stderr.trim() || (err instanceof Error ? err.message : String(err));
    throw new Error(`synthesizeSpeech: Piper failed — ${msg}`);
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error(`synthesizeSpeech: output WAV was not created at ${outputPath}`);
  }

  return outputPath;
}
