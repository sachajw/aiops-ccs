import { buildQualifiedAccountStatsKey } from './account-stats-key';
import type { AccountUsageStats, CliproxyStats, CliproxyUsageApiResponse } from './stats-fetcher';

export function buildCliproxyStatsFromUsageResponse(data: CliproxyUsageApiResponse): CliproxyStats {
  const usage = data.usage;
  const requestsByModel: Record<string, number> = {};
  const requestsByProvider: Record<string, number> = {};
  const accountStats: Record<string, AccountUsageStats> = {};
  let totalSuccessCount = 0;
  let totalFailureCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  if (usage?.apis) {
    for (const [provider, providerData] of Object.entries(usage.apis)) {
      requestsByProvider[provider] = providerData.total_requests ?? 0;
      if (!providerData.models) {
        continue;
      }

      for (const [model, modelData] of Object.entries(providerData.models)) {
        requestsByModel[model] = modelData.total_requests ?? 0;
        if (!modelData.details) {
          continue;
        }

        for (const detail of modelData.details) {
          const source = detail.source || 'unknown';
          const accountKey = buildQualifiedAccountStatsKey(provider, source);

          if (!accountStats[accountKey]) {
            accountStats[accountKey] = {
              accountKey,
              provider,
              source,
              successCount: 0,
              failureCount: 0,
              totalTokens: 0,
            };
          }

          if (detail.failed) {
            accountStats[accountKey].failureCount++;
            totalFailureCount++;
          } else {
            accountStats[accountKey].successCount++;
            totalSuccessCount++;
          }

          const tokens = detail.tokens?.total_tokens ?? 0;
          accountStats[accountKey].totalTokens += tokens;
          accountStats[accountKey].lastUsedAt = detail.timestamp;
          totalInputTokens += detail.tokens?.input_tokens ?? 0;
          totalOutputTokens += detail.tokens?.output_tokens ?? 0;
        }
      }
    }
  }

  return {
    totalRequests: usage?.total_requests ?? 0,
    successCount: totalSuccessCount,
    failureCount: totalFailureCount,
    tokens: {
      input: totalInputTokens,
      output: totalOutputTokens,
      total: usage?.total_tokens ?? 0,
    },
    requestsByModel,
    requestsByProvider,
    accountStats,
    quotaExceededCount: usage?.failure_count ?? data.failed_requests ?? 0,
    retryCount: 0,
    collectedAt: new Date().toISOString(),
  };
}
