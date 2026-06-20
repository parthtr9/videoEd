import path from 'path';
import fs from 'fs';

jest.mock('child_process');
jest.mock('fs');

const { execFile } = require('child_process') as jest.Mocked<typeof import('child_process')>;
const fsMock = fs as jest.Mocked<typeof fs>;

import { synthesizeSpeech } from '../pipeline/narration';

describe('synthesizeSpeech (unit, mocked)', () => {
  const INPUT = {
    text: 'Buy this product today.',
    outputPath: '/fake/out/narration.wav',
    modelPath: '/fake/models/voice.onnx',
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('throws Zod error if text is empty', async () => {
    await expect(synthesizeSpeech({ ...INPUT, text: '' })).rejects.toThrow();
  });

  it('throws Zod error if outputPath is empty', async () => {
    await expect(synthesizeSpeech({ ...INPUT, outputPath: '' })).rejects.toThrow();
  });

  it('throws if model file does not exist', async () => {
    fsMock.existsSync.mockReturnValue(false);
    await expect(synthesizeSpeech(INPUT)).rejects.toThrow('model not found');
  });

  it('throws with stderr message if python3 exits non-zero', async () => {
    fsMock.existsSync.mockReturnValueOnce(true);
    execFile.mockImplementation((_cmd, _args, callback: any) => {
      callback(Object.assign(new Error('exit 1'), { stderr: 'Piper synthesis failed: espeak error' }));
      return {} as any;
    });
    await expect(synthesizeSpeech(INPUT)).rejects.toThrow('Piper synthesis failed');
  });

  it('throws if output WAV was not created after success', async () => {
    fsMock.existsSync
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);
    execFile.mockImplementation((_cmd, _args, callback: any) => {
      callback(null, '', '');
      return {} as any;
    });
    await expect(synthesizeSpeech(INPUT)).rejects.toThrow('output WAV was not created');
  });

  it('returns outputPath on success', async () => {
    fsMock.existsSync
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);
    execFile.mockImplementation((_cmd, _args, callback: any) => {
      callback(null, INPUT.outputPath, '');
      return {} as any;
    });
    const result = await synthesizeSpeech(INPUT);
    expect(result).toBe(INPUT.outputPath);
  });

  it('calls python3 with synthesize_speech.py, text, outputPath, modelPath', async () => {
    fsMock.existsSync
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);
    execFile.mockImplementation((_cmd, _args, callback: any) => {
      callback(null, INPUT.outputPath, '');
      return {} as any;
    });
    await synthesizeSpeech(INPUT);
    const call = execFile.mock.calls[0];
    expect(call).toBeDefined();
    const [cmd, args] = call!;
    expect(cmd).toBe('python3');
    expect(args![0]).toMatch(/synthesize_speech\.py$/);
    expect(args![1]).toBe(INPUT.text);
    expect(args![2]).toBe(INPUT.outputPath);
    expect(args![3]).toBe(INPUT.modelPath);
  });
});
