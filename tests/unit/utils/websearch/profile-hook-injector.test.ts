import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ensureProfileHooks } from '../../../../src/utils/websearch/profile-hook-injector';
import { getHookPath } from '../../../../src/utils/websearch/hook-config';
import { getMigrationMarkerPath } from '../../../../src/utils/websearch/hook-installer';

describe('ensureProfileHooks', () => {
  let tempHome: string | undefined;
  let originalCcsHome: string | undefined;
  let originalClaudeConfigDir: string | undefined;

  function setupTempHome(): string {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-profile-hook-test-'));
    originalCcsHome = process.env.CCS_HOME;
    originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
    process.env.CCS_HOME = tempHome;
    delete process.env.CLAUDE_CONFIG_DIR;
    return tempHome;
  }

  function getCcsDir(): string {
    if (!tempHome) {
      throw new Error('tempHome not initialized');
    }
    return path.join(tempHome, '.ccs');
  }

  afterEach(() => {
    mock.restore();

    if (originalCcsHome !== undefined) {
      process.env.CCS_HOME = originalCcsHome;
    } else {
      delete process.env.CCS_HOME;
    }

    if (originalClaudeConfigDir !== undefined) {
      process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
    } else {
      delete process.env.CLAUDE_CONFIG_DIR;
    }

    if (tempHome && fs.existsSync(tempHome)) {
      fs.rmSync(tempHome, { recursive: true, force: true });
    }

    tempHome = undefined;
    originalCcsHome = undefined;
    originalClaudeConfigDir = undefined;
  });

  it('installs the hook binary before writing the profile hook command', () => {
    setupTempHome();

    const ensured = ensureProfileHooks('glm');
    const hookPath = getHookPath();
    const settingsPath = path.join(tempHome, '.ccs', 'glm.settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

    expect(ensured).toBe(true);
    expect(fs.existsSync(hookPath)).toBe(true);
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe(`node "${hookPath}"`);
  });

  it('succeeds when the hook already exists on disk and installation is effectively a no-op', () => {
    setupTempHome();

    const hookPath = getHookPath();
    fs.mkdirSync(path.dirname(hookPath), { recursive: true });
    fs.writeFileSync(hookPath, '// existing hook', 'utf8');

    const copyFileSpy = spyOn(fs, 'copyFileSync').mockImplementation(() => {
      throw new Error('copy skipped');
    });

    const ensured = ensureProfileHooks('glm');
    const settingsPath = path.join(getCcsDir(), 'glm.settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

    expect(ensured).toBe(true);
    expect(copyFileSpy).toHaveBeenCalled();
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe(`node "${hookPath}"`);
  });

  it('returns false for invalid profile names without creating files', () => {
    setupTempHome();

    const ensured = ensureProfileHooks('../glm');

    expect(ensured).toBe(false);
    expect(fs.existsSync(getCcsDir())).toBe(false);
  });

  it('returns false when WebSearch is disabled without creating files', () => {
    setupTempHome();

    fs.mkdirSync(getCcsDir(), { recursive: true });
    fs.writeFileSync(
      path.join(getCcsDir(), 'config.yaml'),
      'version: 12\nwebsearch:\n  enabled: false\n',
      'utf8'
    );

    const ensured = ensureProfileHooks('glm');

    expect(ensured).toBe(false);
    expect(fs.existsSync(getHookPath())).toBe(false);
    expect(fs.existsSync(path.join(getCcsDir(), 'glm.settings.json'))).toBe(false);
  });

  it('returns false when hook installation fails and no hook exists on disk', () => {
    setupTempHome();

    const claudeSettingsPath = path.join(tempHome, '.claude', 'settings.json');
    fs.mkdirSync(path.dirname(claudeSettingsPath), { recursive: true });
    const globalSettings = {
      hooks: {
        PreToolUse: [
          {
            matcher: 'WebSearch',
            hooks: [
              {
                type: 'command',
                command: `node "${getHookPath()}"`,
                timeout: 90,
              },
            ],
          },
        ],
      },
    };
    fs.writeFileSync(claudeSettingsPath, JSON.stringify(globalSettings, null, 2), 'utf8');

    const copyFileSpy = spyOn(fs, 'copyFileSync').mockImplementation(() => {
      throw new Error('copy failed');
    });

    const ensured = ensureProfileHooks('glm');
    const persistedGlobalSettings = JSON.parse(fs.readFileSync(claudeSettingsPath, 'utf8'));

    expect(ensured).toBe(false);
    expect(copyFileSpy).toHaveBeenCalled();
    expect(fs.existsSync(getHookPath())).toBe(false);
    expect(fs.existsSync(getMigrationMarkerPath())).toBe(false);
    expect(fs.existsSync(path.join(getCcsDir(), 'glm.settings.json'))).toBe(false);
    expect(persistedGlobalSettings).toEqual(globalSettings);
  });
});
