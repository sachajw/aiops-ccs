import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { LogsEntry } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { LogLevelBadge } from './log-level-badge';
import { formatLogTimestamp, formatRelativeLogTime } from './utils';

export function LogsEntryList({
  entries,
  selectedEntryId,
  onSelect,
  sourceLabels,
  isLoading,
  isFetching,
}: {
  entries: LogsEntry[];
  selectedEntryId: string | null;
  onSelect: (entryId: string) => void;
  sourceLabels: Record<string, string>;
  isLoading: boolean;
  isFetching: boolean;
}) {
  return (
    <Card className="gap-4 border-border/70 bg-card/85 shadow-sm">
      <CardHeader className="space-y-1 border-b pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Activity queue</CardTitle>
            <CardDescription>
              Dense operational feed for the active source and severity mix.
            </CardDescription>
          </div>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {isLoading ? (
          <div className="space-y-3 px-6 pb-6">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="rounded-xl border p-4">
                <div className="h-3 w-20 rounded bg-muted" />
                <div className="mt-3 h-4 w-4/5 rounded bg-muted" />
                <div className="mt-2 h-3 w-2/5 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex min-h-[24rem] flex-col items-center justify-center gap-3 px-6 py-12 text-center text-muted-foreground">
            <Inbox className="h-8 w-8" />
            <div>
              <p className="font-medium text-foreground">No entries matched these filters.</p>
              <p className="text-sm">Try broadening the source, severity, or search terms.</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[42rem]">
            <div className="space-y-2 px-3 pb-3">
              {entries.map((entry) => {
                const isSelected = entry.id === selectedEntryId;

                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onSelect(entry.id)}
                    className={cn(
                      'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
                      isSelected
                        ? 'border-primary/40 bg-primary/5 shadow-sm'
                        : 'border-border/70 bg-background/70 hover:border-primary/20 hover:bg-muted/30'
                    )}
                  >
                    <div className="grid gap-3 xl:grid-cols-[7.5rem_minmax(0,1fr)] xl:items-start">
                      <div className="space-y-2">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                          {formatRelativeLogTime(entry.timestamp)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatLogTimestamp(entry.timestamp)}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <LogLevelBadge level={entry.level} />
                          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                            {sourceLabels[entry.source] ?? entry.source}
                          </span>
                          <span className="text-xs text-muted-foreground">{entry.event}</span>
                        </div>
                        <p className="line-clamp-2 text-sm font-medium leading-6 text-foreground">
                          {entry.message}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>PID {entry.processId ?? 'n/a'}</span>
                          <span>Run {entry.runId ?? 'n/a'}</span>
                        </div>
                      </div>
                    </div>
                    {entry.level === 'error' ? (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/5 px-2.5 py-1 text-[11px] font-medium text-red-700 dark:text-red-300">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Elevated severity
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
