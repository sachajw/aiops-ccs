import {
  AlertCircle,
  ArrowRight,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  TimerReset,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorLogsMonitor } from '@/components/error-logs-monitor';
import { LogsConfigCard } from '@/components/logs/logs-config-card';
import { LogsDetailPanel } from '@/components/logs/logs-detail-panel';
import { LogsEntryList } from '@/components/logs/logs-entry-list';
import { LogsFilters } from '@/components/logs/logs-filters';
import { LogsOverviewCards } from '@/components/logs/logs-overview-cards';
import { LogsPageSkeleton } from '@/components/logs/logs-page-skeleton';
import { getSourceLabelMap, useLogsWorkspace, useUpdateLogsConfig } from '@/hooks/use-logs';

export function LogsPage() {
  const workspace = useLogsWorkspace();
  const updateConfig = useUpdateLogsConfig();
  const sourceLabels = getSourceLabelMap(workspace.sourcesQuery.data ?? []);
  const errors = [
    workspace.configQuery.error,
    workspace.sourcesQuery.error,
    workspace.entriesQuery.error,
  ].filter(Boolean) as Error[];

  if (workspace.isInitialLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <LogsPageSkeleton />
      </div>
    );
  }

  const config = workspace.configQuery.data;
  if (!config) {
    return null;
  }

  return (
    <div className="p-6 space-y-5">
      <div className="relative overflow-hidden rounded-3xl border bg-[linear-gradient(135deg,var(--background)_0%,color-mix(in_oklab,var(--card)_84%,var(--muted))_100%)] p-6 shadow-sm">
        <div className="pointer-events-none absolute -right-10 top-1/2 hidden -translate-y-1/2 select-none text-[120px] font-semibold tracking-[-0.08em] text-foreground/5 xl:block">
          LOGS
        </div>
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
              <ScrollText className="h-3.5 w-3.5" />
              System logs
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                Operational log workspace
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-[15px]">
                Work through the CCS event stream like a control center: source-first filtering,
                dense entry inspection, and retention controls beside the live activity feed.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[26rem]">
            <Card className="border-border/70 bg-background/70 shadow-none">
              <CardContent className="space-y-1 p-4">
                <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Redaction
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {config.redact ? 'Active' : 'Disabled'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Sensitive fields are masked before persistence.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-background/70 shadow-none">
              <CardContent className="space-y-1 p-4">
                <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  <TimerReset className="h-3.5 w-3.5" />
                  Retention
                </div>
                <p className="text-lg font-semibold text-foreground">{config.retain_days} days</p>
                <p className="text-xs text-muted-foreground">
                  Rotation threshold {config.rotate_mb} MB.
                </p>
              </CardContent>
            </Card>
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <Button
                variant="outline"
                className="gap-2 bg-background/70"
                onClick={() =>
                  void Promise.all([
                    workspace.sourcesQuery.refetch(),
                    workspace.entriesQuery.refetch(),
                  ])
                }
              >
                <RefreshCw
                  className={
                    workspace.entriesQuery.isFetching || workspace.sourcesQuery.isFetching
                      ? 'h-4 w-4 animate-spin'
                      : 'h-4 w-4'
                  }
                />
                Refresh
              </Button>
              <Button asChild variant="ghost" className="gap-2">
                <Link to="/health">
                  Health
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {errors.length > 0 ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to fully load the logs workspace</AlertTitle>
          <AlertDescription>{errors[0]?.message}</AlertDescription>
        </Alert>
      ) : null}

      <LogsOverviewCards
        config={config}
        sources={workspace.sourcesQuery.data ?? []}
        entries={workspace.entriesQuery.data ?? []}
        latestTimestamp={workspace.latestTimestamp}
      />

      <Tabs defaultValue="stream" className="space-y-5">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="stream">Activity stream</TabsTrigger>
          <TabsTrigger value="errors">CLIProxy errors</TabsTrigger>
        </TabsList>

        <TabsContent value="stream" className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
            <div className="space-y-5 xl:sticky xl:top-5 xl:self-start">
              <LogsFilters
                sources={workspace.sourcesQuery.data ?? []}
                selectedSource={workspace.selectedSource}
                onSourceChange={workspace.setSelectedSource}
                selectedLevel={workspace.selectedLevel}
                onLevelChange={workspace.setSelectedLevel}
                search={workspace.search}
                onSearchChange={workspace.setSearch}
                limit={workspace.limit}
                onLimitChange={workspace.setLimit}
                onRefresh={() =>
                  void Promise.all([
                    workspace.sourcesQuery.refetch(),
                    workspace.entriesQuery.refetch(),
                  ])
                }
                isRefreshing={
                  workspace.entriesQuery.isFetching || workspace.sourcesQuery.isFetching
                }
              />
              <LogsConfigCard
                config={config}
                onSave={(payload) => updateConfig.mutate(payload)}
                isPending={updateConfig.isPending}
              />
            </div>

            <LogsEntryList
              entries={workspace.entriesQuery.data ?? []}
              selectedEntryId={workspace.selectedEntryId}
              onSelect={workspace.setSelectedEntryId}
              sourceLabels={sourceLabels}
              isLoading={workspace.entriesQuery.isLoading}
              isFetching={workspace.entriesQuery.isFetching}
            />
            <LogsDetailPanel
              entry={workspace.selectedEntry}
              sourceLabel={
                workspace.selectedEntry ? sourceLabels[workspace.selectedEntry.source] : undefined
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardContent className="flex flex-col gap-2 p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Legacy diagnostics
              </p>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                CLIProxy request-failure viewer
              </h2>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                Keep the existing request-failure drilldown nearby while the structured CCS stream
                matures. This tab preserves the old operational workflow instead of burying it
                behind Home-only UI.
              </p>
            </CardContent>
          </Card>
          <ErrorLogsMonitor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
