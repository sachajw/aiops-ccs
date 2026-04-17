---
phase: 3
title: "Dashboard & Deprecation UX"
status: partial
effort: "4h"
---

# Phase 3: Dashboard & Deprecation UX

## Context Links

- `plan.md`
- `ui/src/App.tsx`
- `ui/src/components/layout/app-sidebar.tsx`
- `ui/src/pages/cursor.tsx`
- `ui/src/hooks/use-cursor.ts`
- `ui/src/lib/i18n.ts`
- `src/web-server/routes/index.ts`
- `src/commands/cursor-command-display.ts`

## Overview

- Priority: P1
- Owner scope: dashboard route ownership, labels, user-facing deprecation messaging
- Goal: align dashboard semantics with CLI semantics so `/cursor` means provider and legacy UI is clearly marked and isolated

## Key Insights

- The current dashboard already admits the bridge is deprecated, but the route `/cursor` still belongs to it.
- The page includes direct navigation to CLIProxy Cursor, which means the UX already wants a split; the route layer just has not caught up.
- Keeping `/cursor` for legacy while CLI uses `cursor` for provider would create the same ambiguity in a different surface.

## Requirements

- `/cursor` must become the provider-owned dashboard surface.
- The legacy bridge page must move to `/legacy/cursor`.
- Legacy bridge API hooks must move to `/api/legacy/cursor/*`.
- The deprecated UX must contain exact replacements, not generic warnings.
- Sidebar grouping must reflect support level:
  - provider view under provider/cliproxy navigation
  - legacy bridge under deprecated navigation

## Data Flow

- Provider dashboard:
  `browser /cursor -> provider view or redirect wrapper -> /cliproxy?provider=cursor -> existing CLIProxy provider APIs`
- Legacy dashboard:
  `browser /legacy/cursor -> legacy bridge page -> useLegacyCursor hook -> /api/legacy/cursor/*`
- Compatibility API path, release N only:
  `old UI/tests -> /api/cursor/* -> alias handler -> same legacy payload + deprecation signal`

## Architecture

- Keep provider UI DRY by making `/cursor` a thin redirect or preselected wrapper around the existing CLIProxy provider page instead of building a second Cursor-provider page.
- Move the current `ui/src/pages/cursor.tsx` implementation to a new `legacy-cursor` page and rename its hook to `useLegacyCursor`.
- Change nav labels from generic "Cursor IDE" to explicit "Cursor Bridge (Legacy)" in the deprecated section.
- Update CLI and dashboard warnings to show both paths side-by-side:
  - `ccs cursor --auth` / `/cursor`
  - `ccs legacy cursor auth` / `/legacy/cursor`

## Related Code Files

- Modify:
  - `ui/src/App.tsx`
  - `ui/src/components/layout/app-sidebar.tsx`
  - `ui/src/lib/i18n.ts`
  - `src/commands/cursor-command-display.ts`
- Move or rename:
  - `ui/src/pages/cursor.tsx` -> `ui/src/pages/legacy-cursor.tsx`
  - `ui/src/hooks/use-cursor.ts` -> `ui/src/hooks/use-legacy-cursor.ts`
- Create:
  - `ui/src/pages/cursor-provider-redirect.tsx` if a wrapper is preferred over direct router config

## Implementation Steps

1. Move the legacy page and hook to `legacy-*` names and update all imports.
2. Reassign `/cursor` to the provider path and add `/legacy/cursor` for the bridge page.
3. Update sidebar grouping and labels so the provider path is no longer listed under Deprecated.
4. Replace vague deprecated copy with concrete migration copy:
  - old command
  - new command
  - old route
  - new route
5. Keep the legacy page banner persistent until release N+2, not dismissible per session.

## Todo List

- [ ] Move legacy page/hook module names to `legacy-*`
- [x] Reassign `/cursor` and add `/legacy/cursor`
- [x] Update deprecated nav group and labels
- [x] Rewrite key banners, button copy, and path labels with exact replacements
- [x] Keep provider and legacy links visible from both surfaces during release N

## Success Criteria

- Opening `/cursor` lands on the CLIProxy Cursor provider surface.
- Opening `/legacy/cursor` lands on the bridge page with a persistent deprecation banner.
- No dashboard component serving the provider route uses the legacy API hook.
- Every warning banner shows the exact before/after command and route.

## Risk Assessment

- Medium likelihood / medium impact: users with bookmarked `/cursor` expect the legacy page.
  Mitigation: provider page shows a top-level "Looking for the old bridge?" callout linking to `/legacy/cursor`.
- Low likelihood / medium impact: UI rename churn breaks lazy imports or tests.
  Mitigation: do route and hook rename in one phase and leave compatibility API alias in place until tests pass.

## Rollback Plan

- Point `/cursor` back to the legacy page if the provider redirect breaks.
- Keep `/legacy/cursor` additive; it does not block rollback.
- Do not remove the deprecation banner on rollback; it still communicates future intent.

## Security Considerations

- No auth secrets should be exposed in UI copy or route params.
- Keep manual auth dialogs scoped to the legacy page only. Provider auth remains in CLIProxy flows.

## Next Steps

- Phase 4 owns test rewrites, docs updates, and release gating for these UI changes.
