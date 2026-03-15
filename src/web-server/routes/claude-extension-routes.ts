import { Router, Request, Response } from 'express';
import {
  CLAUDE_EXTENSION_HOSTS,
  type ClaudeExtensionHost,
  getClaudeExtensionHostDefinition,
} from '../../shared/claude-extension-hosts';
import {
  getClaudeSharedSettingsPath,
  listClaudeExtensionProfiles,
  renderClaudeExtensionSettingsJson,
  renderSharedClaudeSettingsJson,
  resolveClaudeExtensionSetup,
} from '../../shared/claude-extension-setup';

const router = Router();
const VALID_HOSTS = new Set(CLAUDE_EXTENSION_HOSTS.map((host) => host.id));

function getHostFromRequest(req: Request): ClaudeExtensionHost {
  const rawHost = String(req.query.host || 'vscode');
  if (!VALID_HOSTS.has(rawHost as ClaudeExtensionHost)) {
    throw new Error(
      `Invalid host "${rawHost}". Use: ${CLAUDE_EXTENSION_HOSTS.map((host) => host.id).join(', ')}`
    );
  }
  return rawHost as ClaudeExtensionHost;
}

router.get('/profiles', (_req: Request, res: Response): void => {
  res.json({
    profiles: listClaudeExtensionProfiles(),
    hosts: CLAUDE_EXTENSION_HOSTS,
  });
});

router.get('/setup', async (req: Request, res: Response): Promise<void> => {
  const rawProfile = typeof req.query.profile === 'string' ? req.query.profile.trim() : '';
  if (!rawProfile) {
    res.status(400).json({ error: 'Missing required query parameter: profile' });
    return;
  }

  try {
    const host = getHostFromRequest(req);
    const setup = await resolveClaudeExtensionSetup(rawProfile);
    const hostDefinition = getClaudeExtensionHostDefinition(host);

    res.json({
      profile: {
        requestedProfile: setup.requestedProfile,
        resolvedProfileName: setup.resolvedProfileName,
        profileType: setup.profileType,
        label: setup.profileLabel,
        description: setup.profileDescription,
      },
      host: hostDefinition,
      env: Object.entries(setup.extensionEnv).map(([name, value]) => ({ name, value })),
      warnings: setup.warnings,
      notes: setup.notes,
      removeEnvKeys: setup.removeEnvKeys,
      sharedSettings: {
        path: getClaudeSharedSettingsPath(),
        command: `ccs persist ${rawProfile}`,
        json: renderSharedClaudeSettingsJson(setup),
      },
      ideSettings: {
        targetLabel: hostDefinition.settingsTargetLabel,
        json: renderClaudeExtensionSettingsJson(setup, host),
      },
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;
