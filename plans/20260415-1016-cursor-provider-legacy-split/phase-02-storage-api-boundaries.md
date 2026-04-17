---
phase: 2
title: "Storage & API Boundaries"
status: partial
effort: "6h"
---

# Phase 2: Storage & API Boundaries

## Context Links

- `plan.md`
- `src/config/unified-config-types.ts`
- `src/config/unified-config-loader.ts`
- `src/cursor/cursor-auth.ts`
- `src/cursor/cursor-daemon-pid.ts`
- `src/cliproxy/config/path-resolver.ts`
- `src/cliproxy/config/env-builder.ts`
- `src/web-server/routes/index.ts`
- `src/web-server/routes/cursor-routes.ts`
- `src/web-server/routes/cursor-settings-routes.ts`
- `src/web-server/routes/cliproxy-stats-routes.ts`
- `src/api/services/profile-lifecycle-service.ts`

## Overview

- Priority: P1
- Owner scope: config schema, path resolution, backend APIs, migration readers
- Goal: make legacy bridge storage explicit and guarantee CLIProxy Cursor never writes the legacy raw settings file

## Key Insights

- Top-level `config.cursor` is bridge-only configuration today and must move.
- The legacy bridge owns `~/.ccs/cursor.settings.json`, `~/.ccs/cursor/credentials.json`, and `~/.ccs/cursor/daemon.pid`.
- CLIProxy provider settings currently resolve through generic provider settings helpers and can still collide with the legacy file for provider `cursor`.
- `~/.ccs/cursor.settings.json` is historically documented as legacy-owned, so it is unsafe to auto-import it into provider storage by default.

## Requirements

- Canonical legacy config key: `legacy.cursor`
- Canonical legacy files:
  - `~/.ccs/legacy/cursor.settings.json`
  - `~/.ccs/legacy/cursor/credentials.json`
  - `~/.ccs/legacy/cursor/daemon.pid`
- Canonical provider file for CLIProxy Cursor only:
  - `~/.ccs/cliproxy/cursor.settings.json`
- Canonical legacy API namespace:
  - `/api/legacy/cursor/*`
- Compatibility reads:
  - read old `config.cursor`
  - read old `~/.ccs/cursor.settings.json`
  - read old `~/.ccs/cursor/*`
- Compatibility writes:
  - write only the new `legacy.*` and `cliproxy/*` paths

## Data Flow

- Legacy config:
  `load config -> prefer legacy.cursor -> fallback config.cursor -> normalize -> write legacy.cursor only`
- Legacy raw settings:
  `load /api/legacy/cursor/settings/raw -> prefer ~/.ccs/legacy/cursor.settings.json -> fallback ~/.ccs/cursor.settings.json -> write new legacy path`
- Provider settings:
  `CLIProxy env builder/stats updater -> read ~/.ccs/cliproxy/cursor.settings.json -> if absent use defaults -> never read/write ~/.ccs/cursor.settings.json`

## Architecture

- Add a `legacy` section to unified config types and loader. Keep old `cursor` as read-only migration input during the compatibility window.
- Move legacy bridge filesystem helpers under a `legacy/cursor` path prefix.
- Split API routing:
  - new canonical mount: `/api/legacy/cursor`
  - release-N alias: `/api/cursor` -> same handlers + deprecation header
- Special-case CLIProxy provider settings for `cursor` only in the provider path resolver. Do not expand this migration to every provider in this issue.
- Treat existing `~/.ccs/cursor.settings.json` as legacy-owned. Do not auto-copy it into provider storage unless a future explicit provider migration is added.

## Related Code Files

- Modify:
  - `src/config/unified-config-types.ts`
  - `src/config/unified-config-loader.ts`
  - `src/cursor/cursor-auth.ts`
  - `src/cursor/cursor-daemon-pid.ts`
  - `src/cliproxy/config/path-resolver.ts`
  - `src/cliproxy/config/env-builder.ts`
  - `src/web-server/routes/index.ts`
  - `src/web-server/routes/cursor-routes.ts`
  - `src/web-server/routes/cursor-settings-routes.ts`
  - `src/web-server/routes/cliproxy-stats-routes.ts`
  - `src/api/services/profile-lifecycle-service.ts`
- Create:
  - `src/web-server/routes/legacy-cursor-routes.ts`
  - `src/web-server/routes/legacy-cursor-settings-routes.ts`
  - `src/config/migrations/cursor-legacy-migration.ts` if migration logic should stay out of the loader

## Implementation Steps

1. Extend config types and loader to support `legacy.cursor`, with `legacy.cursor` taking precedence over old `cursor`.
2. Update legacy bridge credential and pid helpers to use `~/.ccs/legacy/cursor/`.
3. Update the raw settings route to use `~/.ccs/legacy/cursor.settings.json` as canonical and old root path as read fallback only.
4. Move legacy API mounts to `/api/legacy/cursor/*` and keep `/api/cursor/*` as a warned alias for release N.
5. Change CLIProxy Cursor provider settings resolution to `~/.ccs/cliproxy/cursor.settings.json`.
6. Update orphan detection and cleanup logic so old `cursor.settings.json` is treated as a migration target, not a permanent provider-owned file.

## Todo List

- [ ] Add `legacy.cursor` config schema and loader precedence
- [ ] Move bridge credentials/pid/raw settings under `~/.ccs/legacy/`
- [x] Add canonical `/api/legacy/cursor/*` routes
- [x] Keep release-N `/api/cursor/*` alias
- [x] Isolate CLIProxy Cursor settings away from `~/.ccs/cursor.settings.json`
- [ ] Update cleanup/orphan handling

## Success Criteria

- Saving legacy bridge settings writes only to `legacy.cursor` and `~/.ccs/legacy/*`.
- CLIProxy Cursor model/env updates write only to `~/.ccs/cliproxy/cursor.settings.json`.
- Existing legacy users can still read old config/files during the compatibility window.
- No backend route that serves the provider path references `~/.ccs/cursor.settings.json`.

## Risk Assessment

- High likelihood / high impact: old `~/.ccs/cursor.settings.json` contents are ambiguous between bridge and provider expectations.
  Mitigation: treat the file as legacy-owned and do not auto-import it into provider storage.
- Medium likelihood / medium impact: route aliasing may mask which API is canonical.
  Mitigation: add explicit response headers or payload flags marking `/api/cursor/*` as deprecated.

## Rollback Plan

- Keep read fallback from old paths even if the canonical write path changes back.
- If the new legacy API namespace causes regressions, remount `/api/cursor/*` as canonical temporarily and keep the new namespace dormant.
- Do not delete old files during release N; cleanup stays opt-in until release N+2.

## Security Considerations

- Preserve `0600` for migrated credentials and `0700` for directories.
- Use atomic temp-file writes exactly as current routes do.
- Never copy provider tokens into the legacy namespace or legacy tokens into provider storage automatically.

## Next Steps

- Phase 3 depends on the canonical API and path names from this phase.
