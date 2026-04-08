import { Search, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LogsSource } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { LogsLevelFilter, LogsSourceFilter } from '@/hooks/use-logs';
import { getLogLevelOptions, getSelectedSourceLabel } from '@/hooks/use-logs';

export function LogsFilters({
  sources,
  selectedSource,
  onSourceChange,
  selectedLevel,
  onLevelChange,
  search,
  onSearchChange,
  limit,
  onLimitChange,
  onRefresh,
  isRefreshing,
}: {
  sources: LogsSource[];
  selectedSource: LogsSourceFilter;
  onSourceChange: (value: LogsSourceFilter) => void;
  selectedLevel: LogsLevelFilter;
  onLevelChange: (value: LogsLevelFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
  limit: number;
  onLimitChange: (value: number) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const sourceLabel = getSelectedSourceLabel(selectedSource, sources);
  const levels = getLogLevelOptions();
  const limits = [50, 100, 150, 250];

  return (
    <Card className="gap-4 border-border/70 bg-card/85 shadow-sm">
      <CardHeader className="space-y-3 border-b pb-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <CardTitle>Explorer filters</CardTitle>
        </div>
        <div className="space-y-1">
          <CardDescription>
            Narrow the stream the same way you would in a management console: start with source,
            then severity, then message text.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="logs-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="logs-search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search message, event, process, or run ID"
              className="h-11 border-border/70 bg-background/70 pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Source</Label>
            <span className="text-xs text-muted-foreground">{sourceLabel}</span>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Source filter">
            <button
              type="button"
              onClick={() => onSourceChange('all')}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                selectedSource === 'all'
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border/70 bg-background/70 text-muted-foreground hover:border-primary/30 hover:text-foreground'
              )}
            >
              All sources
            </button>
            {sources.map((source) => (
              <button
                key={source.source}
                type="button"
                onClick={() => onSourceChange(source.source)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  selectedSource === source.source
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border/70 bg-background/70 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                )}
              >
                {source.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Level</Label>
          <div className="flex flex-wrap gap-2" aria-label="Level filter">
            {levels.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onLevelChange(option.value)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  selectedLevel === option.value
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border/70 bg-background/70 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-border/70 bg-background/70 p-4">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
              View window
            </p>
            <p className="text-sm text-muted-foreground">
              Keep the rendered slice tight when you are chasing a live issue.
            </p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Visible entries">
            {limits.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onLimitChange(option)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  limit === option
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border/70 bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground'
                )}
              >
                {option} entries
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={onRefresh}>
            <RefreshCw className={isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh stream
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
