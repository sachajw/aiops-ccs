import { describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { handleTokensCommand } from '../../../src/commands/tokens-command';
import { getConfigYamlPath, loadUnifiedConfig } from '../../../src/config/unified-config-loader';
import { runWithScopedCcsHome, setGlobalConfigDir } from '../../../src/utils/config-manager';

async function withScopedTokensHome<T>(run: (tempHome: string) => Promise<T>): Promise<T> {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-tokens-rotation-'));
  setGlobalConfigDir(undefined);

  try {
    return await runWithScopedCcsHome(tempHome, async () => await run(tempHome));
  } finally {
    setGlobalConfigDir(undefined);
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
}

describe('tokens command auth rotation', () => {
  it('applies api-key and regenerated secret in a single invocation', async () => {
    await withScopedTokensHome(async () => {
      const exitCode = await handleTokensCommand([
        '--api-key',
        'ccs-custom-key-123',
        '--regenerate-secret',
      ]);

      const config = loadUnifiedConfig();
      const managementSecret = config?.cliproxy.auth?.management_secret;
      const configYamlPath = getConfigYamlPath();

      const diagnostics = {
        exitCode,
        configYamlPath,
        configExists: fs.existsSync(configYamlPath),
        apiKey: config?.cliproxy.auth?.api_key ?? null,
        managementSecretLength: (managementSecret ?? '').length,
      };

      if (
        exitCode !== 0 ||
        config?.cliproxy.auth?.api_key !== 'ccs-custom-key-123' ||
        typeof managementSecret !== 'string' ||
        (managementSecret ?? '').length <= 20
      ) {
        throw new Error(`tokens rotation diagnostics: ${JSON.stringify(diagnostics)}`);
      }
    });
  });

  it('rejects conflicting manual and generated secret flags', async () => {
    await withScopedTokensHome(async () => {
      const exitCode = await handleTokensCommand([
        '--secret',
        'manual-secret',
        '--regenerate-secret',
      ]);

      expect(exitCode).toBe(1);
      expect(fs.existsSync(getConfigYamlPath())).toBe(false);
    });
  });
});
