import { FileJson, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { LogsEntry } from '@/lib/api-client';
import { LogLevelBadge } from './log-level-badge';
import { formatJson, formatLogTimestamp } from './utils';

function MetaRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-background/70 p-3">
      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-1 break-all text-sm font-medium">{value}</p>
    </div>
  );
}

export function LogsDetailPanel({
  entry,
  sourceLabel,
}: {
  entry: LogsEntry | null;
  sourceLabel?: string;
}) {
  if (!entry) {
    return (
      <Card className="gap-4 border-border/70 bg-card/85 shadow-sm">
        <CardHeader>
          <CardTitle>Inspector</CardTitle>
          <CardDescription>
            Select an activity row to inspect its operational metadata.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-[42rem] items-center justify-center text-sm text-muted-foreground">
          Nothing selected yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-4 border-border/70 bg-card/85 shadow-sm">
      <CardHeader className="space-y-3 border-b pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <LogLevelBadge level={entry.level} />
          <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {sourceLabel ?? entry.source}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatLogTimestamp(entry.timestamp)}
          </span>
        </div>
        <div className="space-y-1">
          <CardTitle className="text-2xl tracking-tight">{entry.event}</CardTitle>
          <CardDescription className="text-sm leading-6 text-foreground/85">
            {entry.message}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="details" className="space-y-4">
          <TabsList>
            <TabsTrigger value="details" className="gap-2">
              <Info className="h-4 w-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="raw" className="gap-2">
              <FileJson className="h-4 w-4" />
              Raw context
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <MetaRow label="Entry ID" value={entry.id} />
              <MetaRow label="Source" value={entry.source} />
              <MetaRow label="Process ID" value={entry.processId ?? 'Unavailable'} />
              <MetaRow label="Run ID" value={entry.runId ?? 'Unavailable'} />
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Context summary
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This entry belongs to{' '}
                <span className="font-medium text-foreground">{sourceLabel ?? entry.source}</span>{' '}
                and was emitted at the{' '}
                <span className="font-medium text-foreground">{entry.level}</span> threshold. Use
                the raw tab for the exact structured payload.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="raw">
            <ScrollArea className="h-[24rem] rounded-xl border bg-zinc-950 p-4 text-xs text-zinc-100">
              <pre className="whitespace-pre-wrap break-words font-mono">
                {formatJson({
                  id: entry.id,
                  timestamp: entry.timestamp,
                  level: entry.level,
                  source: entry.source,
                  event: entry.event,
                  message: entry.message,
                  processId: entry.processId,
                  runId: entry.runId,
                  context: entry.context ?? {},
                })}
              </pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
