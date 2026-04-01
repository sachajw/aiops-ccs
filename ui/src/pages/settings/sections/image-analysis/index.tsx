import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import { api, type ImageAnalysisDashboardData } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useRawConfig } from '../../hooks';

interface MappingDraft {
  id: string;
  profileName: string;
  backendId: string;
}

const NO_BACKEND = '__no_backend__';

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  );
}

function isImageAnalysisDashboardData(value: unknown): value is ImageAnalysisDashboardData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<ImageAnalysisDashboardData>;
  return (
    !!candidate.config &&
    typeof candidate.config.enabled === 'boolean' &&
    typeof candidate.config.timeout === 'number' &&
    isStringRecord(candidate.config.providerModels) &&
    (candidate.config.fallbackBackend === null ||
      typeof candidate.config.fallbackBackend === 'string') &&
    isStringRecord(candidate.config.profileBackends) &&
    !!candidate.summary &&
    typeof candidate.summary.state === 'string' &&
    typeof candidate.summary.title === 'string' &&
    typeof candidate.summary.detail === 'string' &&
    Array.isArray(candidate.backends) &&
    Array.isArray(candidate.profiles) &&
    !!candidate.catalog &&
    Array.isArray(candidate.catalog.knownBackends) &&
    Array.isArray(candidate.catalog.profileNames)
  );
}

function toMappingDrafts(profileBackends: Record<string, string>): MappingDraft[] {
  return Object.entries(profileBackends)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([profileName, backendId], index) => ({
      id: `${profileName}-${backendId}-${index}`,
      profileName,
      backendId,
    }));
}

function summaryToneClass(state: ImageAnalysisDashboardData['summary']['state']): string {
  switch (state) {
    case 'ready':
      return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200';
    case 'partial':
      return 'border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200';
    case 'needs_setup':
      return 'border-rose-500/25 bg-rose-500/10 text-rose-900 dark:text-rose-200';
    case 'disabled':
      return 'border-border/80 bg-background/85 text-muted-foreground';
  }
}

function backendStateClass(state: ImageAnalysisDashboardData['backends'][number]['state']): string {
  switch (state) {
    case 'ready':
      return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200';
    case 'starts_on_launch':
      return 'border-sky-500/25 bg-sky-500/10 text-sky-800 dark:text-sky-200';
    case 'needs_auth':
      return 'border-rose-500/25 bg-rose-500/10 text-rose-800 dark:text-rose-200';
    case 'needs_proxy':
      return 'border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200';
    case 'review':
      return 'border-border/80 bg-background/85 text-muted-foreground';
  }
}

function currentTargetModeLabel(
  mode: ImageAnalysisDashboardData['profiles'][number]['currentTargetMode']
): string {
  switch (mode) {
    case 'active':
      return 'Active';
    case 'bypassed':
      return 'Bypassed';
    case 'fallback':
      return 'Native fallback';
    case 'setup':
      return 'Needs setup';
    case 'disabled':
      return 'Disabled';
    case 'unresolved':
      return 'Native only';
  }
}

function currentTargetModeClass(
  mode: ImageAnalysisDashboardData['profiles'][number]['currentTargetMode']
): string {
  switch (mode) {
    case 'active':
      return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200';
    case 'bypassed':
      return 'border-sky-500/25 bg-sky-500/10 text-sky-800 dark:text-sky-200';
    case 'fallback':
    case 'setup':
      return 'border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200';
    case 'disabled':
    case 'unresolved':
      return 'border-border/80 bg-background/85 text-muted-foreground';
  }
}

export default function ImageAnalysisSection() {
  const { fetchRawConfig } = useRawConfig();
  const [data, setData] = useState<ImageAnalysisDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(true);
  const [timeout, setTimeout] = useState('60');
  const [fallbackBackend, setFallbackBackend] = useState('');
  const [providerModels, setProviderModels] = useState<Record<string, string>>({});
  const [mappingDrafts, setMappingDrafts] = useState<MappingDraft[]>([]);

  const hydrateDraft = useCallback((nextData: ImageAnalysisDashboardData) => {
    setEnabled(nextData.config.enabled);
    setTimeout(String(nextData.config.timeout));
    setFallbackBackend(nextData.config.fallbackBackend ?? '');
    setProviderModels(
      nextData.catalog.knownBackends.reduce(
        (acc, backendId) => {
          acc[backendId] = nextData.config.providerModels[backendId] ?? '';
          return acc;
        },
        {} as Record<string, string>
      )
    );
    setMappingDrafts(toMappingDrafts(nextData.config.profileBackends));
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const payload = await api.imageAnalysis.get();
      if (!isImageAnalysisDashboardData(payload)) {
        throw new Error(
          'Image Analysis settings returned an unexpected response. Restart the dashboard server so the new API route is available.'
        );
      }
      setData(payload);
      hydrateDraft(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Image Analysis settings.');
    } finally {
      setLoading(false);
    }
  }, [hydrateDraft]);

  useEffect(() => {
    void fetchData();
    void fetchRawConfig();
  }, [fetchData, fetchRawConfig]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 2500);
    return () => window.clearTimeout(timer);
  }, [success]);

  const configuredBackendIds = useMemo(
    () =>
      Object.entries(providerModels)
        .filter(([, model]) => model.trim().length > 0)
        .map(([backendId]) => backendId),
    [providerModels]
  );

  useEffect(() => {
    if (configuredBackendIds.length === 0) {
      setFallbackBackend('');
      return;
    }
    if (!configuredBackendIds.includes(fallbackBackend)) {
      setFallbackBackend(configuredBackendIds[0]);
    }
  }, [configuredBackendIds, fallbackBackend]);

  const payloadPreview = useMemo(() => {
    const nextProviderModels = Object.entries(providerModels).reduce(
      (acc, [backendId, model]) => {
        const normalizedModel = typeof model === 'string' ? model.trim() : '';
        acc[backendId] = normalizedModel || null;
        return acc;
      },
      {} as Record<string, string | null>
    );

    const nextProfileBackends = mappingDrafts.reduce(
      (acc, row) => {
        const profileName = row.profileName.trim();
        if (!profileName || !row.backendId) {
          return acc;
        }
        acc[profileName] = row.backendId;
        return acc;
      },
      {} as Record<string, string>
    );

    return {
      enabled,
      timeout,
      fallbackBackend,
      providerModels: nextProviderModels,
      profileBackends: nextProfileBackends,
    };
  }, [enabled, fallbackBackend, mappingDrafts, providerModels, timeout]);

  const hasChanges = useMemo(() => {
    if (!data) return false;
    return (
      JSON.stringify(payloadPreview) !==
      JSON.stringify({
        enabled: data.config.enabled,
        timeout: String(data.config.timeout),
        fallbackBackend: data.config.fallbackBackend ?? '',
        providerModels: data.catalog.knownBackends.reduce(
          (acc, backendId) => {
            acc[backendId] = data.config.providerModels[backendId] ?? null;
            return acc;
          },
          {} as Record<string, string | null>
        ),
        profileBackends: data.config.profileBackends,
      })
    );
  }, [data, payloadPreview]);

  const canSave = configuredBackendIds.length > 0 && Number.isInteger(Number(timeout));

  const handleRefresh = async () => {
    if (loading || saving) return;
    setSuccess(null);
    await Promise.all([fetchData(), fetchRawConfig()]);
  };

  const handleSave = async () => {
    if (!data) return;
    const parsedTimeout = Number.parseInt(timeout, 10);

    if (!Number.isInteger(parsedTimeout) || parsedTimeout < 10 || parsedTimeout > 600) {
      setError('Timeout must be an integer between 10 and 600 seconds.');
      return;
    }

    if (configuredBackendIds.length === 0) {
      setError('Keep at least one provider model configured, or disable Image Analysis globally.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const payload = await api.imageAnalysis.update({
        enabled,
        timeout: parsedTimeout,
        fallbackBackend: fallbackBackend || null,
        providerModels: payloadPreview.providerModels,
        profileBackends: payloadPreview.profileBackends,
      });
      setData(payload);
      hydrateDraft(payload);
      setSuccess('Image Analysis settings saved.');
      await fetchRawConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Image Analysis settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading Image Analysis settings...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-5">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error ?? 'Failed to load Image Analysis settings.'}</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-5 space-y-6">
        {(error || success) && (
          <div className="space-y-2">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium">{success}</span>
              </div>
            )}
          </div>
        )}

        <section className="rounded-xl border bg-background/95 p-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-sky-600" />
                <h2 className="text-sm font-semibold">Image Analysis</h2>
                <Badge className={cn('border', summaryToneClass(data.summary.state))}>
                  {data.summary.title}
                </Badge>
              </div>
              <p className="max-w-2xl text-sm text-muted-foreground">{data.summary.detail}</p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={loading || saving}
              >
                <RefreshCw className={cn('mr-1 h-4 w-4', loading && 'animate-spin')} />
                Refresh
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges || !canSave}>
                <Save className="mr-1 h-4 w-4" />
                Save changes
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Enabled
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{enabled ? 'On' : 'Off'}</span>
                <Switch checked={enabled} onCheckedChange={setEnabled} disabled={saving} />
              </div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Timeout
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  value={timeout}
                  onChange={(event) => setTimeout(event.target.value)}
                  inputMode="numeric"
                  className="h-9"
                />
                <span className="text-xs text-muted-foreground">sec</span>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Fallback backend
              </div>
              <div className="mt-2">
                <Select
                  value={fallbackBackend || NO_BACKEND}
                  onValueChange={(value) => setFallbackBackend(value === NO_BACKEND ? '' : value)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choose backend" />
                  </SelectTrigger>
                  <SelectContent>
                    {configuredBackendIds.length === 0 ? (
                      <SelectItem value={NO_BACKEND}>Configure a model first</SelectItem>
                    ) : (
                      configuredBackendIds.map((backendId) => (
                        <SelectItem key={backendId} value={backendId}>
                          {backendId}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Coverage
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline">{data.summary.backendCount} backends</Badge>
                <Badge variant="outline">{data.summary.mappedProfileCount} mapped</Badge>
                <Badge variant="outline">{data.summary.bypassedProfileCount} bypassed</Badge>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-background/95 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Provider models</h3>
              <p className="text-sm text-muted-foreground">
                One model per backend. Clear a model to remove that backend from Image Analysis.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {data.catalog.knownBackends.map((backendId) => {
              const backendStatus = data.backends.find((item) => item.backendId === backendId);
              const displayName = backendStatus?.displayName || backendId;

              return (
                <div key={backendId} className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{displayName}</div>
                      <div className="text-xs text-muted-foreground">{backendId}</div>
                    </div>
                    {backendStatus ? (
                      <Badge className={cn('border', backendStateClass(backendStatus.state))}>
                        {backendStatus.state === 'starts_on_launch'
                          ? 'Starts on launch'
                          : backendStatus.state === 'needs_auth'
                            ? 'Needs auth'
                            : backendStatus.state === 'needs_proxy'
                              ? 'Needs proxy'
                              : backendStatus.state === 'review'
                                ? 'Review'
                                : 'Ready'}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </div>

                  <Input
                    className="mt-3 h-9"
                    placeholder="Set vision model"
                    value={providerModels[backendId] ?? ''}
                    onChange={(event) =>
                      setProviderModels((current) => ({
                        ...current,
                        [backendId]: event.target.value,
                      }))
                    }
                  />

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>
                      Auth:{' '}
                      {backendStatus?.authReadiness === 'ready'
                        ? 'ready'
                        : backendStatus?.authReadiness === 'missing'
                          ? 'missing'
                          : 'n/a'}
                    </span>
                    <span>
                      Proxy:{' '}
                      {backendStatus?.proxyReadiness === 'remote'
                        ? 'remote'
                        : backendStatus?.proxyReadiness === 'stopped'
                          ? 'idle'
                          : (backendStatus?.proxyReadiness ?? 'n/a')}
                    </span>
                    <span>{backendStatus?.profilesUsing ?? 0} profiles use this backend</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border bg-background/95 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Profile mappings</h3>
              <p className="text-sm text-muted-foreground">
                Use explicit mappings only when a profile should bypass the normal backend
                resolution.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setMappingDrafts((current) => [
                  ...current,
                  {
                    id: `mapping-${Date.now()}`,
                    profileName: '',
                    backendId: configuredBackendIds[0] ?? '',
                  },
                ])
              }
              disabled={configuredBackendIds.length === 0}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add mapping
            </Button>
          </div>

          <datalist id="image-analysis-profile-suggestions">
            {data.catalog.profileNames.map((profileName) => (
              <option key={profileName} value={profileName} />
            ))}
          </datalist>

          <div className="mt-4 space-y-3">
            {mappingDrafts.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">
                No explicit profile mappings saved. Profiles follow provider and fallback
                resolution.
              </div>
            ) : (
              mappingDrafts.map((row) => (
                <div
                  key={row.id}
                  className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-[1.4fr_1fr_auto]"
                >
                  <Input
                    value={row.profileName}
                    list="image-analysis-profile-suggestions"
                    placeholder="Profile or variant name"
                    onChange={(event) =>
                      setMappingDrafts((current) =>
                        current.map((entry) =>
                          entry.id === row.id
                            ? { ...entry, profileName: event.target.value }
                            : entry
                        )
                      )
                    }
                  />
                  <Select
                    value={row.backendId || NO_BACKEND}
                    onValueChange={(value) =>
                      setMappingDrafts((current) =>
                        current.map((entry) =>
                          entry.id === row.id
                            ? { ...entry, backendId: value === NO_BACKEND ? '' : value }
                            : entry
                        )
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose backend" />
                    </SelectTrigger>
                    <SelectContent>
                      {configuredBackendIds.length === 0 ? (
                        <SelectItem value={NO_BACKEND}>Configure a model first</SelectItem>
                      ) : (
                        configuredBackendIds.map((backendId) => (
                          <SelectItem key={backendId} value={backendId}>
                            {backendId}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setMappingDrafts((current) => current.filter((entry) => entry.id !== row.id))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-background/95 p-4 shadow-sm">
          <div>
            <h3 className="text-sm font-semibold">Profile coverage</h3>
            <p className="text-sm text-muted-foreground">
              Quick read-only view of which saved profiles can use Image Analysis on their current
              target.
            </p>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-[1.5fr_100px_1.2fr_120px] gap-3 bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                <span>Profile</span>
                <span>Target</span>
                <span>Backend</span>
                <span>Current path</span>
              </div>
              <div className="divide-y">
                {data.profiles.map((profile) => (
                  <div
                    key={`${profile.kind}-${profile.name}`}
                    className="grid grid-cols-[1.5fr_100px_1.2fr_120px] gap-3 px-3 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">{profile.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {profile.kind === 'variant' ? 'CLIProxy variant' : 'Settings profile'}
                      </div>
                    </div>
                    <div className="text-muted-foreground">{profile.target}</div>
                    <div className="min-w-0">
                      <div className="truncate">
                        {profile.backendDisplayName || 'Native file access'}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {profile.resolutionSource.replace(/-/g, ' ')}
                      </div>
                    </div>
                    <div>
                      <Badge
                        className={cn('border', currentTargetModeClass(profile.currentTargetMode))}
                      >
                        {currentTargetModeLabel(profile.currentTargetMode)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}
