import * as fs from 'fs';
import {
  getConfigJsonPath,
  getContinuityInheritanceMap,
  isUnifiedMode,
} from '../config/unified-config-loader';
import { warn } from '../utils/ui';
import InstanceManager from '../management/instance-manager';
import ProfileRegistry from './profile-registry';
import { isAccountContextMetadata, resolveAccountContextPolicy } from './account-context';
import type { ProfileType } from '../types/profile';

export interface ProfileContinuityInheritanceInput {
  profileName: string;
  profileType: ProfileType;
  target: string;
}

export interface ProfileContinuityInheritanceResult {
  sourceAccount?: string;
  claudeConfigDir?: string;
}

function loadLegacyContinuityInheritanceMap(): Record<string, string> {
  const configJsonPath = getConfigJsonPath();
  if (!fs.existsSync(configJsonPath)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(configJsonPath, 'utf8');
    const parsed = JSON.parse(raw) as { continuity_inherit_from_account?: unknown };
    if (
      typeof parsed.continuity_inherit_from_account !== 'object' ||
      parsed.continuity_inherit_from_account === null ||
      Array.isArray(parsed.continuity_inherit_from_account)
    ) {
      return {};
    }

    const normalized: Record<string, string> = {};
    for (const [profileName, accountName] of Object.entries(
      parsed.continuity_inherit_from_account as Record<string, unknown>
    )) {
      if (typeof accountName !== 'string') continue;
      const normalizedProfile = profileName.trim();
      const normalizedAccount = accountName.trim();
      if (!normalizedProfile || !normalizedAccount) continue;
      normalized[normalizedProfile] = normalizedAccount;
    }

    return normalized;
  } catch {
    return {};
  }
}

function resolveMappedAccount(
  profileName: string,
  inheritFromAccount: Record<string, string>
): string | undefined {
  const mapped = inheritFromAccount[profileName];
  if (typeof mapped !== 'string') {
    return undefined;
  }

  const normalized = mapped.trim();
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Resolve optional cross-profile continuity inheritance.
 *
 * Rules:
 * - Claude target only.
 * - Never applies to account profiles.
 * - Mapping source must be an account profile.
 */
export async function resolveProfileContinuityInheritance(
  input: ProfileContinuityInheritanceInput
): Promise<ProfileContinuityInheritanceResult> {
  if (input.target !== 'claude' || input.profileType === 'account') {
    return {};
  }

  const inheritFromAccount = getContinuityInheritanceMap();
  const sourceAccount =
    resolveMappedAccount(input.profileName, inheritFromAccount) ??
    (!isUnifiedMode()
      ? resolveMappedAccount(input.profileName, loadLegacyContinuityInheritanceMap())
      : undefined);
  if (!sourceAccount) {
    return {};
  }

  const registry = new ProfileRegistry();
  const profiles = registry.getAllProfilesMerged();
  const mappedProfile = profiles[sourceAccount];
  if (!mappedProfile || mappedProfile.type !== 'account') {
    console.error(
      warn(
        `Continuity inheritance skipped for "${input.profileName}": source account "${sourceAccount}" not found`
      )
    );
    return {};
  }

  const contextPolicy = resolveAccountContextPolicy(
    isAccountContextMetadata(mappedProfile) ? mappedProfile : undefined
  );
  const instanceMgr = new InstanceManager();
  const instancePath = await instanceMgr.ensureInstance(sourceAccount, contextPolicy);

  // Best-effort touch only; execution must continue even if touch fails.
  try {
    if (registry.hasAccountUnified(sourceAccount)) {
      registry.touchAccountUnified(sourceAccount);
    } else if (registry.hasProfile(sourceAccount)) {
      registry.touchProfile(sourceAccount);
    }
  } catch {
    // Ignore metadata touch failure.
  }

  return {
    sourceAccount,
    claudeConfigDir: instancePath,
  };
}
