import { describe, expect, it } from 'vitest';

import {
  formatRequestedUpstreamModelRules,
  getProviderDescription,
  getProviderDisplayName,
  getProviderFallbackVisual,
  getProviderLogoAsset,
  getRequestedUpstreamModelRuleErrors,
  getRequestedModelId,
  parseRequestedUpstreamModelRules,
  PROVIDER_COLORS,
} from '@/lib/provider-config';

describe('provider model mapping helpers', () => {
  it('parses requested=upstream rules into stored upstream+alias pairs', () => {
    expect(
      parseRequestedUpstreamModelRules('claude-sonnet-4-5=gpt-4.1\nminimax/minimax-m2.7')
    ).toEqual([
      { name: 'gpt-4.1', alias: 'claude-sonnet-4-5' },
      { name: 'minimax/minimax-m2.7', alias: '' },
    ]);
  });

  it('formats stored model rules back into requested=upstream text', () => {
    expect(
      formatRequestedUpstreamModelRules([
        { name: 'gpt-4.1', alias: 'claude-sonnet-4-5' },
        { name: 'minimax/minimax-m2.7', alias: '' },
      ])
    ).toBe('claude-sonnet-4-5=gpt-4.1\nminimax/minimax-m2.7');
  });

  it('prefers the requested alias for generated settings previews', () => {
    expect(getRequestedModelId({ name: 'gpt-4.1', alias: 'claude-sonnet-4-5' })).toBe(
      'claude-sonnet-4-5'
    );
    expect(getRequestedModelId({ name: 'minimax/minimax-m2.7', alias: '' })).toBe(
      'minimax/minimax-m2.7'
    );
  });

  it('rejects malformed requested=upstream lines instead of coercing them', () => {
    expect(getRequestedUpstreamModelRuleErrors('claude-sonnet-4-5=\n=gpt-5\nqwen3-coder')).toEqual([
      'Line 1: use requested=upstream or a plain model name.',
      'Line 2: use requested=upstream or a plain model name.',
    ]);
  });
});

describe('provider presentation metadata', () => {
  it.each([
    ['cursor', 'Cursor', 'Cursor browser-authenticated provider', '/assets/sidebar/cursor.svg'],
    ['gitlab', 'GitLab Duo', 'GitLab Duo with OAuth or PAT auth', '/assets/providers/gitlab.svg'],
    [
      'codebuddy',
      'CodeBuddy (Tencent)',
      'Tencent CodeBuddy AI assistant',
      '/assets/providers/codebuddy.png',
    ],
    ['kilo', 'Kilo AI', 'Kilo AI coding assistant', '/assets/providers/kilo.png'],
  ])('recognizes %s across dashboard display helpers', (provider, name, description, asset) => {
    expect(getProviderDisplayName(provider)).toBe(name);
    expect(getProviderDescription(provider)).toBe(description);
    expect(getProviderLogoAsset(provider)).toBe(asset);
  });

  it('provides fallback visuals and brand colors for new providers', () => {
    expect(getProviderFallbackVisual('cursor')).toEqual({
      textClass: 'text-slate-900',
      letter: 'C',
    });
    expect(getProviderFallbackVisual('gitlab')).toEqual({
      textClass: 'text-orange-600',
      letter: 'G',
    });
    expect(getProviderFallbackVisual('codebuddy')).toEqual({
      textClass: 'text-blue-600',
      letter: 'B',
    });
    expect(getProviderFallbackVisual('kilo')).toEqual({
      textClass: 'text-rose-600',
      letter: 'K',
    });

    expect(PROVIDER_COLORS.cursor).toBe('#111827');
    expect(PROVIDER_COLORS.gitlab).toBe('#FC6D26');
    expect(PROVIDER_COLORS.codebuddy).toBe('#2563EB');
    expect(PROVIDER_COLORS.kilo).toBe('#E11D48');
  });
});
