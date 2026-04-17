---
phase: 4
title: "Tests Docs & Rollout"
status: complete
effort: "4h"
---

# Phase 4: Tests Docs & Rollout

## Context Links

- `plan.md`
- `docs/cursor-integration.md`
- `README.md`
- `docs/system-architecture/provider-flows.md`
- `docs/system-architecture/index.md`
- `tests/unit/cursor/cursor-shortcut-routing.test.ts`
- `tests/unit/web-server/cursor-settings-routes.test.ts`
- `tests/unit/web-server/cursor-routes.test.ts`
- `ui/tests/unit/hooks/use-cursor.test.tsx`
- `ui/tests/unit/ui/pages/cursor-page.test.tsx`

## Overview

- Priority: P1
- Owner scope: compatibility rollout, validation, docs/help updates, release notes
- Goal: ship the namespace split without surprising existing bridge users or leaving docs/help inconsistent

## Key Insights

- This change has one intentional breaking behavior: positional `ccs cursor` stops being the legacy bridge.
- Everything else can use a compatibility window: admin subcommands, API aliases, old config reads, old file-path reads.
- Tests must lock both meanings so the ambiguity does not regress later.

## Requirements

- Document exact before/after commands and routes.
- Add a concrete migration path for three user groups:
  - legacy bridge users
  - CLIProxy Cursor users
  - dashboard bookmark users
- Define removal windows for aliases and old path fallbacks.
- Run repo quality gates after implementation:
  - root: `bun run format && bun run lint:fix && bun run validate && bun run validate:ci-parity`
  - UI: `cd ui && bun run format && bun run lint:fix && bun run validate`

## Test Matrix

- Unit:
  - provider-first cursor routing
  - legacy alias forwarding
  - `legacy.cursor` loader precedence
  - path resolvers for legacy vs provider files
  - deprecation help text snapshots
- Integration:
  - `ccs cursor "task"` -> provider
  - `ccs legacy cursor "task"` -> bridge
  - `/api/legacy/cursor/*` canonical behavior
  - `/api/cursor/*` alias behavior during release N
- UI:
  - `/cursor` route ownership
  - `/legacy/cursor` banner and actions
  - hook path changes and raw settings save targets
- Manual release validation:
  - migrate old config/files in a temp `CCS_HOME`
  - verify provider path never writes `~/.ccs/cursor.settings.json`

## User Migration Plan

1. Legacy bridge users:
   - replace `ccs cursor ...` with `ccs legacy cursor ...`
   - run `ccs legacy cursor status`
   - update scripts and dashboard bookmarks to `/legacy/cursor`
2. CLIProxy Cursor users:
   - keep using `ccs cursor ...`
   - if provider-specific settings are needed, re-save them under the new provider-owned path instead of relying on `~/.ccs/cursor.settings.json`
3. Mixed/unclear state:
   - `ccs migrate` should move `config.cursor` and legacy files into the new legacy namespace
   - do not auto-copy the old raw settings file into provider storage

## Deprecation UX Plan

- CLI warning text, release N:
  - `ccs cursor auth` is deprecated. Use `ccs legacy cursor auth` for the old bridge or `ccs cursor --auth` for CLIProxy Cursor.
- Dashboard banner:
  - visible on `/legacy/cursor`
  - provider route links back to legacy route with "Looking for the old bridge?"
- Docs banner:
  - top callout in `docs/cursor-integration.md` pointing users to CLIProxy Cursor as the supported path

## Related Code Files

- Modify tests:
  - `tests/unit/cursor/cursor-shortcut-routing.test.ts`
  - `tests/unit/web-server/cursor-settings-routes.test.ts`
  - `tests/unit/web-server/cursor-routes.test.ts`
  - `ui/tests/unit/hooks/use-cursor.test.tsx`
  - `ui/tests/unit/ui/pages/cursor-page.test.tsx`
- Modify docs:
  - `docs/cursor-integration.md`
  - `README.md` if root command examples mention Cursor
  - `docs/system-architecture/provider-flows.md`
  - `docs/system-architecture/index.md`
  - CLI help snapshots or generated references if present

## Implementation Steps

1. Rewrite tests around the new command contract and route ownership before removing aliases in later releases.
2. Update docs/help text in the same PR as code changes so the new syntax ships atomically.
3. Add migration notes to changelog/release notes with a bold callout that `ccs cursor "task"` now means CLIProxy Cursor.
4. Keep a removal checklist for release N+1 and N+2 in the plan or roadmap so the compatibility window does not become permanent.

## Todo List

- [x] Update unit, integration, and selected UI tests
- [x] Update docs and CLI help text
- [x] Add migration note and deprecation wording
- [x] Run root and UI quality gates
- [x] Record alias-removal follow-up for N+1 and old-path-removal follow-up for N+2

## Success Criteria

- Test suite covers both provider and legacy cursor paths explicitly.
- Docs and help text match the shipped command contract exactly.
- Release notes include the migration table and deprecation window.
- Quality gates pass in both root and `ui/`.

## Risk Assessment

- High likelihood / medium impact: docs or tests lag behind the command flip and users keep invoking the wrong surface.
  Mitigation: block merge until help text, docs, and tests all match the new contract.
- Medium likelihood / medium impact: compatibility shims never get removed.
  Mitigation: create follow-up issues or roadmap entries for N+1 and N+2 removal work before merge.

## Rollback Plan

- If rollout messaging is incomplete, revert the command flip before removing aliases.
- If only docs/help are wrong, fix docs first and keep aliases until corrected.
- Old-path readers stay in place through N+1, so rollback does not strand migrated users.

## Security Considerations

- Use temp `CCS_HOME` in tests and manual verification. Never touch the real `~/.ccs`.
- Sanitize any migration logs or warnings so they mention paths, not token contents.

## Next Steps

- Implementation is complete when all four phases land together; do not ship phase 1 without phases 2-4.
