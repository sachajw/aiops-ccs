import { useEffect, useMemo, useState } from 'react';
import { Save, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { LogsConfig, UpdateLogsConfigPayload } from '@/lib/api-client';

function parseInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.max(0, parsed);
}

export function LogsConfigCard({
  config,
  onSave,
  isPending,
}: {
  config: LogsConfig;
  onSave: (payload: UpdateLogsConfigPayload) => void;
  isPending: boolean;
}) {
  const [draft, setDraft] = useState(config);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(config), [config, draft]);

  return (
    <Card className="gap-4 border-border/70 bg-card/85 shadow-sm">
      <CardHeader className="space-y-2 border-b pb-4">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <CardTitle>Logging policy</CardTitle>
        </div>
        <CardDescription>
          Keep retention, file rotation, redaction, and live tail depth aligned with the host.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Current posture
              </p>
              <p className="text-muted-foreground">
                {config.enabled ? 'Logging is enabled' : 'Logging is disabled'} at{' '}
                {config.level.toUpperCase()} and above.
              </p>
            </div>
            <span className="rounded-full border px-2 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {config.redact ? 'Redacted' : 'Plain'}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/60 p-3">
            <div className="space-y-1">
              <Label htmlFor="logs-enabled">Enabled</Label>
              <p className="text-xs text-muted-foreground">
                Turn the unified logging pipeline on or off.
              </p>
            </div>
            <Switch
              id="logs-enabled"
              checked={draft.enabled}
              onCheckedChange={(checked) =>
                setDraft((current) => ({ ...current, enabled: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/60 p-3">
            <div className="space-y-1">
              <Label htmlFor="logs-redact">Redact payloads</Label>
              <p className="text-xs text-muted-foreground">
                Mask sensitive content before it lands in the log archive.
              </p>
            </div>
            <Switch
              id="logs-redact"
              checked={draft.redact}
              onCheckedChange={(checked) =>
                setDraft((current) => ({ ...current, redact: checked }))
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="logs-config-level">Minimum level</Label>
          <Select
            value={draft.level}
            onValueChange={(value) =>
              setDraft((current) => ({ ...current, level: value as LogsConfig['level'] }))
            }
          >
            <SelectTrigger
              id="logs-config-level"
              aria-label="Minimum log level"
              className="border-border/70 bg-background/70"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="error">Error only</SelectItem>
              <SelectItem value="warn">Warn and above</SelectItem>
              <SelectItem value="info">Info and above</SelectItem>
              <SelectItem value="debug">Debug and above</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="logs-rotate-mb">Rotate size (MB)</Label>
            <Input
              id="logs-rotate-mb"
              type="number"
              min={1}
              className="border-border/70 bg-background/70"
              value={draft.rotate_mb}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  rotate_mb: parseInteger(event.target.value, current.rotate_mb),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logs-retain-days">Retention (days)</Label>
            <Input
              id="logs-retain-days"
              type="number"
              min={1}
              className="border-border/70 bg-background/70"
              value={draft.retain_days}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  retain_days: parseInteger(event.target.value, current.retain_days),
                }))
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="logs-buffer-size">Live buffer size</Label>
          <Input
            id="logs-buffer-size"
            type="number"
            min={1}
            className="border-border/70 bg-background/70"
            value={draft.live_buffer_size}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                live_buffer_size: parseInteger(event.target.value, current.live_buffer_size),
              }))
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border/70 pt-4">
          <Button onClick={() => onSave(draft)} disabled={!isDirty || isPending} className="gap-2">
            <Save className="h-4 w-4" />
            Save policy
          </Button>
          <Button
            variant="outline"
            onClick={() => setDraft(config)}
            disabled={!isDirty || isPending}
          >
            Reset
          </Button>
          {isDirty ? <span className="text-sm text-muted-foreground">Unsaved changes</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
