import { describe, expect, it } from 'bun:test';
import type { CliproxyUsageApiResponse } from '../../../src/cliproxy/stats-fetcher';
import { buildCliproxyStatsFromUsageResponse } from '../../../src/cliproxy/stats-transformer';

describe('buildCliproxyStatsFromUsageResponse', () => {
  it('keeps duplicate emails isolated by provider', () => {
    const usage: CliproxyUsageApiResponse = {
      usage: {
        total_requests: 5,
        apis: {
          codex: {
            total_requests: 3,
            models: {
              'gpt-5': {
                total_requests: 3,
                details: [
                  {
                    timestamp: '2026-03-26T10:00:00.000Z',
                    source: 'shared@example.com',
                    auth_index: 0,
                    tokens: {
                      input_tokens: 10,
                      output_tokens: 5,
                      reasoning_tokens: 0,
                      cached_tokens: 0,
                      total_tokens: 15,
                    },
                    failed: false,
                  },
                  {
                    timestamp: '2026-03-26T10:01:00.000Z',
                    source: 'shared@example.com',
                    auth_index: 0,
                    tokens: {
                      input_tokens: 12,
                      output_tokens: 7,
                      reasoning_tokens: 0,
                      cached_tokens: 0,
                      total_tokens: 19,
                    },
                    failed: false,
                  },
                  {
                    timestamp: '2026-03-26T10:02:00.000Z',
                    source: 'shared@example.com',
                    auth_index: 0,
                    tokens: {
                      input_tokens: 8,
                      output_tokens: 2,
                      reasoning_tokens: 0,
                      cached_tokens: 0,
                      total_tokens: 10,
                    },
                    failed: true,
                  },
                ],
              },
            },
          },
          gemini: {
            total_requests: 2,
            models: {
              'gemini-2.5-pro': {
                total_requests: 2,
                details: [
                  {
                    timestamp: '2026-03-26T11:00:00.000Z',
                    source: 'shared@example.com',
                    auth_index: 0,
                    tokens: {
                      input_tokens: 20,
                      output_tokens: 10,
                      reasoning_tokens: 0,
                      cached_tokens: 0,
                      total_tokens: 30,
                    },
                    failed: false,
                  },
                  {
                    timestamp: '2026-03-26T11:01:00.000Z',
                    source: 'shared@example.com',
                    auth_index: 0,
                    tokens: {
                      input_tokens: 14,
                      output_tokens: 6,
                      reasoning_tokens: 0,
                      cached_tokens: 0,
                      total_tokens: 20,
                    },
                    failed: true,
                  },
                ],
              },
            },
          },
        },
      },
    };

    const stats = buildCliproxyStatsFromUsageResponse(usage);

    expect(stats.accountStats['codex:shared@example.com']).toMatchObject({
      accountKey: 'codex:shared@example.com',
      provider: 'codex',
      source: 'shared@example.com',
      successCount: 2,
      failureCount: 1,
      totalTokens: 44,
      lastUsedAt: '2026-03-26T10:02:00.000Z',
    });
    expect(stats.accountStats['gemini:shared@example.com']).toMatchObject({
      accountKey: 'gemini:shared@example.com',
      provider: 'gemini',
      source: 'shared@example.com',
      successCount: 1,
      failureCount: 1,
      totalTokens: 50,
      lastUsedAt: '2026-03-26T11:01:00.000Z',
    });
    expect(stats.successCount).toBe(3);
    expect(stats.failureCount).toBe(2);
    expect(stats.requestsByProvider).toEqual({ codex: 3, gemini: 2 });
  });
});
