import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import getPort from 'get-port';
import {
  getOpenAICompatProxyStatus,
  startOpenAICompatProxy,
  stopOpenAICompatProxy,
} from '../../../src/proxy/proxy-daemon';
import { resolveOpenAICompatProfileConfig } from '../../../src/proxy/profile-router';

let originalCcsHome: string | undefined;
let tempDir: string;

beforeEach(() => {
  originalCcsHome = process.env.CCS_HOME;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-openai-proxy-'));
  process.env.CCS_HOME = tempDir;
});

afterEach(async () => {
  await stopOpenAICompatProxy();
  if (originalCcsHome !== undefined) {
    process.env.CCS_HOME = originalCcsHome;
  } else {
    delete process.env.CCS_HOME;
  }
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('openai proxy daemon lifecycle', () => {
  it('starts, reports status, serves health/models, and stops', async () => {
    const port = await getPort();
    const settingsPath = path.join(tempDir, 'hf.settings.json');
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        env: {
          ANTHROPIC_BASE_URL: 'http://127.0.0.1:11434',
          ANTHROPIC_AUTH_TOKEN: 'ollama',
          ANTHROPIC_MODEL: 'qwen3-coder',
          CCS_DROID_PROVIDER: 'generic-chat-completion-api',
        },
      }),
      'utf8'
    );

    const profile = resolveOpenAICompatProfileConfig('hf', settingsPath, {
      ANTHROPIC_BASE_URL: 'http://127.0.0.1:11434',
      ANTHROPIC_AUTH_TOKEN: 'ollama',
      ANTHROPIC_MODEL: 'qwen3-coder',
      CCS_DROID_PROVIDER: 'generic-chat-completion-api',
    });
    if (!profile) {
      throw new Error('Expected an OpenAI-compatible profile');
    }

    const started = await startOpenAICompatProxy(profile, { port });
    expect(started.success).toBe(true);
    expect(started.authToken).toBeTruthy();

    const status = await getOpenAICompatProxyStatus();
    expect(status.running).toBe(true);
    expect(status.profileName).toBe('hf');
    expect(status.authToken).toBe(started.authToken);

    const health = await fetch(`http://127.0.0.1:${port}/health`);
    expect(health.status).toBe(200);

    const models = (await (
      await fetch(`http://127.0.0.1:${port}/v1/models`, {
        headers: { 'x-api-key': started.authToken! },
      })
    ).json()) as { data?: Array<{ id: string }> };
    expect(models.data?.map((entry) => entry.id)).toEqual(['qwen3-coder']);

    const stopped = await stopOpenAICompatProxy();
    expect(stopped.success).toBe(true);
    expect((await getOpenAICompatProxyStatus()).running).toBe(false);
  }, 35000);

  it('refuses to replace a running proxy for a different profile', async () => {
    const firstPort = await getPort();
    const firstSettingsPath = path.join(tempDir, 'hf.settings.json');
    fs.writeFileSync(
      firstSettingsPath,
      JSON.stringify({
        env: {
          ANTHROPIC_BASE_URL: 'http://127.0.0.1:11434',
          ANTHROPIC_AUTH_TOKEN: 'ollama',
          ANTHROPIC_MODEL: 'qwen3-coder',
          CCS_DROID_PROVIDER: 'generic-chat-completion-api',
        },
      }),
      'utf8'
    );
    const firstProfile = resolveOpenAICompatProfileConfig('hf', firstSettingsPath, {
      ANTHROPIC_BASE_URL: 'http://127.0.0.1:11434',
      ANTHROPIC_AUTH_TOKEN: 'ollama',
      ANTHROPIC_MODEL: 'qwen3-coder',
      CCS_DROID_PROVIDER: 'generic-chat-completion-api',
    });
    if (!firstProfile) {
      throw new Error('Expected first OpenAI-compatible profile');
    }

    const firstStart = await startOpenAICompatProxy(firstProfile, { port: firstPort });
    expect(firstStart.success).toBe(true);

    const secondProfile = resolveOpenAICompatProfileConfig('openai', path.join(tempDir, 'openai.settings.json'), {
      ANTHROPIC_BASE_URL: 'https://api.openai.com/v1',
      ANTHROPIC_AUTH_TOKEN: 'sk-openai',
      ANTHROPIC_MODEL: 'gpt-4.1',
    });
    if (!secondProfile) {
      throw new Error('Expected second OpenAI-compatible profile');
    }

    const secondStart = await startOpenAICompatProxy(secondProfile, { port: await getPort() });
    expect(secondStart.success).toBe(false);
    expect(secondStart.error).toContain('Proxy already running for profile "hf"');

    const health = await fetch(`http://127.0.0.1:${firstPort}/health`);
    expect(health.status).toBe(200);
  });
});
