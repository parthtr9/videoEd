import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { withRetry } from '../utils/retry';

const execFileAsync = promisify(execFile);

const RemoveBgInputSchema = z.object({
  inputPath: z.string().min(1, 'inputPath must not be empty'),
  outputPath: z.string().min(1, 'outputPath must not be empty'),
});

export type RemoveBgInput = z.infer<typeof RemoveBgInputSchema>;

const SCRIPT_PATH = path.join(__dirname, '../../scripts/remove_bg.py');

export async function removeBackground(input: RemoveBgInput): Promise<string> {
  const { inputPath, outputPath } = RemoveBgInputSchema.parse(input);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`removeBackground: input file not found: ${inputPath}`);
  }

  await withRetry(
    async () => {
      try {
        await execFileAsync('python3', [SCRIPT_PATH, inputPath, outputPath]);
      } catch (err: unknown) {
        const stderr = (err as { stderr?: string }).stderr ?? '';
        const msg = stderr.trim() || (err instanceof Error ? err.message : String(err));
        throw new Error(`rembg failed — ${msg}`);
      }
    },
    { maxAttempts: 3, baseDelayMs: 500, label: 'removeBackground' },
  );

  if (!fs.existsSync(outputPath)) {
    throw new Error(`removeBackground: output file was not created at ${outputPath}`);
  }

  return outputPath;
}
