---
phase: 1
title: "CLI Routing & Namespacing"
status: complete
effort: "6h"
---

# Phase 1: CLI Routing & Namespacing

## Context Links

- `plan.md`
- `src/ccs.ts`
- `src/auth/profile-detector.ts`
- `src/cursor/constants.ts`
- `src/commands/root-command-router.ts`
- `src/commands/command-catalog.ts`
- `src/commands/help-command.ts`
- `src/commands/cursor-command.ts`
- `src/commands/cursor-command-display.ts`
- `src/types/profile.ts`
- `src/config/reserved-names.ts`

## Overview

- Priority: P1
- Owner scope: CLI entry, help, profile detection, command naming
- Goal: make `cursor` provider-first and move the deprecated bridge under `legacy cursor`

## Key Insights

- The current collision is structural, not cosmetic. `ccs cursor` means "legacy bridge" in `src/ccs.ts` and `src/auth/profile-detector.ts`, but `cursor` is also listed as a built-in CLIProxy provider.
- `shouldUseCursorCliproxyShortcut()` is only a heuristic escape hatch. It does not fix bare `ccs cursor`, quoted prompts, or help routing.
- Help is currently inconsistent: provider help exists generically, but `cursor` is excluded and routed to bridge help instead.

## Requirements

- Reserve `cursor` for CLIProxy runtime and CLIProxy admin flags.
- Introduce explicit legacy syntax: `ccs legacy cursor ...`.
- Keep a release-N alias for old legacy admin subcommands only.
- Rename internal bridge-only profile typing from ambiguous `cursor` to explicit `legacy-cursor`.
- Keep file ownership isolated to CLI/router/help files in this phase.

## Data Flow

- Provider path:
  `argv -> root command resolution -> provider shortcut/help path -> ProfileDetector(type=cliproxy, provider=cursor) -> CLIProxy runtime`
- Legacy path:
  `argv -> legacy root command -> legacy cursor subrouter -> ProfileDetector(type=legacy-cursor) or direct handler -> local bridge runtime`
- Deprecated alias path, release N only:
  `argv=ccs cursor auth|status|... -> alias shim -> warning -> dispatch to legacy cursor handler`

## Architecture

- Add a new root command namespace: `ccs legacy`.
- Add nested routing under `legacy` with `cursor` as the first migrated leaf. Do not overload `cursor` itself any longer.
- Remove provider exceptions for `cursor` from the generic provider help/routing logic. `ccs cursor --help` should now use provider shortcut help.
- Convert bridge-only type checks from `profileInfo.type === 'cursor'` to `profileInfo.type === 'legacy-cursor'`.
- Keep `ccs cursor help` only as a release-N compatibility shim that prints:
  - `Use "ccs cursor --help" for CLIProxy Cursor`
  - `Use "ccs legacy cursor help" for the deprecated bridge`

## Related Code Files

- Modify:
  - `src/ccs.ts`
  - `src/auth/profile-detector.ts`
  - `src/cursor/constants.ts`
  - `src/commands/root-command-router.ts`
  - `src/commands/command-catalog.ts`
  - `src/commands/help-command.ts`
  - `src/commands/cursor-command.ts`
  - `src/commands/cursor-command-display.ts`
  - `src/types/profile.ts`
  - `src/config/reserved-names.ts`
  - `src/shared/claude-extension-setup.ts`
  - `src/targets/target-runtime-compatibility.ts`
- Create:
  - `src/commands/legacy-command.ts` or `src/commands/legacy/index.ts`
  - `src/commands/legacy/cursor-command.ts` if the team wants physical separation immediately

## Implementation Steps

1. Add the `legacy` root command route and its help surface.
2. Flip `src/ccs.ts` so `cursor` goes through normal CLIProxy provider routing; remove the special-case that gives the bridge ownership of the name.
3. Replace the `shouldUseCursorCliproxyShortcut()` hack with provider-first dispatch plus a compatibility alias table for the old legacy subcommands.
4. Update `ProfileDetector` priority order so `cursor` resolves as `cliproxy`, while `legacy cursor` resolves as `legacy-cursor`.
5. Rename bridge-only help text, summaries, and status text to say "legacy Cursor bridge" explicitly.
6. Audit all `profileType === 'cursor'` checks and convert only the bridge-specific ones to `legacy-cursor`.

## Todo List

- [x] Add `legacy cursor` routing
- [x] Make `ccs cursor` provider-first for bare, prompt, and `--help` usage
- [x] Add deprecated alias forwarding for old admin subcommands
- [x] Rename internal bridge profile path to `legacy-cursor`
- [x] Update provider help, completion, and command catalog summaries

## Success Criteria

- `ccs cursor "task"` resolves to CLIProxy Cursor.
- `ccs legacy cursor "task"` resolves to the old bridge.
- `ccs cursor --help` shows provider shortcut help.
- `ccs cursor auth` still works in release N, but prints an exact replacement warning.
- No CLI path depends on `shouldUseCursorCliproxyShortcut()` to disambiguate runtime meaning.

## Risk Assessment

- High likelihood / high impact: users with scripts calling `ccs cursor "task"` will hit the provider path immediately.
  Mitigation: call this out in release notes, keep admin aliases, add explicit warning when legacy files/config are detected and the user invokes `ccs cursor` with no flags.
- Medium likelihood / medium impact: bridge-only type renames may break target compatibility checks or extension setup.
  Mitigation: grep audit every `profileType === 'cursor'` branch before tests.

## Rollback Plan

- Re-enable the old `cursor` special-case in `src/ccs.ts` and `ProfileDetector`.
- Keep the new `legacy` namespace in place even if dormant; it is additive and safe to leave.
- Do not roll back migrated files in this phase; routing rollback alone is enough.

## Security Considerations

- No auth material moves in this phase.
- Preserve existing `CCS_HOME`-aware path resolution. Do not introduce `os.homedir()` shortcuts while adding the new namespace.

## Next Steps

- Phase 2 depends on the new command contract from this phase.
