import { withRetry } from '../utils/retry';

describe('withRetry', () => {
  it('returns result immediately when fn succeeds first try', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries and succeeds on second attempt', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 0 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries exactly maxAttempts times then throws', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('persistent'));
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 0 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('error message includes label and attempt count', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(
      withRetry(fn, { maxAttempts: 2, baseDelayMs: 0, label: 'my-op' }),
    ).rejects.toThrow('my-op failed after 2 attempts: boom');
  });

  it('succeeds on last allowed attempt', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('last-chance');
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 0 });
    expect(result).toBe('last-chance');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('wraps non-Error rejections into Error', async () => {
    const fn = jest.fn().mockRejectedValue('string error');
    await expect(withRetry(fn, { maxAttempts: 1, baseDelayMs: 0 })).rejects.toThrow('string error');
  });

  it('uses exponential backoff delay between retries', async () => {
    const delays: number[] = [];
    const origSetTimeout = global.setTimeout;
    jest.spyOn(global, 'setTimeout').mockImplementation((cb, delay) => {
      if (typeof delay === 'number') delays.push(delay);
      return origSetTimeout(cb as () => void, 0);
    });

    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    await withRetry(fn, { maxAttempts: 3, baseDelayMs: 100 });
    jest.restoreAllMocks();

    expect(delays[0]).toBe(100); // attempt 1 failed → wait 100ms
    expect(delays[1]).toBe(200); // attempt 2 failed → wait 200ms
  });
});
