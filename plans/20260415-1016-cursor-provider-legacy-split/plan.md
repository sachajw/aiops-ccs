---
title: "Separate legacy Cursor bridge from CLIProxy Cursor provider"
description: "Reserve `cursor` for the CLIProxy provider, move the reverse-engineered bridge under `legacy`, and split storage/UI with a staged migration."
status: in_progress
priority: P1
effort: 2d
branch: kai/feat/1016-missing-provider-integration
tags: [cursor, cliproxy, migration, dashboard, deprecation]
created: 2026-04-15
blockedBy: []
blocks: []
---

# Separate legacy Cursor bridge from CLIProxy Cursor provider

## Goal

Make `cursor` mean one thing everywhere: the CLIProxy-backed provider. Move the deprecated local bridge to `legacy`, stop provider writes to `~/.ccs/cursor.settings.json`, and ship a low-risk migration window.

## Current Collision Points

- `src/ccs.ts` hardcodes `cursor` as a legacy command/profile, then reclaims only `--auth|--logout|--config|--accounts` for CLIProxy.
- `src/auth/profile-detector.ts` resolves `cursor` to the legacy runtime before CLIProxy provider detection.
- `src/commands/command-catalog.ts` and `src/commands/help-command.ts` advertise `cursor` as both bridge and provider.
- `src/config/unified-config-types.ts` + `src/config/unified-config-loader.ts` store bridge config under top-level `cursor`.
- `src/cliproxy/config/path-resolver.ts`, `src/cliproxy/config/env-builder.ts`, and `src/web-server/routes/cliproxy-stats-routes.ts` still use provider settings paths that collide with the legacy raw file.
- `src/web-server/routes/cursor-*.ts`, `ui/src/pages/cursor.tsx`, `ui/src/hooks/use-cursor.ts`, `ui/src/App.tsx`, and `ui/src/components/layout/app-sidebar.tsx` dedicate `/cursor` and `/api/cursor/*` to the legacy bridge.
- `docs/cursor-integration.md` documents `ccs cursor` as the bridge even though CLIProxy already exposes a `cursor` provider shortcut.

## Command Contract

Before:
```text
ccs cursor                  -> legacy bridge runtime
ccs cursor "task"           -> legacy bridge runtime
ccs cursor auth|status|...  -> legacy bridge admin
ccs cursor --auth|--config  -> CLIProxy Cursor shortcut
```

After release N:
```text
ccs cursor                  -> CLIProxy Cursor runtime
ccs cursor "task"           -> CLIProxy Cursor runtime
ccs cursor --auth|--config  -> CLIProxy Cursor admin
ccs legacy cursor           -> legacy bridge runtime
ccs legacy cursor "task"    -> legacy bridge runtime
ccs legacy cursor auth|...  -> legacy bridge admin
```

Compatibility window, release N only:
- `ccs cursor auth|status|probe|models|start|stop|enable|disable|help` forwards to `ccs legacy cursor ...` with a deprecation warning.
- Bare and positional `ccs cursor` switch immediately to the provider path; no silent legacy fallback.

## Phase Plan

| Phase | Scope | Output |
| --- | --- | --- |
| 1 | [CLI Routing & Namespacing](./phase-01-cli-routing-namespacing.md) | Provider-first `cursor`, explicit `legacy cursor`, updated help/catalog/type names |
| 2 | [Storage & API Boundaries](./phase-02-storage-api-boundaries.md) | `legacy.cursor` config, split file paths, `/api/legacy/cursor/*`, provider path isolation |
| 3 | [Dashboard & Deprecation UX](./phase-03-dashboard-deprecation-ux.md) | `/cursor` -> provider view, `/legacy/cursor` -> bridge view, clear migration UX |
| 4 | [Tests Docs & Rollout](./phase-04-tests-docs-rollout.md) | Compatibility plan, migration steps, test matrix, docs updates, rollback gates |

## Rollout Sequence

1. Release N: add new legacy namespace, flip `ccs cursor` to provider, keep old admin subcommands and `/api/cursor/*` as warned aliases, and split provider settings away from `~/.ccs/cursor.settings.json`.
2. Release N+1: move the remaining legacy backend/config namespaces fully under `legacy.cursor`, keep old file-path fallback and `/api/cursor/*` alias for one more release.
3. Release N+2: remove old `config.cursor` and root-level `~/.ccs/cursor*` fallback reads, delete stale alias docs/help, and let cleanup/migrate remove leftovers.

## Current Implementation Status

- Completed in this branch:
  - `ccs cursor` is provider-first for runtime and `--help`
  - `ccs legacy cursor` works as the explicit legacy bridge namespace
  - old legacy admin subcommands under `ccs cursor ...` forward with deprecation warnings
  - CLIProxy Cursor settings no longer collide with `~/.ccs/cursor.settings.json`
  - `/cursor` redirects to the provider surface while `/legacy/cursor` serves the deprecated bridge page
  - `/api/legacy/cursor/*` is mounted and the legacy page uses that namespace
  - docs, completion, and core regression tests were updated
- Intentionally deferred follow-up:
  - move top-level `config.cursor` to `legacy.cursor`
  - move legacy credentials/pid/raw settings fully under `~/.ccs/legacy/cursor/*`
  - rename `use-cursor` and `CursorPage` modules to explicit `legacy-*`

## Success Criteria

- `cursor` is provider-owned in CLI help, routing, dashboard nav, and docs.
- Legacy bridge is reachable only through `legacy cursor` and `legacy.cursor` storage.
- CLIProxy Cursor never reads or writes `~/.ccs/cursor.settings.json`.
- Existing legacy users have an explicit migration path, warning UX, and rollback-safe compatibility window.

## Docs Impact

Major. CLI reference, Cursor docs, dashboard tour, provider docs, and migration notes all change in the same release.
