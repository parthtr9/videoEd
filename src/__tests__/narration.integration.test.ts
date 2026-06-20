/**
 * Real Piper TTS integration test. Skipped unless INTEGRATION=true.
 * Run with: INTEGRATION=true npx jest narration.integration
 */
import path from 'path';
import os from 'os';
import fs from 'fs';
import { synthesizeSpeech, DEFAULT_MODEL_PATH } from '../pipeline/narration';

const RUN = process.env['INTEGRATION'] === 'true';

(RUN ? describe : describe.skip)('synthesizeSpeech integration', () => {
  it('generates a non-empty WAV file from real text via Piper', async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'videoed-tts-'));
    const outPath = path.join(outDir, 'narration.wav');
    try {
      const result = await synthesizeSpeech({
        text: 'This product is built for you.',
        outputPath: outPath,
        modelPath: DEFAULT_MODEL_PATH,
      });
      expect(result).toBe(path.resolve(outPath));
      expect(fs.existsSync(outPath)).toBe(true);
      expect(fs.statSync(outPath).size).toBeGreaterThan(1000);
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }, 60_000);
});
