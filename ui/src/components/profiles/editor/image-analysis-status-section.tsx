import { AlertTriangle, ArrowUpRight, Image as ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CliTarget, ImageAnalysisStatus } from '@/lib/api-client';

interface ImageAnalysisStatusSectionProps {
  status?: ImageAnalysisStatus | null;
  target?: CliTarget;
  source?: 'saved' | 'editor';
  previewState?: 'saved' | 'preview' | 'refreshing' | 'invalid';
}

const SOURCE_LABELS: Record<ImageAnalysisStatus['resolutionSource'], string> = {
  'cliproxy-provider': 'Direct provider route',
  'cliproxy-variant': 'Variant route',
  'cliproxy-composite': 'Composite route',
  'copilot-alias': 'Copilot alias',
  'cliproxy-bridge': 'Derived from profile route',
  'profile-backend': 'Explicit profile mapping',
  'fallback-backend': 'Fallback backend',
  disabled: 'Disabled globally',
  'unsupported-profile': 'Unsupported profile type',
  unresolved: 'No backend mapped',
  'missing-model': 'Missing model',
};

const TARGET_LABELS: Record<CliTarget, string> = {
  claude: 'Claude Code',
  droid: 'Factory Droid',
  codex: 'Codex CLI',
};

function getPreviewBadge(
  source: 'saved' | 'editor',
  previewState: ImageAnalysisStatusSectionProps['previewState']
) {
  if (previewState === 'refreshing') {
    return { label: 'Refreshing', variant: 'outline' as const };
  }
  if (source === 'editor') {
    return { label: 'Live Preview', variant: 'secondary' as const };
  }
  return { label: 'Saved', variant: 'outline' as const };
}

function getRuntimeBadge(status: ImageAnalysisStatus, target: CliTarget) {
  if (status.status === 'disabled') {
    return {
      label: 'Disabled',
      className: 'border-border/80 bg-background/85 text-muted-foreground',
    };
  }
  if (status.status === 'hook-missing') {
    return {
      label: 'Setup needed',
      className: 'border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200',
    };
  }
  if (status.authReadiness === 'missing') {
    return {
      label: 'Needs auth',
      className: 'border-rose-500/25 bg-rose-500/10 text-rose-800 dark:text-rose-200',
    };
  }
  if (status.proxyReadiness === 'unavailable') {
    return {
      label: 'Needs proxy',
      className: 'border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200',
    };
  }
  if (target !== 'claude') {
    return {
      label: 'Bypassed',
      className: 'border-sky-500/25 bg-sky-500/10 text-sky-800 dark:text-sky-200',
    };
  }
  if (status.effectiveRuntimeMode === 'native-read') {
    return {
      label: 'Native fallback',
      className: 'border-border/80 bg-background/85 text-muted-foreground',
    };
  }
  if (status.proxyReadiness === 'stopped') {
    return {
      label: 'Starts on launch',
      className: 'border-sky-500/25 bg-sky-500/10 text-sky-800 dark:text-sky-200',
    };
  }
  return {
    label: 'CLIProxy active',
    className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  };
}

function getStatusContext(
  source: 'saved' | 'editor',
  previewState: ImageAnalysisStatusSectionProps['previewState']
) {
  if (previewState === 'invalid') {
    return 'Showing saved status until the JSON above is valid again.';
  }
  if (previewState === 'refreshing') {
    return 'Refreshing from the current editor state.';
  }
  return source === 'editor'
    ? 'Preview from the current editor JSON.'
    : 'Saved status for this profile.';
}

function getSummary(status: ImageAnalysisStatus, target: CliTarget): string {
  const backendName = status.backendDisplayName || status.backendId || 'native file access';
  if (status.status === 'disabled') {
    return 'Image Analysis is disabled globally for this profile.';
  }
  if (!status.backendId) {
    return target === 'claude'
      ? 'This profile currently uses native file access for images and PDFs.'
      : `Current target ${TARGET_LABELS[target]} bypasses the hook and no saved backend is mapped.`;
  }
  if (target !== 'claude') {
    return status.effectiveRuntimeMode === 'native-read'
      ? `Current target ${TARGET_LABELS[target]} bypasses the hook. Saved Claude-side setup for ${backendName} currently falls back to native file access.`
      : `Current target ${TARGET_LABELS[target]} bypasses the hook. Saved Claude-side backend: ${backendName}.`;
  }
  if (status.effectiveRuntimeMode === 'native-read') {
    return `Saved backend: ${backendName}. Current runtime falls back to native file access.`;
  }
  return `Saved backend: ${backendName}. Images and PDFs resolve through CLIProxy on this target.`;
}

function getTargetDetail(status: ImageAnalysisStatus, target: CliTarget): string {
  if (target !== 'claude') {
    return 'Current launch path bypasses the Claude Read hook.';
  }
  if (status.status === 'hook-missing') {
    return 'Hook must be persisted before this profile can use Image Analysis.';
  }
  if (status.effectiveRuntimeMode === 'native-read') {
    return status.effectiveRuntimeReason || status.reason || 'Using native file access.';
  }
  if (status.proxyReadiness === 'stopped') {
    return 'Auth is ready. Local CLIProxy will start on demand.';
  }
  return 'Current target can use the saved backend.';
}

function getPersistenceValue(status: ImageAnalysisStatus): string {
  if (!status.shouldPersistHook || !status.persistencePath) {
    return 'Not required';
  }
  return status.hookInstalled ? 'Hook saved' : 'Hook missing';
}

function getPersistenceDetail(status: ImageAnalysisStatus): string {
  if (!status.shouldPersistHook || !status.persistencePath) {
    return 'No profile-level hook persistence required.';
  }
  return status.persistencePath;
}

function getModelValue(status: ImageAnalysisStatus): string {
  return status.model || status.reason || 'Unavailable';
}

export function ImageAnalysisStatusSection({
  status,
  target = 'claude',
  source = 'saved',
  previewState = 'saved',
}: ImageAnalysisStatusSectionProps) {
  if (!status) {
    return (
      <div className="rounded-md border bg-muted/20 p-4" aria-live="polite">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-3 w-64 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const previewBadge = getPreviewBadge(source, previewState);
  const runtimeBadge = getRuntimeBadge(status, target);
  const showNotice =
    status.status === 'hook-missing' ||
    status.authReadiness === 'missing' ||
    status.proxyReadiness === 'unavailable';

  return (
    <section className="rounded-md border bg-muted/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-sky-600" />
            <h3 className="text-sm font-semibold">Image Analysis</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {getStatusContext(source, previewState)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={previewBadge.variant} className="h-5 px-1.5 text-[10px]">
            {previewBadge.label}
          </Badge>
          <Badge className={cn('h-5 border px-1.5 text-[10px]', runtimeBadge.className)}>
            {runtimeBadge.label}
          </Badge>
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-muted-foreground">{getSummary(status, target)}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-md border bg-background/70 p-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Backend
          </div>
          <div className="mt-2 text-sm font-medium text-foreground">
            {status.backendDisplayName || status.backendId || 'Native file access'}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {SOURCE_LABELS[status.resolutionSource]}
          </p>
        </div>

        <div className="rounded-md border bg-background/70 p-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Current target
          </div>
          <div className="mt-2 text-sm font-medium text-foreground">{TARGET_LABELS[target]}</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {getTargetDetail(status, target)}
          </p>
        </div>

        <div className="rounded-md border bg-background/70 p-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Persistence
          </div>
          <div className="mt-2 text-sm font-medium text-foreground">
            {getPersistenceValue(status)}
          </div>
          <p
            className="mt-1 text-xs leading-5 text-muted-foreground"
            title={status.persistencePath || 'Not required'}
          >
            {getPersistenceDetail(status)}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-3">
        <div className="space-y-1">
          <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Auth
          </dt>
          <dd className="text-sm text-foreground">
            {status.authReadiness === 'ready'
              ? `${status.authDisplayName || status.authProvider} ready`
              : status.authReadiness === 'missing'
                ? status.authReason
                : status.authReadiness === 'not-needed'
                  ? 'Not required'
                  : 'Unknown'}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Proxy
          </dt>
          <dd className="text-sm text-foreground">
            {status.proxyReadiness === 'ready'
              ? 'Local CLIProxy ready'
              : status.proxyReadiness === 'remote'
                ? 'Remote CLIProxy ready'
                : status.proxyReadiness === 'stopped'
                  ? 'Local CLIProxy idle'
                  : status.proxyReadiness === 'not-needed'
                    ? 'Not required'
                    : status.proxyReason || 'Unknown'}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Model
          </dt>
          <dd className={cn('text-sm text-foreground', status.model && 'font-mono text-xs')}>
            {getModelValue(status)}
          </dd>
        </div>
      </dl>

      {showNotice && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>
            {status.effectiveRuntimeReason || status.reason || 'Review the saved configuration.'}
          </span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
        <p className="text-xs text-muted-foreground">
          CRUD and backend routing now live in global Settings.
        </p>
        <Button size="sm" variant="outline" asChild>
          <Link to="/settings?tab=imageanalysis">
            Open Settings
            <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
