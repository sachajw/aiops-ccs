export type CodexEffort = 'medium' | 'high' | 'xhigh';

const CODEX_EFFORT_SUFFIX_REGEX = /-(medium|high|xhigh)$/i;

export function parseCodexEffort(modelId: string | undefined): CodexEffort | undefined {
  if (!modelId) return undefined;
  const match = modelId.trim().match(CODEX_EFFORT_SUFFIX_REGEX);
  if (!match?.[1]) return undefined;
  return match[1].toLowerCase() as CodexEffort;
}

export function getCodexEffortDisplay(
  modelId: string | undefined,
  effortLabels?: { pinned: (effort: string) => string; auto: string }
): { label: string; explicit: boolean } | null {
  if (!modelId) return null;
  const effort = parseCodexEffort(modelId);
  if (effort) {
    return {
      label: effortLabels?.pinned(effort) ?? `Pinned ${effort}`,
      explicit: true,
    };
  }
  return { label: effortLabels?.auto ?? 'Auto effort', explicit: false };
}
