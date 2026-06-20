/**
 * Real rembg integration test. Skipped unless INTEGRATION=true.
 * Run with: INTEGRATION=true npx jest backgroundRemoval.integration
 */
import path from 'path';
import os from 'os';
import fs from 'fs';
import { removeBackground } from '../pipeline/backgroundRemoval';

const RUN = process.env['INTEGRATION'] === 'true';

(RUN ? describe : describe.skip)('removeBackground integration', () => {
  const FIXTURE = path.join(__dirname, 'fixtures', 'red_square.png');

  it('strips background from a real PNG and writes a non-empty output file', async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'videoed-test-'));
    const outPath = path.join(outDir, 'out.png');
    try {
      const result = await removeBackground({ inputPath: FIXTURE, outputPath: outPath });
      expect(result).toBe(path.resolve(outPath));
      expect(fs.existsSync(outPath)).toBe(true);
      expect(fs.statSync(outPath).size).toBeGreaterThan(100);
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }, 60_000);
});
