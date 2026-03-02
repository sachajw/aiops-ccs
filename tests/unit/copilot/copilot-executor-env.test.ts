import { describe, expect, it } from 'bun:test';
import { generateCopilotEnv } from '../../../src/copilot/copilot-executor';
import type { CopilotConfig } from '../../../src/config/unified-config-types';

const baseConfig: CopilotConfig = {
  enabled: true,
  auto_start: false,
  port: 4141,
  account_type: 'individual',
  rate_limit: null,
  wait_on_limit: true,
  model: 'gpt-4.1',
};

describe('generateCopilotEnv', () => {
  it('includes inherited CLAUDE_CONFIG_DIR when provided', () => {
    const env = generateCopilotEnv(baseConfig, '/tmp/.ccs/instances/pro');
    expect(env.CLAUDE_CONFIG_DIR).toBe('/tmp/.ccs/instances/pro');
  });

  it('omits CLAUDE_CONFIG_DIR when inheritance is not configured', () => {
    const env = generateCopilotEnv(baseConfig);
    expect(env.CLAUDE_CONFIG_DIR).toBeUndefined();
  });
});

