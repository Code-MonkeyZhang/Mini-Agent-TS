import { describe, it, expect, vi, beforeEach } from "vitest";
import { asyncRetry, RetryConfig, RetryExhaustedError } from "../src/retry.js";

describe("Retry Mechanism", () => {
  // Reset all mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return result immediately if function succeeds first time", async () => {
    const mockFn = vi.fn().mockResolvedValue("success");
    const config = new RetryConfig({ maxRetries: 3 });

    const result = await asyncRetry(async () => mockFn(), config);

    expect(result).toBe("success");
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("should retry on failure and eventually succeed", async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("success");

    // Use shorter delays to keep the test fast
    const config = new RetryConfig({
      maxRetries: 3,
      initialDelay: 0.01, // 10ms
    });

    const result = await asyncRetry(async () => mockFn(), config);

    expect(result).toBe("success");
    expect(mockFn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("should throw RetryExhaustedError when max retries reached", async () => {
    const error = new Error("persistent fail");
    const mockFn = vi.fn().mockRejectedValue(error);

    const config = new RetryConfig({
      maxRetries: 2,
      initialDelay: 0.01,
    });

    // Verify it throws the expected error type
    await expect(asyncRetry(async () => mockFn(), config)).rejects.toThrow(
      RetryExhaustedError
    );

    // Verify call count: 1 initial + 2 retries = 3 total calls
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it("should trigger onRetry callback", async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error("fail"));
    const onRetry = vi.fn();

    const config = new RetryConfig({
      maxRetries: 2,
      initialDelay: 0.01,
    });

    try {
      await asyncRetry(async () => mockFn(), config, onRetry);
    } catch (e) {
      // Ignore the final error
    }

    // Verify callback called twice
    expect(onRetry).toHaveBeenCalledTimes(2);
    // Verify callback args: first retry is attempt 1
    expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 1);
    // Second retry is attempt 2
    expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 2);
  });

  // Note: the `enabled` flag should be checked by the caller (e.g. OpenAIClient.generate()),
  // not inside asyncRetry. asyncRetry assumes that retries are desired when it is invoked.
});
